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
    const baseSelectFields = {
      albumId: albums.albumId,
      title: albums.title,
      coverPath: albums.coverPath,
      createdAt: albums.createdAt,
      year: albums.year
    };

    let queryBuilder;
    // Initialize conditions with the mandatory user ID filter
    const conditions: SQL[] = [eq(albums.userId, user.userId)];

    if (titleFilter) {
      conditions.push(like(albums.title, `%${titleFilter}%`));
    }

    if (genreFilter) {
      // If genreFilter is active, join with tracks and use selectDistinct
      queryBuilder = db.selectDistinct(baseSelectFields)
        .from(albums)
        .leftJoin(tracks, eq(albums.albumId, tracks.albumId));
      conditions.push(eq(tracks.genre, genreFilter));
    } else {
      // If no genreFilter, select directly from albums without a join or distinct
      queryBuilder = db.select(baseSelectFields)
        .from(albums);
    }

    // Apply all collected conditions and ordering
    const finalQuery = queryBuilder
      .where(and(...conditions))
      .orderBy(asc(albums.title));

    const filteredAlbums = await finalQuery.all();

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
      const currentAlbumId = link.albumId!;
      if (!albumArtistsMap.has(currentAlbumId)) {
        albumArtistsMap.set(currentAlbumId, []);
      }
      albumArtistsMap.get(currentAlbumId)!.push({
        artistId: link.artistId,
        name: link.name,
        role: link.role ?? undefined, // Use nullish coalescing
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
    // Log more detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error fetching albums: ${errorMessage}`, { originalError: error });
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums' // Keep user-facing message generic
    });
  }
});
