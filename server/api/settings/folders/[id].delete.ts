import { defineEventHandler, createError, getRouterParam } from 'h3';
import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Folder ID required' });
  const removed = db.delete(mediaFolders).where(and(
    eq(mediaFolders.mediaFolderId, id), eq(mediaFolders.userId, user.userId),
  )).returning({ mediaFolderId: mediaFolders.mediaFolderId }).get();
  if (!removed) throw createError({ statusCode: 404, statusMessage: 'Media folder not found' });
  return { success: true, message: 'Folder removed from the list.' };
});
