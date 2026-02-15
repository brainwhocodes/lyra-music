import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { batchMap } from '~/utils/concurrency';
import { desc, eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';
import { enqueueScanForLibrary } from '~/server/services/scanner/enqueue';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const folders = await db.select({ mediaFolderId: mediaFolders.mediaFolderId })
    .from(mediaFolders)
    .where(eq(mediaFolders.userId, user.userId))
    .orderBy(desc(mediaFolders.createdAt));

  const queued = await batchMap(folders, 3, async (folder) => {
    return enqueueScanForLibrary({ libraryId: folder.mediaFolderId, options: {} }, user.userId);
  });

  setResponseStatus(event, 202);
  return {
    success: true,
    message: `Queued ${queued.length} scan job(s).`,
    scans: queued.map((q) => ({ scanId: q.scanId, jobId: q.jobId })),
  };
});
