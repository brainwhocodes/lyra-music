import { defineEventHandler, getRouterParam, readBody } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks, tracks, artists, albums } from '~/server/db/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

interface RemovePlaylistTracksBody {
  trackIds: string[];
}

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');
  const body = await readBody<RemovePlaylistTracksBody>(event);

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

    // First get all remaining tracks ordered by their current order
    const remainingTracks = await db
      .select()
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.order);
    
    // Then update each track with a new sequential order
    for (let i = 0; i < remainingTracks.length; i++) {
      await db
        .update(playlistTracks)
        .set({
          order: i,
          updatedAt: sql`CURRENT_TIMESTAMP`
        })
        .where(
          and(
            eq(playlistTracks.playlistId, playlistId),
            eq(playlistTracks.playlistTrackId, remainingTracks[i].playlistTrackId)
          )
        );
    }

    // Update the playlist's updated_at timestamp
    await db
      .update(playlists)
      .set({ updatedAt: sql`CURRENT_TIMESTAMP` })
      .where(eq(playlists.playlistId, playlistId));

    // Get the updated playlist with tracks
    const updatedPlaylist = await db
      .select({
        playlistId: playlists.playlistId,
        name: playlists.name,
        userId: playlists.userId,
        createdAt: playlists.createdAt,
        updatedAt: playlists.updatedAt,
      })
      .from(playlists)
      .where(eq(playlists.playlistId, playlistId))
      .get();

    // Get the tracks for the playlist with their details
    const playlistTracksList = await db
      .select({
        playlistTrackId: playlistTracks.playlistTrackId,
        playlistId: playlistTracks.playlistId,
        order: playlistTracks.order,
        addedAt: playlistTracks.addedAt,
        updatedAt: playlistTracks.updatedAt,
      })
      .from(playlistTracks)
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(playlistTracks.order);
      
    // Fetch track details for each playlist track
    const playlistTracksWithDetails = await Promise.all(
      playlistTracksList.map(async (playlistTrack) => {
        // Get the trackId from the playlist track
        const playlistTrackRecord = await db
          .select({ trackId: playlistTracks.trackId })
          .from(playlistTracks)
          .where(eq(playlistTracks.playlistTrackId, playlistTrack.playlistTrackId))
          .get();
        
        if (!playlistTrackRecord) {
          return {
            ...playlistTrack,
            track: null,
          };
        }
        
        // Get the track with all necessary fields explicitly selected
        const trackData = await db
          .select({
            trackId: tracks.trackId,
            title: tracks.title,
            artistId: tracks.artistId,
            albumId: tracks.albumId,
            trackNumber: tracks.trackNumber,
            diskNumber: tracks.diskNumber,
            duration: tracks.duration,
            explicit: tracks.explicit,
            filePath: tracks.filePath,
            createdAt: tracks.createdAt,
            updatedAt: tracks.updatedAt
          })
          .from(tracks)
          .where(eq(tracks.trackId, playlistTrackRecord.trackId))
          .get();
          
        // Get additional track data from related tables
        const artistData = trackData ? await db
          .select({
            artistId: artists.artistId,
            name: artists.name
          })
          .from(artists)
          .where(eq(artists.artistId, trackData.artistId || ''))
          .get() : null;
          
        const albumData = trackData ? await db
          .select({
            albumId: albums.albumId,
            title: albums.title,
            coverPath: albums.coverPath
          })
          .from(albums)
          .where(eq(albums.albumId, trackData.albumId || ''))
          .get() : null;
          
        // Combine all data into a complete track object
        const track = trackData ? {
          ...trackData,
          artistName: artistData?.name || '',
          albumTitle: albumData?.title || '',
          coverPath: albumData?.coverPath || null,
        } : null;
          
        return {
          ...playlistTrack,
          track,
        };
      })
    );

    return {
      ...updatedPlaylist,
      tracks: playlistTracksWithDetails,
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error removing tracks from playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to remove tracks from playlist',
    });
  }
});
