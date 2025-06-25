import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { albums } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const albumId = getRouterParam(event, 'id');
  const user = await getUserFromEvent(event);

  if (!albumId) {
    throw createError({ statusCode: 400, statusMessage: 'Album ID is required' });
  }

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    const existingAlbum = await db
      .select()
      .from(albums)
      .where(and(eq(albums.albumId, albumId), eq(albums.userId, user.userId)))
      .get();

    if (!existingAlbum) {
      throw createError({ statusCode: 404, statusMessage: 'Album not found' });
    }

    await db
      .delete(albums)
      .where(and(eq(albums.albumId, albumId), eq(albums.userId, user.userId)))
      .run();

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error deleting album:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete album' });
  }
});
