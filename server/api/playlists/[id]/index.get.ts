import { defineEventHandler, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks, tracks, albums, artists } from '~/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';
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
    // Get the playlist
    const playlist = await db
      .select({
        playlistId: playlists.playlistId,
      })
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
        // Flattened track properties
        trackId: tracks.trackId,
        title: tracks.title,
        duration: tracks.duration,
        trackNumber: tracks.trackNumber,
        filePath: tracks.filePath,
        albumId: albums.albumId,
        albumTitle: albums.title,
        coverPath: albums.coverPath,
        artistId: artists.artistId,
        artistName: artists.name,
      })
      .from(playlistTracks)
      .innerJoin(tracks, eq(playlistTracks.trackId, tracks.trackId)) // A playlist track must have a corresponding track
      .leftJoin(albums, eq(tracks.albumId, albums.albumId))         // A track might not have an album
      .leftJoin(artists, eq(tracks.artistId, artists.artistId))     // A track might not have an artist / artistId could be null
      .where(eq(playlistTracks.playlistId, playlistId))
      .orderBy(asc(playlistTracks.order));

    return {
      ...playlist,
      trackCount: playlistTrackResults.length,
      tracks: playlistTrackResults.map(item => ({
        playlistTrackId: item.playlistTrackId,
        order: item.order,
        track: {
          trackId: item.trackId,
          title: item.title,
          duration: item.duration,
          trackNumber: item.trackNumber,
          filePath: item.filePath,
          albumId: item.albumId,
          albumTitle: item.albumTitle,
          coverPath: item.coverPath,
          artistId: item.artistId,
          artistName: item.artistName,
        },
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
