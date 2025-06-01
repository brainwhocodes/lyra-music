import { z } from 'zod';
import { defineEventHandler, createError, readValidatedBody } from 'h3';
import { db } from '~/server/db';
import { mediaFolders, users } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { v7 as uuidv7 } from 'uuid';
import { eq, and } from 'drizzle-orm';

// Input schema validation
const mediaFolderSchema = z.object({
  path: z.string().min(1, 'Path cannot be empty'),
  label: z.string().optional(), // Label is optional
});

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.',
    });
  }

  const body = await readValidatedBody(event, body => mediaFolderSchema.safeParse(body));

  if (!body.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Bad Request: Invalid data provided.',
      data: body.error.format(),
    });
  }

  const { path, label } = body.data;

  // Check if this user already has this path
  try {
    const existingFolder = await db.select()
      .from(mediaFolders)
      .where(and(
        eq(mediaFolders.userId, user.userId),
        eq(mediaFolders.path, path)
      ))
      .limit(1);

    if (existingFolder.length > 0) {
      throw createError({
        statusCode: 409, // Conflict
        statusMessage: 'Conflict: This folder path has already been added for this user.',
      });
    }
  } catch (error: any) {
    if (error.statusCode === 409) throw error; // Re-throw conflict error
    console.error('Error checking for existing media folder:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not verify folder path.',
    });
  }

  // TODO: Add server-side validation to check if the path is a valid and accessible directory.
  // This is crucial for security and functionality but depends on the deployment environment.

  try {
    const [newMediaFolder] = await db
      .insert(mediaFolders)
      .values({
        mediaFolderId: uuidv7(),
        userId: user.userId,
        path: path,
        label: label,
      })
      .returning();

    if (!newMediaFolder) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error: Failed to create media folder entry.',
      });
    }

    console.log(`Media folder added by user ${user.userId}: ${path} (Label: ${label || 'N/A'})`);
    setResponseStatus(event, 201); // 201 Created
    return newMediaFolder;

  } catch (error: any) {
    console.error('Error adding media folder to database:', error);
    // Drizzle might not throw specific error types for unique constraints easily without raw query inspection
    // The check above for existing folder should handle most duplicate cases per user.
    // If a general unique constraint on 'path' (across all users) was intended and hit, this would be the fallback.
    if (error.message?.includes('UNIQUE constraint failed')) {
      throw createError({
        statusCode: 409, // Conflict
        statusMessage: 'Conflict: This folder path might already exist in the system or another error occurred.',
      });
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not add media folder to database.',
    });
  }
});