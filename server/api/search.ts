import { defineEventHandler, getQuery, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, playlists, albumArtists } from '~/server/db/schema';
import { eq, like, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';
import type { SearchResults } from '~/types/search';
import type { Album } from '~/types/album';
import type { Artist } from '~/types/artist';
import type { Playlist } from '~/types/playlist';

export default defineEventHandler(async (event): Promise<SearchResults> => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const query = getQuery(event);
  const searchQuery = (query.q as string)?.trim();

  if (!searchQuery) {
    return {
      albums: [],
      artists: [],
      playlists: [],
    };
  }

  const searchPattern = `%${searchQuery}%`;
  const limit = 10;

  try {
    const [foundAlbums, foundArtists, foundPlaylists] = await Promise.all([
      // Search albums
      db.select({
          albumId: albums.albumId,
          title: albums.title,
          coverPath: albums.coverPath,
          year: albums.year
        })
        .from(albums)
        .where(and(
          eq(albums.userId, user.userId),
          like(albums.title, searchPattern)
        ))
        .limit(limit),

      // Search artists
      db.selectDistinct({
          artistId: artists.artistId,
          name: artists.name,
          coverPath: artists.artistImage
        })
        .from(artists)
        .leftJoin(albumArtists, eq(artists.artistId, albumArtists.artistId))
        .leftJoin(albums, eq(albumArtists.albumId, albums.albumId))
        .where(and(
          eq(albums.userId, user.userId),
          like(artists.name, searchPattern)
        ))
        .limit(limit),

      // Search playlists
      db.select({
          playlistId: playlists.playlistId,
          name: playlists.name,
        })
        .from(playlists)
        .where(and(
          eq(playlists.userId, user.userId),
          like(playlists.name, searchPattern)
        ))
        .limit(limit)
    ]);

    return {
      albums: foundAlbums as Album[],
      artists: foundArtists as Artist[],
      playlists: foundPlaylists as Playlist[],
    };

  } catch (err) {
    console.error('Error during global search:', err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error',
    });
  }
});
