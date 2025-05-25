import { z } from 'zod'
import { db } from '~/server/db'
import { mediaFolders } from '~/server/db/schema'
import { eq, and } from 'drizzle-orm'
import { scanLibrary } from '~/server/utils/scanner'
import type { H3Event } from 'h3'

// Schema to validate the route parameter
const paramsSchema = z.object({
  libraryId: z.coerce.number().int().positive('Library ID must be a positive integer')
})

export default defineEventHandler(async (event: H3Event) => {
  // 1. Ensure user is authenticated
  const user = event.context.user
  if (!user || !user.userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    })
  }

  // 2. Validate libraryId from route parameters
  const params = await getValidatedRouterParams(event, params => paramsSchema.safeParse(params))

  if (!params.success) {
     throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid Library ID provided in URL.',
      data: params.error.format()
    })
  }

  const libraryId = params.data.libraryId

  try {
    // 3. Verify the library belongs to the user and get its path
    const [library] = await db
      .select({ mediaFolderId: mediaFolders.mediaFolderId, path: mediaFolders.path })
      .from(mediaFolders)
      .where(and(
        eq(mediaFolders.mediaFolderId, String(libraryId)),
        eq(mediaFolders.userId, user.userId)
      ))
      .limit(1)

    if (!library) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Not Found: Library not found or access denied.'
      })
    }

    // 4. Trigger scan asynchronously (fire-and-forget)
    // We don't await this, so the request returns immediately.
    // Error handling within scanLibrary should log issues.
    scanLibrary({
      libraryId: String(library.mediaFolderId),
      libraryPath: library.path,
      userId: user.userId
    })
      .then(() => {
        console.log(`Background scan completed for library ${library.mediaFolderId}`);
      })
      .catch((error) => {
        // Log any unexpected errors from the async scan function itself
        console.error(`Error during background scan execution for library ${library.mediaFolderId}:`, error);
      });

    console.log(`Scan initiated for library ${library.mediaFolderId} by user ${user.userId}`);
    
    // 5. Return success response
    setResponseStatus(event, 202) // 202 Accepted indicates the request is accepted for processing
    return { message: `Scan initiated for library ${library.mediaFolderId}.` }

  } catch (error: any) {
     // Handle errors from DB query or other synchronous parts
     if (error.statusCode) { // Re-throw H3 errors
       throw error;
     }
     console.error(`Error initiating scan for library ${libraryId}:`, error)
     throw createError({
       statusCode: 500,
       statusMessage: 'Internal Server Error: Could not initiate library scan.'
     })
   }
})
