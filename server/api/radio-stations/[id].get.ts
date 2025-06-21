import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id');

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  }

  const station = await db.query.radioChannels.findFirst({
    where: eq(radioChannels.channelId, channelId),
    with: {
      radioChannelArtists: {
        with: {
          artist: true,
        },
      },
      radioChannelGenres: {
        with: {
          genre: true,
        },
      },
    },
  });

  if (!station) {
    throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
  }

  return station;
});
