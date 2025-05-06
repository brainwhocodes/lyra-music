// server/api/genres/index.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { tracks, albums } from '~/server/db/schema'
import { asc, desc, isNotNull, ne, and, eq, sql, countDistinct } from 'drizzle-orm'

// Define the expected structure for the response items
interface GenreItem {
  name: string;
  album_count: number;
}

export default defineEventHandler(async (event) => {
  // TODO: Add pagination later if needed

  try {
    // Select distinct, non-null, non-empty genres and count their distinct albums
    // Join tracks with albums to ensure we only count albums that exist
    const genresWithCounts: GenreItem[] = await db
      .select({
        name: tracks.genre,
        album_count: countDistinct(tracks.albumId) // Count distinct album IDs per genre
      })
      .from(tracks)
      .where(
        and(
          isNotNull(tracks.genre), // Genre must exist
          ne(tracks.genre, '')
          // Optionally add a join to ensure the album exists if desired:
          // eq(tracks.albumId, albums.id) // Uncomment if needed
        )
      )
      .groupBy(tracks.genre)
      .orderBy(asc(sql`lower(${tracks.genre})`)) // Case-insensitive sort
      .all();

    return genresWithCounts;
  } catch (error) {
    console.error('Error fetching genres with counts:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch genres with counts'
    });
  }
});