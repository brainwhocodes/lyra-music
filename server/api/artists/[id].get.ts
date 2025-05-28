import { H3Event, createError } from 'h3';
import { z } from 'zod';
import { db } from '~/server/db'; 
import { artists, albums, artistUsers } from '~/server/db/schema'; 
import { eq, asc, and, inArray } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

// Define the expected structure for the response
const ArtistDetailsSchema = z.object({
  artistId: z.string(),
  name: z.string(),
  albums: z.array(z.object({
    albumId: z.string(),
    title: z.string(),
    year: z.number().nullable(),
    coverPath: z.string().nullable().optional(),
    artistId: z.string().nullable().optional() // Make it optional and nullable
  }))
});

export default defineEventHandler(async (event: H3Event) => {
  const artistIdParam = event.context.params?.id;
  const user = getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }
  if (!artistIdParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid Artist ID is required',
    });
  }

  const artistId = artistIdParam;
  // Fetch artist details
  let artistData: any;
  try {
    // First, check if this artist is associated with the current user
    const userArtistRelations = await db
      .select()
      .from(artistUsers)
      .where(and(
        eq(artistUsers.artistId, artistId),
        eq(artistUsers.userId, user.userId)
      ));
    
    // If no relation exists, the user doesn't have access to this artist
    if (userArtistRelations.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Artist not found for this user',
      });
    }
    
    // Now fetch the artist details
    artistData = await db.select({
        artistId: artists.artistId,
        name: artists.name
      })
      .from(artists)
      .where(eq(artists.artistId, artistId))
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
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
        artistId: albums.artistId
      })
      .from(albums)
      .where(and(
        eq(albums.artistId, artistId),
        eq(albums.userId, user.userId)
      ))
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
    artistId: artistData.artistId,
    name: artistData.name,
    albums: (albumsData ?? []).map(album => ({
      ...album,
      // Ensure these fields are properly set even if they're null/undefined
      coverPath: album.coverPath ?? null,
      artistId: album.artistId ?? artistId // Default to the parent artist ID if missing
    }))
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
