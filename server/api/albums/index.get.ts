import { z } from 'zod'
import { db } from '~/server/db'
import { albums, artists } from '~/server/db/schema'
import { eq, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

// Schema to validate optional query parameters
const querySchema = z.object({
  artistId: z.coerce.number().int().positive().optional()
})

/**
 * @description Fetches a list of albums, optionally filtered by artistId.
 *              Includes artist name and album art path.
 *              TODO: Consider adding track counts and pagination.
 */
export default defineEventHandler(async (event: H3Event) => {
  // Authentication check (optional, similar to artists endpoint)
  const user = event.context.user
  // if (!user || !user.userId) {
  //   throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  // }

  // Validate query parameters
  const queryResult = await getValidatedQuery(event, query => querySchema.safeParse(query))

  if (!queryResult.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid query parameters.',
      data: queryResult.error.format()
    })
  }

  const { artistId } = queryResult.data

  try {
    // Base query to select albums and join with artists
    const query = db
      .select({
        id: albums.id,
        title: albums.title,
        year: albums.year,
        artPath: albums.artPath,
        artistId: albums.artistId,
        artistName: artists.name // Select artist name from joined table
      })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.id)) // Left join to include albums even if artist is somehow null
      .orderBy(sql`lower(${albums.title})`); // Order by album title

    // Apply artist filter if artistId is provided
    if (artistId !== undefined) {
      query.where(eq(albums.artistId, artistId))
    }

    const albumList = await query;

    return albumList;

  } catch (error: any) {
    console.error('Error fetching albums:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not fetch albums.'
    })
  }
})
