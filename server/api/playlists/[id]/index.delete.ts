import { defineEventHandler, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { playlists } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');

  if (!playlistId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Playlist ID is required',
    });
  }
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }
  try {
    // Verify the playlist exists and belongs to the user
    const existingPlaylist = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.playlistId, playlistId),
          eq(playlists.userId, user.userId)
        )
      )
      .get();

    if (!existingPlaylist) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Playlist not found',
      }); 
    }


    // Delete the playlist (cascade will handle the playlist_tracks entries)
    await db
      .delete(playlists)
      .where(
        and(
          eq(playlists.playlistId, playlistId),
          eq(playlists.userId, user?.userId)
        )
      )
      .run();

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error deleting playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to delete playlist',
    });
  }
});
