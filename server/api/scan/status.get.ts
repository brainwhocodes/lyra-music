import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { jobQueue, scanRuns } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const scanId = getQuery(event).scanId as string | undefined;
  if (!scanId) {
    throw createError({ statusCode: 400, statusMessage: 'scanId is required' });
  }

  const rows = await db.select({
    scanId: scanRuns.scanId,
    state: scanRuns.state,
    filesDiscovered: scanRuns.filesDiscovered,
    filesPersisted: scanRuns.filesPersisted,
    batchesFlushed: scanRuns.batchesFlushed,
    errors: scanRuns.errors,
    lastError: scanRuns.lastError,
    progress: jobQueue.progress,
  }).from(scanRuns)
    .innerJoin(jobQueue, eq(scanRuns.jobId, jobQueue.jobId))
    .where(and(eq(scanRuns.scanId, scanId), eq(scanRuns.userId, user.userId)))
    .limit(1);

  const status = rows[0];
  if (!status) {
    throw createError({ statusCode: 404, statusMessage: 'Scan not found' });
  }

  return {
    state: status.state,
    progress: status.progress ? JSON.parse(status.progress) : null,
    counts: {
      filesDiscovered: status.filesDiscovered,
      filesPersisted: status.filesPersisted,
      batchesFlushed: status.batchesFlushed,
      errors: status.errors,
    },
    errors: status.lastError ? [status.lastError] : [],
  };
});
