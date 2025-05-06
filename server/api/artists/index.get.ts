// server/api/artists/index.get.ts
import { defineEventHandler, createError } from 'h3'
import { db } from '~/server/db'
import { artists, albums } from '~/server/db/schema' 
import { asc, eq, sql } from 'drizzle-orm' 

export default defineEventHandler(async (event) => {
  // TODO: Add pagination later if needed

  try {
    // Query artists and aggregate their albums into a JSON array
    const artistsWithAlbums = await db
      .select({
        id: artists.id,
        name: artists.name,
        // Aggregate albums into a JSON string
        // Note: Parsing this JSON string might be needed on the client-side
        // or you could use a custom Drizzle type if available/created.
        albumsJson: sql<string>`json_group_array(json_object('id', ${albums.id}, 'title', ${albums.title}, 'artPath', ${albums.artPath})) filter (where ${albums.id} is not null)`,
      })
      .from(artists)
      .leftJoin(albums, eq(artists.id, albums.artistId)) // Join albums to artists
      .groupBy(artists.id, artists.name) // Group by artist
      .orderBy(asc(artists.name)) // Order by artist name
      .all(); // Use .all() for better-sqlite3

    // Parse the JSON string for albums back into an array for each artist
    const result = artistsWithAlbums.map(artist => ({
      ...artist,
      albums: JSON.parse(artist.albumsJson || '[]') // Safely parse JSON
        .filter((album: any) => album.id !== null), // Filter out potential null entries from left join if artist has no albums
      albumsJson: undefined // Remove the raw JSON string
    }));

    return result;
  } catch (error) {
    console.error('Error fetching artists with albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artists'
    });
  }
});
