import { defineEventHandler, createError } from 'h3';
import { desc, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const folders = db.select({
    mediaFolderId: mediaFolders.mediaFolderId,
    path: mediaFolders.path,
    label: mediaFolders.label,
    createdAt: mediaFolders.createdAt,
  }).from(mediaFolders).where(eq(mediaFolders.userId, user.userId))
    .orderBy(desc(mediaFolders.createdAt)).all();
  return { success: true, folders };
});
