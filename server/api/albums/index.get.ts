// server/api/albums/index.get.ts
import { defineEventHandler, createError, getQuery } from 'h3'
import { db } from '~/server/db'
import { albums, artists, tracks, albumArtists } from '~/server/db/schema';
import type { AlbumArtistDetail } from '~/types/album';
import { eq, asc, like, SQL, and, inArray } from 'drizzle-orm'
import { useCoverArt } from '~/composables/use-cover-art';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const titleFilter = query.title as string | undefined;
  const genreFilter = query.genre as string | undefined;

  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  try {
    // Select basic album info. Artist info will be fetched per album.
    let dbQuery = db.selectDistinct({
      albumId: albums.albumId,
      title: albums.title,
      coverPath: albums.coverPath,
      createdAt: albums.createdAt,
      year: albums.year
    })
      .from(albums)
      // We join tracks only for genre filtering if needed.
      // If genreFilter is not active, this join could be conditional for minor optimization.
      .leftJoin(tracks, eq(albums.albumId, tracks.albumId));

    const conditions: SQL[] = [];
    conditions.push(eq(albums.userId, user?.userId));

    if (titleFilter) {
      conditions.push(like(albums.title, `%${titleFilter}%`));
    }
    if (genreFilter) {
      conditions.push(eq(tracks.genre, genreFilter));
    }

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions)) as typeof dbQuery;
    }

    const filteredAlbums = await dbQuery
      .orderBy(asc(albums.title))
      .all();

    const { getCoverArtUrl } = useCoverArt();
    
    if (filteredAlbums.length === 0) {
      return [];
    }

    const albumIds = filteredAlbums.map(a => a.albumId!);

    const allAlbumArtistLinks = await db
      .select({
        albumId: albumArtists.albumId,
        artistId: artists.artistId,
        name: artists.name,
        role: albumArtists.role,
        isPrimaryArtistDb: albumArtists.isPrimaryArtist,
      })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .where(inArray(albumArtists.albumId, albumIds))
      .all();

    const albumArtistsMap = new Map<string, AlbumArtistDetail[]>();
    for (const link of allAlbumArtistLinks) {
      if (!albumArtistsMap.has(link.albumId!)) {
        albumArtistsMap.set(link.albumId!, []);
      }
      albumArtistsMap.get(link.albumId!)!.push({
        artistId: link.artistId,
        name: link.name,
        role: link.role === null ? undefined : link.role,
        isPrimaryArtist: link.isPrimaryArtistDb === 1,
      });
    }

    const resultAlbums = filteredAlbums.map(album => ({
      ...album,
      coverPath: getCoverArtUrl(album.coverPath),
      artists: albumArtistsMap.get(album.albumId!) || [],
    }));

    return resultAlbums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums'
    });
  }
});
