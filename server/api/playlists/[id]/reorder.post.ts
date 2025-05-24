import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks } from '~/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

interface ReorderTracksBody {
  trackIds: string[];
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');
  const body = await readBody<ReorderTracksBody>(event);

  if (!playlistId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Playlist ID is required',
    });
  }

  if (!body.trackIds || !Array.isArray(body.trackIds) || body.trackIds.length === 0) {
    throw createError({
      statusCode: 400,
      statusMessage: 'At least one track ID is required',
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
    const playlist = await db
      .select()
      .from(playlists)
      .where(
        and(
          eq(playlists.playlistId, playlistId),
          eq(playlists.userId, user.userId)
        )
      )
      .get();

    if (!playlist) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Playlist not found',
      });
    }

    // Get all current playlist tracks
    const currentTracks = await db
      .select({
        playlistTrackId: playlistTracks.playlistTrackId,
        trackId: playlistTracks.trackId,
      })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId));

    const currentTrackIds = new Set(currentTracks.map(t => t.trackId));
    const validTrackIds = body.trackIds.filter(id => currentTrackIds.has(id));

    // Check if all provided track IDs exist in the playlist
    if (validTrackIds.length !== body.trackIds.length) {
      const invalidTrackIds = body.trackIds.filter(id => !currentTrackIds.has(id));
      throw createError({
        statusCode: 400,
        statusMessage: `The following track IDs are not in this playlist: ${invalidTrackIds.join(', ')}`,
      });
    }

    // Check if all playlist tracks are included in the new order
    if (validTrackIds.length !== currentTrackIds.size) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Must include all playlist tracks in the new order',
      });
    }

    // Update the order of tracks in a transaction
    await db.transaction(async (tx) => {
      
      // First, update all tracks to have a temporary order value
      await tx
        .update(playlistTracks)
        .set({ order: -1, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(playlistTracks.playlistId, playlistId));
      
      // Then set the new order based on the provided trackIds array
      for (let i = 0; i < validTrackIds.length; i++) {
        const trackId = validTrackIds[i];
        await tx
          .update(playlistTracks)
          .set({ 
            order: i + 1, // 1-based index
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(
            and(
              eq(playlistTracks.playlistId, playlistId),
              eq(playlistTracks.trackId, trackId)
            )
          );
      }
    });

    // Update the playlist's updated_at timestamp
    await db
      .update(playlists)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(playlists.playlistId, playlistId));

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error reordering playlist tracks:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to reorder playlist tracks',
    });
  }
});
