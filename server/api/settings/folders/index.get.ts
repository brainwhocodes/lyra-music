// server/api/settings/folders/index.get.ts
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { defineEventHandler, createError } from 'h3'; // Import createError

export default defineEventHandler(async (event) => {
  try {
    // Fetch all folders from the database, ordered by creation date
    const folders = await db.select().from(mediaFolders).orderBy(mediaFolders.createdAt);
    return { success: true, folders };
  } catch (error: unknown) {
    console.error('Error fetching media folders:', error);
    // Use createError for proper Nuxt error handling
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch media folders',
    });
  }
});
