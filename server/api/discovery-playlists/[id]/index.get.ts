import { defineEventHandler, getRouterParam } from 'h3';
import { db } from '~/server/db';
import {
  discoveryPlaylists,
  discoveryPlaylistTracks,
  tracks,
  albums,
  artists,
} from '~/server/db/schema';
import { and, eq, asc } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const playlistId = getRouterParam(event, 'id');

  if (!playlistId) {
    throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  }
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    const playlist = await db
      .select({
        discoveryPlaylistId: discoveryPlaylists.discoveryPlaylistId,
        title: discoveryPlaylists.title,
        type: discoveryPlaylists.type,
        seedArtistId: discoveryPlaylists.seedArtistId,
      })
      .from(discoveryPlaylists)
      .where(
        and(
          eq(discoveryPlaylists.discoveryPlaylistId, playlistId),
          eq(discoveryPlaylists.userId, user.userId)
        )
      )
      .get();

    if (!playlist) {
      throw createError({ statusCode: 404, statusMessage: 'Discovery playlist not found' });
    }

    const playlistTrackResults = await db
      .select({
        discoveryPlaylistTrackId: discoveryPlaylistTracks.discoveryPlaylistTrackId,
        order: discoveryPlaylistTracks.order,
        addedAt: discoveryPlaylistTracks.addedAt,
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
      .from(discoveryPlaylistTracks)
      .innerJoin(tracks, eq(discoveryPlaylistTracks.trackId, tracks.trackId))
      .leftJoin(albums, eq(tracks.albumId, albums.albumId))
      .leftJoin(artists, eq(tracks.artistId, artists.artistId))
      .where(eq(discoveryPlaylistTracks.discoveryPlaylistId, playlistId))
      .orderBy(asc(discoveryPlaylistTracks.order));

    return {
      ...playlist,
      trackCount: playlistTrackResults.length,
      tracks: playlistTrackResults.map((item) => ({
        discoveryPlaylistTrackId: item.discoveryPlaylistTrackId,
        discoveryPlaylistId: playlistId,
        order: item.order,
        trackId: item.trackId,
        addedAt: item.addedAt,
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
          artists: [],
          genre: null,
          year: null,
          diskNumber: null,
          explicit: false,
          createdAt: item.addedAt,
          updatedAt: item.addedAt,
        },
      })),
    };
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    console.error('Error fetching discovery playlist:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch discovery playlist',
    });
  }
});
