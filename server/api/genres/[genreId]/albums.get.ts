// server/api/genres/[genreId]/albums.get.ts
import { defineEventHandler, createError, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { albums, artists, albumGenres, genres as genresTable, albumArtists } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { Album } from '~/types/album';

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
    const albumsData = await db
      .select({
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt,
        artistName: sql<string>`coalesce(${artists.name}, 'Unknown Artist')`,
        artistId: artists.artistId,
      })
      .from(albums)
      .innerJoin(albumGenres, eq(albums.albumId, albumGenres.albumId))
      .innerJoin(genresTable, eq(albumGenres.genreId, genresTable.genreId))
      .leftJoin(albumArtists, eq(albums.albumId, albumArtists.albumId))
      .leftJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .where(eq(genresTable.genreId, genreIdParam))
      .orderBy(albums.title)
      .all();

    console.log(`[API /genres/${genreIdParam}/albums] Raw albumsData from DB:`, JSON.stringify(albumsData, null, 2));

    if (!albumsData || albumsData.length === 0) { 
        console.log(`[API /genres/${genreIdParam}/albums] No albums found for this genre.`);
        return [];
    }
    
    const albumsForGenre: Album[] = albumsData.map(data => ({
      albumId: data.albumId,
      title: data.title,
      artistId: data.artistId,
      artistName: data.artistName,
      year: data.year,
      coverPath: data.coverPath,
      musicbrainzReleaseId: data.musicbrainzReleaseId,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    }));

    console.log(`[API /genres/${genreIdParam}/albums] Mapped albumsForGenre:`, JSON.stringify(albumsForGenre, null, 2));
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
