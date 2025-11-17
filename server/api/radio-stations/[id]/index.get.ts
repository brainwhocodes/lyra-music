import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id');

  if (!channelId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Missing channel ID',
    });
  }

  try {
    const [station] = await db
      .select()
      .from(radioChannels)
      .where(eq(radioChannels.channelId, channelId));

    if (!station) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Radio station not found',
      });
    }

    return station;
  } catch (error: any) {
    if (error.statusCode) {
      throw error;
    }
    
    console.error(`Error fetching radio station ${channelId}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch radio station',
      data: error.message,
    });
  }
});
