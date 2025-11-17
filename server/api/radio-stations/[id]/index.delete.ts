import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { eq } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id');

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  }

  try {
    // First, find the station to get image paths for deletion
    const [stationToDelete] = await db
      .select()
      .from(radioChannels)
      .where(eq(radioChannels.channelId, channelId));

    if (!stationToDelete) {
      throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
    }

    // Delete the station from the database
    await db.delete(radioChannels).where(eq(radioChannels.channelId, channelId));

    const publicDir = path.join(process.cwd(), 'public');

    // Delete associated images, ignoring errors if files don't exist
    if (stationToDelete.logoImagePath) {
      await unlink(path.join(publicDir, stationToDelete.logoImagePath)).catch(() => {});
    }
    if (stationToDelete.backgroundImagePath) {
      await unlink(path.join(publicDir, stationToDelete.backgroundImagePath)).catch(() => {});
    }

    return { success: true, message: `Radio station ${channelId} deleted.` };
  } catch (error: any) {
     if (error.statusCode) {
      throw error;
    }

    console.error(`Error deleting radio station ${channelId}:`, error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to delete radio station', data: error.message });
  }
});
