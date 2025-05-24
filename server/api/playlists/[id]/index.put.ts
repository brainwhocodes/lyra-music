import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { db } from '~/server/db';
import { playlists } from '~/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

interface UpdatePlaylistBody {
  name: string;
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');
  const body = await readBody<UpdatePlaylistBody>(event);

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
  if (!body.name?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Playlist name is required',
    });
  }

  try {
    // Check if the playlist exists and belongs to the user
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

    // Check if a different playlist with the same name already exists for this user
    const duplicatePlaylist = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.userId, user.userId),
          eq(playlists.name, body.name.trim()),
          // @ts-ignore - drizzle-orm needs better type support for not()
          playlists.playlistId !== playlistId
        )
      )
      .get();

    if (duplicatePlaylist) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A playlist with this name already exists',
      });
    }

    // Update the playlist
    const updatedPlaylist = await db
      .update(playlists)
      .set({
        name: body.name.trim(),
        updatedAt: sql`CURRENT_TIMESTAMP`,
      })
      .where(
        and(
          eq(playlists.playlistId, playlistId),
          eq(playlists.userId, user.userId)
        )
      )
      .returning()
      .get();

    return updatedPlaylist;
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error updating playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update playlist',
    });
  }
});
