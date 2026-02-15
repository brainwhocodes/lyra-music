import { and, asc, eq, inArray, lt, or, sql } from 'drizzle-orm';
import { db } from '~/server/db';
import { jobQueue } from '~/server/db/schema';
import { limits } from './limits';
import type { EnqueueJobInput, JobType } from './types';
import { parsePayloadByType } from './types';

export interface LeasedJob {
  jobId: string;
  jobType: JobType;
  payload: unknown;
  attempts: number;
  maxAttempts: number;
  cancelRequested: boolean;
}

function nowEpoch() {
  return Math.floor(Date.now() / 1000);
}

export async function enqueueJob<T extends JobType>(input: EnqueueJobInput<T>) {
  const payload = parsePayloadByType(input.type, input.payload);
  const queuedCount = await db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.state, 'queued'));
  if ((queuedCount[0]?.count ?? 0) >= limits.queueMaxLength) {
    return { queued: false as const, reason: 'queue_full' as const };
  }

  const inserted = await db.insert(jobQueue).values({
    jobType: input.type,
    payload: JSON.stringify(payload),
    state: 'queued',
    maxAttempts: input.maxAttempts ?? 3,
    runAfter: input.runAfterEpochSeconds ?? nowEpoch(),
  }).returning({ jobId: jobQueue.jobId });

  return { queued: true as const, jobId: inserted[0]!.jobId };
}

export async function leaseNextJob(leaseOwner: string, acceptedTypes: JobType[]): Promise<LeasedJob | null> {
  const now = nowEpoch();
  const candidate = await db.select().from(jobQueue)
    .where(and(
      inArray(jobQueue.jobType, acceptedTypes),
      or(
        and(eq(jobQueue.state, 'queued'), lt(jobQueue.runAfter, now + 1)),
        and(eq(jobQueue.state, 'running'), lt(jobQueue.leasedUntil, now + 1)),
      )
    ))
    .orderBy(asc(jobQueue.runAfter), asc(jobQueue.createdAt))
    .limit(1);

  const job = candidate[0];
  if (!job) return null;

  const leaseUntil = now + limits.leaseDurationSeconds;
  const updated = await db.update(jobQueue)
    .set({
      state: 'running',
      leaseOwner,
      leasedUntil: leaseUntil,
      attempts: sql`${jobQueue.attempts} + 1`,
      updatedAt: new Date().toISOString(),
    })
    .where(and(
      eq(jobQueue.jobId, job.jobId),
      or(
        eq(jobQueue.state, 'queued'),
        and(eq(jobQueue.state, 'running'), lt(jobQueue.leasedUntil, now + 1))
      )
    ))
    .returning();

  if (!updated[0]) return null;

  return {
    jobId: job.jobId,
    jobType: job.jobType as JobType,
    payload: JSON.parse(job.payload),
    attempts: (job.attempts ?? 0) + 1,
    maxAttempts: job.maxAttempts,
    cancelRequested: Boolean(job.cancelRequested),
  };
}

export async function heartbeatLease(jobId: string, leaseOwner: string) {
  const now = nowEpoch();
  await db.update(jobQueue).set({ leasedUntil: now + limits.leaseDurationSeconds, updatedAt: new Date().toISOString() })
    .where(and(eq(jobQueue.jobId, jobId), eq(jobQueue.leaseOwner, leaseOwner), eq(jobQueue.state, 'running')));
}

export async function markJobProgress(jobId: string, progress: Record<string, unknown>) {
  await db.update(jobQueue).set({ progress: JSON.stringify(progress), updatedAt: new Date().toISOString() }).where(eq(jobQueue.jobId, jobId));
}

export async function markJobSucceeded(jobId: string, result: Record<string, unknown>) {
  await db.update(jobQueue).set({
    state: 'succeeded',
    result: JSON.stringify(result),
    leasedUntil: null,
    leaseOwner: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(jobQueue.jobId, jobId));
}

export async function markJobCancelled(jobId: string, result: Record<string, unknown> = {}) {
  await db.update(jobQueue).set({
    state: 'cancelled',
    result: JSON.stringify(result),
    leasedUntil: null,
    leaseOwner: null,
    updatedAt: new Date().toISOString(),
  }).where(eq(jobQueue.jobId, jobId));
}

export async function markJobFailed(jobId: string, error: Error, attempts: number, maxAttempts: number) {
  const retryable = attempts < maxAttempts;
  const nextDelaySec = Math.min(2 ** attempts, 60);

  await db.update(jobQueue).set({
    state: retryable ? 'queued' : 'failed',
    runAfter: retryable ? nowEpoch() + nextDelaySec : nowEpoch(),
    leasedUntil: null,
    leaseOwner: null,
    lastError: `${error.name}: ${error.message}`,
    updatedAt: new Date().toISOString(),
  }).where(eq(jobQueue.jobId, jobId));
}

export async function requestJobCancel(jobId: string) {
  const rows = await db.update(jobQueue)
    .set({ cancelRequested: true, updatedAt: new Date().toISOString() })
    .where(and(eq(jobQueue.jobId, jobId), or(eq(jobQueue.state, 'queued'), eq(jobQueue.state, 'running'))))
    .returning({ jobId: jobQueue.jobId, state: jobQueue.state });
  return rows[0] ?? null;
}

export async function getJob(jobId: string) {
  const rows = await db.select().from(jobQueue).where(eq(jobQueue.jobId, jobId)).limit(1);
  return rows[0] ?? null;
}
