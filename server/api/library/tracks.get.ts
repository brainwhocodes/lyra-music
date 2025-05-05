// server/api/library/tracks.get.ts
import { defineEventHandler, getQuery, createError } from 'h3' // Added createError
import { db } from '~/server/db'
import { tracks, artists, albums } from '~/server/db/schema'
import { sql, eq, and, or, like, SQL, asc } from 'drizzle-orm' // Import necessary Drizzle operators & asc

export default defineEventHandler(async (event) => {
  // Get filter parameters from the query string
  const query = getQuery(event)

  const titleFilter = query.title as string | undefined;
  const artistNameFilter = query.artistName as string | undefined;
  const albumTitleFilter = query.albumTitle as string | undefined;
  const genreFilter = query.genre as string | undefined;

  // Define the selection structure
  const selection = {
      id: tracks.id,
      title: tracks.title,
      genre: tracks.genre,
      duration: tracks.duration,
      trackNumber: tracks.trackNumber,
      path: tracks.path,
      createdAt: tracks.createdAt,
      albumTitle: albums.title, // Select album title
      albumId: albums.id,       // Select album id
      artistName: artists.name, // Select artist name
      artistId: artists.id      // Select artist id
  };

  // Start building the query
  // Need to explicitly type the query builder due to dynamic where clause
  let dbQuery = db.select(selection)
    .from(tracks)
    .leftJoin(albums, eq(tracks.albumId, albums.id))
    .leftJoin(artists, eq(tracks.artistId, artists.id));

  // Dynamically build the WHERE clause
  const conditions: SQL[] = [];

  if (titleFilter) {
    // Use 'like' for partial matching, case-insensitive if possible (depends on DB collation)
    // SQLite's default LIKE is case-insensitive for ASCII
    conditions.push(like(tracks.title, `%${titleFilter}%`));
  }
  if (genreFilter) {
    // Check if genre is not null before applying like
     conditions.push(like(tracks.genre, `%${genreFilter}%`));
  }
   if (albumTitleFilter) {
    // Need the join to albums table
     // Check if album title is not null before applying like
     conditions.push(like(albums.title, `%${albumTitleFilter}%`));
  }
   if (artistNameFilter) {
    // Need the join to artists table
     // Check if artist name is not null before applying like
     conditions.push(like(artists.name, `%${artistNameFilter}%`));
  }

  // Apply conditions if any exist
  if (conditions.length > 0) {
    // Apply where clause to the query builder instance
    // We need to cast dbQuery back to the correct type after applying .where()
    // This is a bit of a workaround for Drizzle's dynamic query typing
    dbQuery = dbQuery.where(and(...conditions)) as typeof dbQuery;
  }

  // Add default ordering (e.g., by artist, then album, then track number)
  // Similarly, cast after orderBy
  dbQuery = dbQuery.orderBy(
    asc(artists.name),
    asc(albums.title),
    asc(tracks.trackNumber)
  ) as typeof dbQuery;

  try {
    // Execute the final query
    const filteredTracks = await dbQuery.all(); // Use .all() for better-sqlite3
    return filteredTracks;
  } catch (error) {
    console.error('Error fetching tracks:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch tracks'
    });
  }
});
