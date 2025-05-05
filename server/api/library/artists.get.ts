// server/api/library/artists.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { artists } from '~/server/db/schema'
import { asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // TODO: Add pagination later if needed

  try {
    // Select distinct artists 
    const allArtists = await db.selectDistinct({
        id: artists.id,
        name: artists.name,
        createdAt: artists.createdAt // Include createdAt if needed
      })
      .from(artists)
      .orderBy(asc(artists.name)) // Order by artist name
      .all(); // Use .all() for better-sqlite3

    return allArtists;
  } catch (error) {
    console.error('Error fetching artists:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artists'
    });
  }
});
