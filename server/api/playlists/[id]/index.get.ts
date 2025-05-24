import { defineEventHandler, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks, tracks, albums, artists } from '~/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';
import { Album } from '~/types/album';

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
    // Get the playlist
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

    // Get all tracks in the playlist with their album and artist info
    const playlistTrackResults = await db
      .select({
        playlistTrackId: playlistTracks.playlistTrackId,
        order: playlistTracks.order,
        track: {
          trackId: tracks.trackId,
          title: tracks.title,
          duration: tracks.duration,
          trackNumber: tracks.trackNumber,
          filePath: tracks.filePath,
          // Flatten album and artist properties directly into the track
          albumId: albums.albumId,
          albumTitle: albums.title,
          coverPath: albums.coverPath,
          artistId: artists.artistId,
          artistName: artists.name,
        },
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.trackId, tracks.trackId))
      .innerJoin(albums, eq(tracks.albumId, albums.albumId))
      .innerJoin(artists, eq(albums.artistId, artists.artistId))
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(asc(playlistTracks.order));

    return {
      ...playlist,
      tracks: playlistTrackResults.map(({ track, playlistTrackId, order }) => ({
        ...track,
        playlistTrackId,
        order,
      })),
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error fetching playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch playlist',
    });
  }
});
