// server/api/genres/index.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { genres, albumGenres, albums } from '~/server/db/schema'
import { asc, sql, count, eq } from 'drizzle-orm'

// Define the expected structure for the response items
interface GenreResponseItem {
  genreId: string;
  name: string;
  albumCount: number;
}

export default defineEventHandler(async (event) => {
  try {
    const genresWithCounts: GenreResponseItem[] = await db
      .select({
        genreId: genres.genreId,
        name: genres.name,
        albumCount: count(albumGenres.albumId) // Count albums linked to this genre
      })
      .from(genres)
      .leftJoin(albumGenres, eq(genres.genreId, albumGenres.genreId)) // Left join to count albums
      .groupBy(genres.genreId, genres.name)
      .orderBy(asc(sql`lower(${genres.name})`)) // Case-insensitive sort by name
      .all();

    return genresWithCounts;
  } catch (error: any) {
    console.error('Error fetching genres with album counts:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch genres with album counts'
    });
  }
});