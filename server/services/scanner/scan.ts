import { realpath } from 'node:fs/promises';
import { dirname } from 'node:path';
import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { jobQueue, scanRuns } from '~/server/db/schema';
import { limits } from '~/server/jobs/limits';
import { markJobProgress } from '~/server/jobs/queue';
import type { ScanDirectoryJobPayload } from '~/server/jobs/types';
import { walkDirectory } from './walk';
import { ScanBatchWriter } from './persist';

function isInsideAllowedRoot(candidate: string, allowedRoots: string[]): boolean {
  return allowedRoots.some((root) => candidate === root || candidate.startsWith(`${root}/`));
}

export async function runScanDirectoryJob(jobId: string, payload: ScanDirectoryJobPayload, isCancelled: () => Promise<boolean>) {
  const startedAt = new Date().toISOString();
  const rootPath = await realpath(payload.rootPath);
  const allowedRoots = await Promise.all(payload.allowedRoots.map((path) => realpath(path)));

  if (!isInsideAllowedRoot(rootPath, allowedRoots)) {
    throw new Error(`Scan path is outside allowed roots: ${rootPath}`);
  }

  await db.update(scanRuns).set({ state: 'running', startedAt, updatedAt: startedAt }).where(eq(scanRuns.scanId, payload.scanId));

  const writer = new ScanBatchWriter(payload.scanId, limits.maxDbBatchSize);
  let discovered = 0;

  const started = Date.now();
  for await (const entry of walkDirectory(rootPath, payload.options)) {
    if (Date.now() - started > limits.maxJobRuntimeMs) {
      throw new Error('Scan job exceeded MAX_JOB_RUNTIME_MS');
    }

    if (await isCancelled()) {
      await db.update(scanRuns)
        .set({ state: 'cancelled', cancelledAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
        .where(eq(scanRuns.scanId, payload.scanId));
      return { cancelled: true, discovered, ...writer.stats };
    }

    discovered += 1;
    writer.add(entry);

    if (writer.size >= limits.maxDbBatchSize) {
      await writer.flush();
      const progress = { discovered, ...writer.stats };
      await markJobProgress(jobId, progress);
      await db.update(scanRuns).set({
        filesDiscovered: discovered,
        filesPersisted: writer.stats.persisted,
        batchesFlushed: writer.stats.batchesFlushed,
        updatedAt: new Date().toISOString(),
      }).where(eq(scanRuns.scanId, payload.scanId));
    }
  }

  await writer.flush();
  const finishedAt = new Date().toISOString();
  await db.update(scanRuns).set({
    state: 'succeeded',
    finishedAt,
    filesDiscovered: discovered,
    filesPersisted: writer.stats.persisted,
    batchesFlushed: writer.stats.batchesFlushed,
    updatedAt: finishedAt,
  }).where(eq(scanRuns.scanId, payload.scanId));

  const result = { discovered, ...writer.stats };
  await markJobProgress(jobId, result);
  return result;
}

export async function syncScanStateFromJob(jobId: string, state: 'failed' | 'cancelled', error?: string) {
  const rows = await db.select({ scanId: scanRuns.scanId }).from(scanRuns).where(eq(scanRuns.jobId, jobId)).limit(1);
  const scanId = rows[0]?.scanId;
  if (!scanId) return;
  await db.update(scanRuns)
    .set({
      state,
      lastError: error,
      finishedAt: new Date().toISOString(),
      cancelledAt: state === 'cancelled' ? new Date().toISOString() : null,
      updatedAt: new Date().toISOString(),
    })
    .where(and(eq(scanRuns.scanId, scanId), eq(scanRuns.jobId, jobId)));
}

export async function isJobCancelled(jobId: string) {
  const rows = await db.select({ cancelRequested: jobQueue.cancelRequested }).from(jobQueue).where(eq(jobQueue.jobId, jobId)).limit(1);
  return Boolean(rows[0]?.cancelRequested);
}
