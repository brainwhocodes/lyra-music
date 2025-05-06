import { H3Event } from 'h3';
import { z } from 'zod';
import { db } from '~/server/db'; 
import { artists, albums } from '~/server/db/schema'; 
import { eq, asc } from 'drizzle-orm';

// Define the expected structure for the response
const ArtistDetailsSchema = z.object({
  id: z.number(),
  name: z.string(),
  albums: z.array(z.object({
    id: z.number(),
    title: z.string(),
    year: z.number().nullable(),
    cover_path: z.string().nullable(),
    artist_id: z.number() // Keep artist_id for consistency
  }))
});

export default defineEventHandler(async (event: H3Event) => {
  const artistIdParam = event.context.params?.id;

  if (!artistIdParam || isNaN(parseInt(artistIdParam))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid Artist ID is required',
    });
  }

  const artistId = parseInt(artistIdParam);

  // Fetch artist details
  let artistData: any;
  try {
    artistData = await db.select({
        id: artists.id,
        name: artists.name
      })
      .from(artists)
      .where(eq(artists.id, artistId))
      .get();

  } catch (dbError) {
    console.error("Error fetching artist details:", dbError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch artist details',
    });
  }

  if (!artistData) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Artist not found',
    });
  }

  // Fetch albums associated with the artist using Drizzle
  let albumsData: any[];
  try {
     albumsData = await db.select({
        id: albums.id,
        title: albums.title,
        year: albums.year,
        cover_path: albums.coverPath, // Adjust column name
        artist_id: albums.artistId
      })
      .from(albums)
      .where(eq(albums.artistId, artistId))
      .orderBy(asc(albums.year)); // Order albums by year

  } catch (dbError) {
    console.error("Error fetching albums for artist:", dbError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch albums for artist',
    });
  }

  // Combine and format the response
  const result = {
    id: artistData.id,
    name: artistData.name,
    albums: albumsData ?? []
  };

  // Validate the result against the schema
  try {
    ArtistDetailsSchema.parse(result);
    return result;
  } catch (validationError) {
    console.error("API Response Validation Error:", validationError);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error: Invalid data format',
    });
  }
});
