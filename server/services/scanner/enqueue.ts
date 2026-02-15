import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { mediaFolders, scanRuns } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { enqueueJob } from '~/server/jobs/queue';
import type { z } from 'zod';
import { startScanSchema } from './schemas';

export async function enqueueScanForLibrary(input: z.infer<typeof startScanSchema>, userId: string) {
  const [library] = await db.select({ mediaFolderId: mediaFolders.mediaFolderId, path: mediaFolders.path })
    .from(mediaFolders)
    .where(and(eq(mediaFolders.mediaFolderId, input.libraryId), eq(mediaFolders.userId, userId)))
    .limit(1);

  if (!library) {
    throw createError({ statusCode: 404, statusMessage: 'Library not found or access denied.' });
  }

  const scanId = uuidv7();
  const enqueue = await enqueueJob({
    type: 'scan.directory',
    payload: {
      scanId,
      userId,
      rootPath: library.path,
      allowedRoots: [library.path],
      options: input.options,
    },
  });

  if (!enqueue.queued) {
    throw createError({ statusCode: 429, statusMessage: 'Scan queue is full. Please retry later.' });
  }

  await db.insert(scanRuns).values({
    scanId,
    jobId: enqueue.jobId,
    userId,
    rootPath: library.path,
    state: 'queued',
  });

  return { scanId, jobId: enqueue.jobId, path: library.path };
}
