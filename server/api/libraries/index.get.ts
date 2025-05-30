import { db } from '~/server/db'
import { mediaFolders } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import type { H3Event } from 'h3'
import { getUserFromEvent } from '~/server/utils/auth'

export default defineEventHandler(async (event: H3Event) => {
  // 1. Ensure user is authenticated
  const user = await getUserFromEvent(event)
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    })
  }

  try {
    // 2. Query the database for libraries belonging to the user
    const userLibraries = await db
      .select()
      .from(mediaFolders)
      .where(eq(mediaFolders.userId, user.userId))
      .orderBy(mediaFolders.createdAt)

    console.log(`Retrieved ${userLibraries.length} libraries for user ${user.userId}`)

    // 3. Return the list of libraries
    return userLibraries

  } catch (error: any) {
    console.error('Error retrieving libraries:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not retrieve libraries.'
    })
  }
})
