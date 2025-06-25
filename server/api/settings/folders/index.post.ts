import { z } from 'zod';
import { defineEventHandler, createError, readValidatedBody } from 'h3';
import { db } from '~/server/db';
import { mediaFolders, users } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { v7 as uuidv7 } from 'uuid';
import { eq, and } from 'drizzle-orm';
import fs from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import nodePath from 'node:path';

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

  const { path: folderPath, label } = body.data;

  // Check if this user already has this path
  try {
    const existingFolder = await db.select()
      .from(mediaFolders)
      .where(and(
        eq(mediaFolders.userId, user.userId),
        eq(mediaFolders.path, folderPath)
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

  // Validate that the provided path exists and is an accessible directory
  const normalizedPath = nodePath.normalize(folderPath);
  if (!nodePath.isAbsolute(normalizedPath)) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Path must be absolute.',
    });
  }

  try {
    const stats = await fs.stat(normalizedPath);
    if (!stats.isDirectory()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Provided path is not a directory.',
      });
    }
    await fs.access(normalizedPath, fsConstants.R_OK);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Directory does not exist.',
      });
    }
    if (error.code === 'EACCES' || error.code === 'EPERM') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Directory cannot be accessed.',
      });
    }
    console.error('Error validating folder path:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal Server Error: Could not validate folder path.',
    });
  }

  try {
    const [newMediaFolder] = await db
      .insert(mediaFolders)
      .values({
        mediaFolderId: uuidv7(),
        userId: user.userId,
        path: folderPath,
        label: label,
      })
      .returning();

    if (!newMediaFolder) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Internal Server Error: Failed to create media folder entry.',
      });
    }

    console.log(`Media folder added by user ${user.userId}: ${folderPath} (Label: ${label || 'N/A'})`);
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