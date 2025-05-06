import { H3Event } from 'h3';
import { z } from 'zod';
import { db } from '~/server/db'; 
import { albums, artists, tracks } from '~/server/db/schema'; 
import { eq, asc, inArray, isNotNull, ne, and, sql, distinct } from 'drizzle-orm';

// Define the expected structure for the response
const GenreDetailsSchema = z.object({
  name: z.string(),
  albums: z.array(z.object({
    id: z.number(),
    title: z.string(),
    year: z.number().nullable(),
    cover_path: z.string().nullable(),
    artist_id: z.number(),
    artist_name: z.string()
  }))
});

export default defineEventHandler(async (event: H3Event) => {
  const genreNameParam = event.context.params?.name;

  if (!genreNameParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Genre name is required',
    });
  }

  const genreName = decodeURIComponent(genreNameParam);

  // Fetch albums associated with the genre
  // Step 1: Find distinct album IDs from tracks matching the genre
  let albumIds: number[];
  try {
    const albumIdObjects = await db.selectDistinct({
        albumId: tracks.albumId
      })
      .from(tracks)
      .where(
        and(
          isNotNull(tracks.albumId), // Ensure albumId is not null
          isNotNull(tracks.genre),
          ne(tracks.genre, ''),
          // Case-insensitive comparison for genre
          eq(sql`lower(${tracks.genre})`, genreName.toLowerCase())
        )
      )
      .all(); // Use .all() for better-sqlite3

    // Extract the IDs
    albumIds = albumIdObjects.map(item => item.albumId).filter(id => id !== null) as number[];

  } catch (dbError) {
    console.error(`Error fetching album IDs for genre '${genreName}':`, dbError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch album list for genre',
    });
  }

  // Step 2: Fetch album details for the found album IDs
  let albumsData: any[] = [];
  if (albumIds.length > 0) {
    try {
      albumsData = await db.select({
          id: albums.id,
          title: albums.title,
          year: albums.year,
          cover_path: albums.coverPath, // Adjust column name
          artist_id: albums.artistId,
          artist_name: artists.name
        })
        .from(albums)
        .leftJoin(artists, eq(albums.artistId, artists.id))
        .where(inArray(albums.id, albumIds))
        .orderBy(asc(albums.year)); // Order albums by year
    } catch (dbError) {
      console.error(`Error fetching album details for genre '${genreName}':`, dbError);
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to fetch album details for genre',
      });
    }
  }

  // Combine and format the response
  const result = {
    name: genreName,
    albums: albumsData?.map(album => ({
      id: album.id,
      title: album.title,
      year: album.year,
      cover_path: album.cover_path,
      artist_id: album.artist_id,
      artist_name: album.artist_name ?? 'Unknown Artist'
    })) ?? []
  };

  // Validate the result against the schema
  try {
    GenreDetailsSchema.parse(result);
    return result;
  } catch (validationError) {
    console.error("API Response Validation Error:", validationError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error: Invalid data format',
    });
  }
});
