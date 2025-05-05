// server/api/library/genres.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { tracks } from '~/server/db/schema'
import { asc, isNotNull, ne, and } from 'drizzle-orm' // Import needed operators

export default defineEventHandler(async (event) => {
  // TODO: Add pagination later if needed

  try {
    // Select distinct, non-null, non-empty genres from the tracks table
    const allGenreObjects = await db.selectDistinct({
        genre: tracks.genre
      })
      .from(tracks)
      .where(
        and(
          isNotNull(tracks.genre),
          ne(tracks.genre, '')
        )
      )
      .orderBy(asc(tracks.genre))
      .all(); // Use .all() for better-sqlite3

    // Extract the genre strings from the result objects
    const genreList = allGenreObjects.map(item => item.genre);

    return genreList;
  } catch (error) {
    console.error('Error fetching genres:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch genres'
    });
  }
});
