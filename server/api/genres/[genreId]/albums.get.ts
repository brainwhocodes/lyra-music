// server/api/genres/[genreId]/albums.get.ts
import { defineEventHandler, createError, getRouterParam } from 'h3';
import { db } from '~/server/db';
import { albums, artists, albumGenres, genres as genresTable } from '~/server/db/schema'; // Renamed genres to avoid conflict with a variable
import { eq, sql } from 'drizzle-orm';
import type { Album } from '~/types/album'; // Assuming Album type is in types/track.ts or similar

export default defineEventHandler(async (event) => {
  const genreId = getRouterParam(event, 'genreId');
  console.log(`[API /genres/${genreId}/albums] Received request for genreId: ${genreId}`);

  if (!genreId) {
    console.error(`[API /genres/[genreId]/albums] Error: Genre ID is required.`);
    throw createError({
      statusCode: 400,
      message: 'Genre ID is required',
    });
  }

  try {
    // Fetch albums associated with the genreId
    // Also fetch the artist's name for each album
    const albumsData = await db
      .select({
        // Album fields
        albumId: albums.albumId,
        title: albums.title,
        artistId: albums.artistId,
        year: albums.year,
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt,
        // Artist fields
        artistName: sql<string>`coalesce(${artists.name}, 'Unknown Artist')`,
      })
      .from(albums)
      .innerJoin(albumGenres, eq(albums.albumId, albumGenres.albumId))
      .leftJoin(artists, eq(albums.artistId, artists.artistId)) // Join to get artist name
      .where(eq(albumGenres.genreId, genreId))
      .orderBy(albums.title) // Or artists.name, then albums.title
      .all();

    console.log(`[API /genres/${genreId}/albums] Raw albumsData from DB:`, JSON.stringify(albumsData, null, 2));

    // Map to the desired response structure, ensuring all Album properties are included
    const albumsForGenre: Album[] = albumsData.map(data => ({
      ...data,
      tracks: [], // Add empty tracks array to satisfy the Album type
    }));

    return albumsForGenre;
  } catch (error: any) {
    console.error(`Error fetching albums for genre ID ${genreId}:`, error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums for the genre',
    });
  }
});
