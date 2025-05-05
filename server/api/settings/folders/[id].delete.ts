// server/api/settings/folders/[id].delete.ts
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { defineEventHandler, createError, getRouterParam } from 'h3';
import { z } from 'zod';

// Schema to validate the ID parameter
const IdParamSchema = z.coerce.number().int().positive({ message: "Folder ID must be a positive integer" });

export default defineEventHandler(async (event) => {
  try {
    // Get the folder ID from the route parameter
    const folderIdParam = getRouterParam(event, 'id');

    // Validate the ID
    const validationResult = IdParamSchema.safeParse(folderIdParam);
    if (!validationResult.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid Folder ID parameter',
        data: validationResult.error.errors,
      });
    }

    const folderId = validationResult.data;

    // Attempt to delete the folder from the database
    const result = await db.delete(mediaFolders).where(eq(mediaFolders.id, folderId)).returning({ id: mediaFolders.id });

    // Check if a folder was actually deleted (result array will have one element if successful)
    if (result.length === 0) {
      throw createError({
        statusCode: 404, // Not Found
        statusMessage: `Media folder with ID ${folderId} not found.`,
      });
    }

    // Return success response
    return { success: true, message: `Folder with ID ${folderId} deleted successfully.` };

  } catch (error: any) {
    console.error(`Error deleting media folder with ID:`, error);

    // If it's already an H3Error, rethrow it, otherwise wrap it
    if (error.statusCode) {
      throw error;
    } else {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to delete media folder',
      });
    }
  }
});
