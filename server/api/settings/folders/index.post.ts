// server/api/settings/folders/index.post.ts
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { defineEventHandler, readBody, createError } from 'h3';
import { z } from 'zod';
import fs from 'fs/promises'; // Import fs promises API for directory check

// Define schema for request body validation using Zod
const AddFolderSchema = z.object({
  path: z.string().min(1, { message: "Folder path cannot be empty" }),
});

export default defineEventHandler(async (event) => {
  try {
    // Read and validate the request body
    const body = await readBody(event);
    const validationResult = AddFolderSchema.safeParse(body);

    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body',
        data: validationResult.error.errors, // Send validation errors back
      });
    }

    const { path } = validationResult.data;

    // **Security Check:** Basic check if the path looks like a directory path.
    // More robust validation might be needed depending on security requirements.
    // For Windows, check for common invalid characters.
    // For cross-platform, adjust accordingly.
    const invalidChars = /[<>:"|?*]/;
    if (invalidChars.test(path)) {
       throw createError({
        statusCode: 400,
        statusMessage: 'Invalid characters in folder path.',
      });
    }

    // Check if the directory actually exists on the server's filesystem
    try {
      const stats = await fs.stat(path);
      if (!stats.isDirectory()) {
        throw createError({
          statusCode: 400,
          statusMessage: `Path exists but is not a directory: ${path}`,
        });
      }
    } catch (fsError: any) {
       if (fsError.code === 'ENOENT') {
         throw createError({
           statusCode: 400,
           statusMessage: `Directory not found: ${path}`,
         });
       }
       // Rethrow other unexpected fs errors
       throw createError({
           statusCode: 500,
           statusMessage: `Error checking directory path: ${fsError.message}`,
        });
    }

    // Insert the new folder path into the database
    const [newFolder] = await db.insert(mediaFolders).values({ path }).returning();

    // Return the newly created folder object
    return { success: true, folder: newFolder };

  } catch (error: any) {
    // Handle potential unique constraint violation (duplicate path)
    if (error.message?.includes('UNIQUE constraint failed: media_folders.path')) {
      throw createError({
        statusCode: 409, // Conflict
        statusMessage: 'This folder path already exists in the library.',
      });
    }

    // Handle errors thrown by createError or other unexpected errors
    console.error('Error adding media folder:', error);
    // If it's already an H3Error, rethrow it, otherwise wrap it
     if (error.statusCode) {
       throw error;
     } else {
       throw createError({
         statusCode: 500,
         statusMessage: 'Failed to add media folder',
       });
     }
  }
});
