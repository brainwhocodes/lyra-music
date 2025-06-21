// server/api/genres/[genreId]/albums.get.ts
import { defineEventHandler, createError, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { albums, artists, albumGenres, genres as genresTable, albumArtists } from '~/server/db/schema';
import { eq, inArray } from 'drizzle-orm';
import type { AlbumArtistDetail } from '~/types/album';
import { useCoverArt } from '~/composables/use-cover-art';

export default defineEventHandler(async (event) => {
  const genreIdParam = getRouterParam(event, 'genreId');
  console.log(`[API /genres/${genreIdParam}/albums] Received request for genreId: ${genreIdParam}`);

  if (!genreIdParam) {
    console.error(`[API /genres/[genreId]/albums] Error: Genre ID is required.`);
    throw createError({
      statusCode: 400,
      message: 'Genre ID is required',
    });
  }

  try {
    const { getCoverArtUrl } = useCoverArt();

    // First, get all album IDs for this genre
    const albumIdsResult = await db
      .selectDistinct({
        albumId: albums.albumId,
      })
      .from(albums)
      .innerJoin(albumGenres, eq(albums.albumId, albumGenres.albumId))
      .innerJoin(genresTable, eq(albumGenres.genreId, genresTable.genreId))
      .where(eq(genresTable.genreId, genreIdParam))
      .all();

    if (!albumIdsResult || albumIdsResult.length === 0) { 
      console.log(`[API /genres/${genreIdParam}/albums] No albums found for this genre.`);
      return [];
    }

    const albumIds = albumIdsResult.map(result => result.albumId);

    // Get album details
    const albumsData = await db
      .select({
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt,
      })
      .from(albums)
      .where(inArray(albums.albumId, albumIds))
      .orderBy(albums.title)
      .all();

    // Get all artist links for these albums
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

    // Create a map of album ID to its artists
    const albumArtistsMap = new Map<string, AlbumArtistDetail[]>();
    for (const link of allAlbumArtistLinks) {
      const currentAlbumId = link.albumId!;
      if (!albumArtistsMap.has(currentAlbumId)) {
        albumArtistsMap.set(currentAlbumId, []);
      }
      albumArtistsMap.get(currentAlbumId)!.push({
        artistId: link.artistId,
        name: link.name,
        role: link.role ?? undefined,
        isPrimaryArtist: link.isPrimaryArtistDb === 1,
      });
    }

    // Map the albums with their artists and format cover paths
    const albumsForGenre = albumsData.map(album => ({
      ...album,
      coverPath: getCoverArtUrl(album.coverPath),
      artists: albumArtistsMap.get(album.albumId!) || [],
    }));

    return albumsForGenre;

  } catch (dbError) {
    console.error(`[API /genres/${genreIdParam}/albums] Database error:`, dbError);
    throw createError({
      statusCode: 500,
      message: 'Error fetching albums for the genre.',
      data: { originalError: (dbError as Error).message }
    });
  }
});
