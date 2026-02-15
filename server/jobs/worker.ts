import { randomUUID } from 'node:crypto';
import { limits } from './limits';
import { getJob, heartbeatLease, leaseNextJob, markJobCancelled, markJobFailed, markJobSucceeded } from './queue';
import type { JobType } from './types';
import { parsePayloadByType } from './types';
import { isJobCancelled, runScanDirectoryJob, syncScanStateFromJob } from '~/server/services/scanner/scan';

type JobHandler = (jobId: string, payload: any, isCancelled: () => Promise<boolean>) => Promise<Record<string, unknown>>;

const handlers: Record<JobType, JobHandler> = {
  'scan.directory': runScanDirectoryJob,
};

export class InflightLimiter {
  private inflight = 0;
  private byType = new Map<string, number>();

  canRun(jobType: string) {
    return this.inflight < limits.maxConcurrentJobs && (this.byType.get(jobType) ?? 0) < (limits.perTypeConcurrency[jobType] ?? 1);
  }

  start(jobType: string) {
    this.inflight += 1;
    this.byType.set(jobType, (this.byType.get(jobType) ?? 0) + 1);
  }

  finish(jobType: string) {
    this.inflight = Math.max(0, this.inflight - 1);
    this.byType.set(jobType, Math.max(0, (this.byType.get(jobType) ?? 1) - 1));
  }

  get count() {
    return this.inflight;
  }
}

async function executeLeasedJob(leaseOwner: string, leased: Awaited<ReturnType<typeof leaseNextJob>>) {
  if (!leased) return false;
  const beat = setInterval(() => void heartbeatLease(leased.jobId, leaseOwner), Math.max(5000, limits.pollIntervalMs));
  try {
    const payload = parsePayloadByType(leased.jobType, leased.payload);
    const result = await handlers[leased.jobType](leased.jobId, payload, () => isJobCancelled(leased.jobId));

    if (await isJobCancelled(leased.jobId)) {
      await markJobCancelled(leased.jobId, result);
      await syncScanStateFromJob(leased.jobId, 'cancelled');
    } else {
      await markJobSucceeded(leased.jobId, result);
    }
  } catch (error: any) {
    await markJobFailed(leased.jobId, error, leased.attempts, leased.maxAttempts);
    const latest = await getJob(leased.jobId);
    if (latest?.state === 'failed') {
      await syncScanStateFromJob(leased.jobId, 'failed', `${error.name}: ${error.message}`);
    }
  } finally {
    clearInterval(beat);
  }
  return true;
}

export async function processSingleJob(leaseOwner = `worker-test-${randomUUID()}`) {
  for (const type of Object.keys(handlers) as JobType[]) {
    const leased = await leaseNextJob(leaseOwner, [type]);
    if (!leased) continue;
    await executeLeasedJob(leaseOwner, leased);
    return true;
  }
  return false;
}

export async function runWorkerLoop() {
  const leaseOwner = `worker-${randomUUID()}`;
  const limiter = new InflightLimiter();

  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (limiter.count >= limits.queueMaxInflight) {
      await new Promise((resolve) => setTimeout(resolve, limits.pollIntervalMs));
      continue;
    }

    let scheduled = false;
    for (const type of Object.keys(handlers) as JobType[]) {
      if (!limiter.canRun(type)) continue;
      const leased = await leaseNextJob(leaseOwner, [type]);
      if (!leased) continue;

      scheduled = true;
      limiter.start(type);

      void executeLeasedJob(leaseOwner, leased).finally(() => {
        limiter.finish(leased.jobType);
      });
    }

    if (!scheduled) {
      await new Promise((resolve) => setTimeout(resolve, limits.pollIntervalMs));
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runWorkerLoop().catch((error) => {
    console.error('Worker exited due to unhandled error', error);
    process.exit(1);
  });
}
