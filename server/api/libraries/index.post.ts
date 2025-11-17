import { z } from 'zod'
import { db } from '~/server/db'
import { mediaFolders } from '~/server/db/schema'
import type { H3Event } from 'h3'
import { v7 as uuidv7 } from 'uuid';
// Input schema validation
const librarySchema = z.object({
  path: z.string().min(1, 'Path cannot be empty')
})

export default defineEventHandler(async (event: H3Event) => {

  const user = await getUserFromEvent(event);

  // 2. Read and validate request body
  const body = await readValidatedBody(event, body => librarySchema.safeParse(body))

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid library path provided.',
      data: body.error.format()
    })
  }

  const libraryPath = body.data.path

  // TODO: Add server-side validation to check if the path is a valid and accessible directory.
  // This is crucial for security and functionality but depends on the deployment environment.
  // For now, we'll just store the path as provided.

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User not found.'
    })
  }

  try {
    // 3. Insert into database
    const [newLibrary] = await db
      .insert(mediaFolders)
      .values({
        mediaFolderId: uuidv7(),
        path: libraryPath,
        userId: user.userId
      })
      .returning()

    if (!newLibrary) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error: Failed to create library entry.'
      })
    }

    console.log(`Library added: ${libraryPath}`)
    
    // Set status code to 201 Created
    setResponseStatus(event, 201)

    // 4. Return the newly created library entry
    return newLibrary

  } catch (error: any) {
    // Handle potential database errors (e.g., unique constraint if a user tries to add the same path twice)
    // Drizzle doesn't throw specific error types easily, so checking message might be needed
    if (error.message?.includes('UNIQUE constraint failed')) {
       throw createError({
         statusCode: 409, // Conflict
         statusMessage: 'Conflict: This library path has already been added.'
       })
    }
    
    console.error('Error adding library:', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not add library to database.'
    })
  }
})
