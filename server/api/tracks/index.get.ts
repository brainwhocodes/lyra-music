import { z } from 'zod'
import { db } from '~/server/db'
import { tracks, albums, artists } from '~/server/db/schema'
import { eq, and, or, asc, isNull, sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

// Schema to validate optional query parameters
const querySchema = z.object({
  artistId: z.coerce.number().int().positive().optional(),
  albumId: z.coerce.number().int().positive().optional(),
})

/**
 * @description Fetches a list of tracks, optionally filtered by artistId or albumId.
 *              Includes artist name, album title.
 *              TODO: Consider pagination.
 */
export default defineEventHandler(async (event: H3Event) => {
  // Authentication check (optional)
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

  const { artistId, albumId } = queryResult.data

  try {
    // Base query to select tracks and join with albums and artists
    const query = db
      .select({
        id: tracks.id,
        title: tracks.title,
        trackNumber: tracks.trackNumber,
        duration: tracks.duration,
        path: tracks.path, // Include path for potential streaming/download
        genre: tracks.genre,
        albumId: tracks.albumId,
        albumTitle: albums.title,
        albumArtPath: albums.artPath,
        artistId: tracks.artistId,
        artistName: artists.name
      })
      .from(tracks)
      .leftJoin(albums, eq(tracks.albumId, albums.id))
      .leftJoin(artists, eq(tracks.artistId, artists.id))
      // Order by track number (nulls last), then by path as fallback
      .orderBy(asc(tracks.trackNumber), asc(tracks.path));

    // Build filter conditions
    const conditions = []
    if (albumId !== undefined) {
      conditions.push(eq(tracks.albumId, albumId))
    }
    if (artistId !== undefined) {
      conditions.push(eq(tracks.artistId, artistId))
    }

    // Apply filters if any exist
    if (conditions.length > 0) {
        query.where(and(...conditions));
    }

    const trackList = await query;

    return trackList;

  } catch (error: any) {
    console.error('Error fetching tracks:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not fetch tracks.'
    })
  }
})
