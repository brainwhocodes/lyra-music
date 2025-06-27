import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { artists, artistUsers, albumArtists, albums, artistsTracks, tracks } from '~/server/db/schema';
import { asc, eq, and, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    })
  }

  try {
    const trackAlbums = alias(albums, 'trackAlbums');

    const results = await db
      .select({
        artistId: artists.artistId,
        artistName: artists.name,
        artistImage: artists.artistImage,
        albumCount: sql<number>`COUNT(DISTINCT ${albums.albumId})`,
        trackCount: sql<number>`COUNT(DISTINCT ${tracks.trackId})`,
      })
      .from(artists)
      .innerJoin(artistUsers, eq(artists.artistId, artistUsers.artistId))
      .leftJoin(albumArtists, eq(artists.artistId, albumArtists.artistId))
      .leftJoin(
        albums,
        and(eq(albumArtists.albumId, albums.albumId), eq(albums.userId, user.userId))
      )
      .leftJoin(artistsTracks, eq(artists.artistId, artistsTracks.artistId))
      .leftJoin(tracks, eq(artistsTracks.trackId, tracks.trackId))
      .leftJoin(
        trackAlbums,
        and(eq(tracks.albumId, trackAlbums.albumId), eq(trackAlbums.userId, user.userId))
      )
      .where(eq(artistUsers.userId, user.userId))
      .groupBy(artists.artistId, artists.name, artists.artistImage)
      .orderBy(asc(artists.name))
      .all();

    return results;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artists',
    });
  }
});
