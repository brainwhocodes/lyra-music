import { db } from '~/server/db'
import { artists } from '~/server/db/schema'
import { sql } from 'drizzle-orm'
import type { H3Event } from 'h3'

/**
 * @description Fetches a list of all unique artists.
 *              TODO: Consider adding counts (albums/tracks) and pagination.
 */
export default defineEventHandler(async (event: H3Event) => {
  // Authentication check (optional for browsing, but good practice)
  const user = event.context.user
  if (!user || !user.userId) {
    // Decide if browsing artists requires login. For now, let's allow it.
    // console.log('No user context found, allowing anonymous access to artists');
    // If login IS required, uncomment below:
    // throw createError({
    //   statusCode: 401,
    //   statusMessage: 'Unauthorized: Authentication required.'
    // });
  }

  try {
    // Fetch all artists, ordered by name (case-insensitive)
    const artistList = await db
      .select({
        id: artists.id,
        name: artists.name,
        // TODO: Add album count / track count later via subqueries or joins
      })
      .from(artists)
      .orderBy(sql`lower(${artists.name})`)

    return artistList;

  } catch (error: any) {
    console.error('Error fetching artists:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not fetch artists.'
    })
  }
})
