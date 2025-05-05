// server/api/library/albums.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { albums, artists } from '~/server/db/schema'
import { eq, asc } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  // TODO: Add pagination later if needed

  try {
    const allAlbums = await db.select({
        id: albums.id,
        title: albums.title,
        artPath: albums.artPath, // Use correct column name 'artPath'
        createdAt: albums.createdAt,
        artistId: artists.id,
        artistName: artists.name
      })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.id))
      .orderBy(asc(artists.name), asc(albums.title)) // Order by artist, then album title
      .all(); // Use .all() for better-sqlite3

    return allAlbums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums'
    });
  }
});
