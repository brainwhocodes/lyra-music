import { realpath } from 'node:fs/promises';
import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { jobQueue, scanRuns } from '~/server/db/schema';
import { limits } from '~/server/jobs/limits';
import { markJobProgress } from '~/server/jobs/queue';
import type { ScanDirectoryJobPayload } from '~/server/jobs/types';
import { ScanBatchWriter } from './persist';
import { runLibraryIngestion } from './ingestion';
import { isPathInsideAllowedRoots } from './path-safety';
import { walkDirectory } from './walk';

export async function runScanDirectoryJob(jobId: string, payload: ScanDirectoryJobPayload, isCancelled: () => Promise<boolean>) {
  const startedAt = new Date().toISOString();
  const rootPath = await realpath(payload.rootPath);
  const allowedRoots = await Promise.all(payload.allowedRoots.map((path) => realpath(path)));

  if (!isPathInsideAllowedRoots(rootPath, allowedRoots)) {
    throw new Error(`Scan path is outside allowed roots: ${rootPath}`);
  }

  await db.update(scanRuns).set({ state: 'running', startedAt, updatedAt: startedAt }).where(eq(scanRuns.scanId, payload.scanId));

  const writer = new ScanBatchWriter(payload.scanId, limits.maxDbBatchSize);
  let discovered = 0;
  let scanErrors = 0;
  let lastScanError: string | null = null;

  const started = Date.now();
  for await (const entry of walkDirectory(rootPath, {
    ...payload.options,
    onError: (error) => {
      scanErrors += 1;
      lastScanError = `${error.code}:${error.path}`;
    },
  })) {
    if (Date.now() - started > limits.maxJobRuntimeMs) {
      throw new Error('Scan job exceeded MAX_JOB_RUNTIME_MS');
    }

    if (await isCancelled()) {
      await db.update(scanRuns)
        .set({
          state: 'cancelled',
          cancelledAt: new Date().toISOString(),
          errors: scanErrors,
          lastError: lastScanError,
          updatedAt: new Date().toISOString(),
        })
        .where(eq(scanRuns.scanId, payload.scanId));
      return { cancelled: true, discovered, errors: scanErrors, ...writer.stats };
    }

    discovered += 1;
    writer.add(entry);

    if (writer.size >= limits.maxDbBatchSize) {
      await writer.flush();
      const progress = { discovered, errors: scanErrors, ...writer.stats };
      await markJobProgress(jobId, progress);
      await db.update(scanRuns).set({
        filesDiscovered: discovered,
        filesPersisted: writer.stats.persisted,
        batchesFlushed: writer.stats.batchesFlushed,
        errors: scanErrors,
        lastError: lastScanError,
        updatedAt: new Date().toISOString(),
      }).where(eq(scanRuns.scanId, payload.scanId));
    }
  }

  await writer.flush();

  if (await isCancelled()) {
    await db.update(scanRuns)
      .set({
        state: 'cancelled',
        cancelledAt: new Date().toISOString(),
        errors: scanErrors,
        lastError: lastScanError,
        updatedAt: new Date().toISOString(),
      })
      .where(eq(scanRuns.scanId, payload.scanId));
    return { cancelled: true, discovered, errors: scanErrors, ...writer.stats };
  }

  const ingestionStats = await runLibraryIngestion({
    libraryId: payload.libraryId,
    libraryPath: rootPath,
    userId: payload.userId,
    processOnlyUnprocessed: payload.processOnlyUnprocessed,
  });

  const finishedAt = new Date().toISOString();
  await db.update(scanRuns).set({
    state: 'succeeded',
    finishedAt,
    filesDiscovered: discovered,
    filesPersisted: writer.stats.persisted,
    batchesFlushed: writer.stats.batchesFlushed,
    errors: scanErrors,
    lastError: lastScanError,
    updatedAt: finishedAt,
  }).where(eq(scanRuns.scanId, payload.scanId));

  const result = { discovered, errors: scanErrors, ...writer.stats, ingestionStats };
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
