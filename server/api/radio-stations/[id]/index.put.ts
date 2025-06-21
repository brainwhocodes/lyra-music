import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { radioChannelArtists } from '~/server/db/schema/radio-channel-artists';
import { radioChannelGenres } from '~/server/db/schema/radio-channel-genres';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

const UpdateRadioStationSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  artistIds: z.array(z.string()).optional(),
  genreIds: z.array(z.string()).optional(),
});

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id');
  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  }

  const body = await readBody(event);
  const validation = UpdateRadioStationSchema.safeParse(body);
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.errors,
    });
  }

  const { name, artistIds, genreIds } = validation.data;

  try {
    await db.transaction(async (tx) => {
      await tx
        .update(radioChannels)
        .set({ name })
        .where(eq(radioChannels.channelId, channelId));

      await tx.delete(radioChannelArtists).where(eq(radioChannelArtists.channelId, channelId));
      await tx.delete(radioChannelGenres).where(eq(radioChannelGenres.channelId, channelId));

      if (artistIds && artistIds.length > 0) {
        await tx.insert(radioChannelArtists).values(
          artistIds.map(artistId => ({
            channelId,
            artistId,
          }))
        );
      }

      if (genreIds && genreIds.length > 0) {
        await tx.insert(radioChannelGenres).values(
          genreIds.map(genreId => ({
            channelId,
            genreId,
          }))
        );
      }
    });

    const fullStationData = await db.query.radioChannels.findFirst({
      where: (stations, { eq }) => eq(stations.channelId, channelId),
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
    
    if (!fullStationData) {
        throw createError({ statusCode: 404, statusMessage: 'Radio station not found after update' });
    }

    return fullStationData;
  } catch (error: any) {
    console.error(`Error updating radio station ${channelId}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to update radio station',
      data: error.message,
    });
  }
});

