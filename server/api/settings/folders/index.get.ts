// server/api/settings/folders/index.get.ts
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { defineEventHandler, createError } from 'h3';
import { desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  try {
    console.log('Fetching media folders...');
    
    const folders = await db
      .select({
        id: mediaFolders.id,
        path: mediaFolders.path,
        createdAt: mediaFolders.createdAt
      })
      .from(mediaFolders)
      .orderBy(desc(mediaFolders.createdAt))
      .all();
    
    console.log(`Successfully fetched ${folders.length} media folders`);
    return { success: true, folders };
  } catch (error: unknown) {
    // Log the full error for debugging
    console.error('Error fetching media folders:', error);
    
    // Use createError for proper Nuxt error handling
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch media folders',
      // Add more details if available
      data: error instanceof Error ? { message: error.message } : undefined
    });
  }
});
