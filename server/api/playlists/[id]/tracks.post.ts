import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks, tracks } from '~/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { getUserFromEvent } from '~/server/utils/auth';

interface UpdatePlaylistTracksBody {
  action: 'add' | 'remove';
  trackIds: string[];
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');
  const body = await readBody<UpdatePlaylistTracksBody>(event);

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

  if (body.action !== 'add' && body.action !== 'remove') {
    throw createError({
      statusCode: 400,
      statusMessage: 'Action must be either "add" or "remove"',
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

    // Verify all track IDs exist
    const existingTracks = await db
      .select({ trackId: tracks.trackId })
      .from(tracks)
      .where(sql`${tracks.trackId} IN ${body.trackIds}`);

    const existingTrackIds = new Set(existingTracks.map(t => t.trackId));
    const invalidTrackIds = body.trackIds.filter(id => !existingTrackIds.has(id));

    if (invalidTrackIds.length > 0) {
      throw createError({
        statusCode: 400,
        statusMessage: `The following track IDs do not exist: ${invalidTrackIds.join(', ')}`,
      });
    }

    if (body.action === 'add') {
      // Check for existing tracks in the playlist to avoid duplicates
      const existingPlaylistTracks = await db
        .select({ trackId: playlistTracks.trackId })
        .from(playlistTracks)
        .where(
          and(
            eq(playlistTracks.playlistId, playlistId),
            sql`${playlistTracks.trackId} IN ${body.trackIds}`
          )
        );
      
      const existingPlaylistTrackIds = new Set(existingPlaylistTracks.map(pt => pt.trackId));
      const tracksToAdd = body.trackIds.filter(id => !existingPlaylistTrackIds.has(id));
      
      // If all tracks are already in the playlist, return early
      if (tracksToAdd.length === 0) {
        return { message: 'All tracks are already in the playlist' };
      }
      
      // Get current max order to append new tracks at the end
      const maxOrderResult = await db
        .select({ maxOrder: sql<number>`MAX(${playlistTracks.order})` })
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
        .get();
      
      const currentMaxOrder = maxOrderResult?.maxOrder || 0;
      const now = new Date().toISOString();

      // Insert new tracks with sequential order values
      const newPlaylistTracks = tracksToAdd.map((trackId, index) => ({
        playlistTrackId: uuidv7(),
        playlistId,
        trackId,
        order: currentMaxOrder + index + 1,
        addedAt: now,
        updatedAt: now,
      }));

      await db.insert(playlistTracks).values(newPlaylistTracks);
    } else {
      // Remove tracks from the playlist
      await db
        .delete(playlistTracks)
        .where(
          and(
            eq(playlistTracks.playlistId, playlistId),
            sql`${playlistTracks.trackId} IN ${body.trackIds}`
          )
        )
        .run();

      // Reorder remaining tracks to fill gaps
      // First get all remaining tracks ordered by their current order
      const remainingTracks = await db
        .select()
        .from(playlistTracks)
        .where(eq(playlistTracks.playlistId, playlistId))
        .orderBy(playlistTracks.order);
      
      // Then update each track with a new sequential order concurrently
      await Promise.all(
        remainingTracks.map((track, i) =>
          db
            .update(playlistTracks)
            .set({ order: i, updatedAt: new Date().toISOString() })
            .where(
              and(
                eq(playlistTracks.playlistId, playlistId),
                eq(playlistTracks.playlistTrackId, track.playlistTrackId)
              )
            )
        )
      );
    }

    // Update the playlist's updated_at timestamp
    await db
      .update(playlists)
      .set({ updatedAt: new Date().toISOString() })
      .where(eq(playlists.playlistId, playlistId));

    return { success: true };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error updating playlist tracks:', error);
    throw createError({
      statusCode: 500,
      statusMessage: `Failed to ${body.action} tracks from playlist`,
    });
  }
});
