import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { radioChannelArtists } from '~/server/db/schema/radio-channel-artists';
import { radioChannelGenres } from '~/server/db/schema/radio-channel-genres';
import { v7 as uuidv7 } from 'uuid';
import { z } from 'zod';

const CreateRadioStationSchema = z.object({
  name: z.string().min(1, 'Station name is required'),
  artistIds: z.array(z.string()).optional(),
  genreIds: z.array(z.string()).optional(),
});

export default defineEventHandler(async (event) => {
  const body = await readBody(event);

  const user = await getUserFromEvent(event);

  const validation = CreateRadioStationSchema.safeParse(body);
  if (!validation.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid request body',
      data: validation.error.errors,
    });
  }

  const { name, artistIds, genreIds } = validation.data;

  try {
    const newStation = await db.transaction(async (tx) => {
      const channelId = uuidv7();

      const [createdStation] = await tx
        .insert(radioChannels)
        .values({ channelId, name, userId: user?.userId })
        .returning();

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

      return createdStation;
    });

    // Fetch the full station data to return
    const fullStationData = await db.query.radioChannels.findFirst({
      where: (stations, { eq }) => eq(stations.channelId, newStation.channelId),
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

    return fullStationData;
  } catch (error: any) {
    console.error('Error creating radio station:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to create radio station',
      data: error.message,
    });
  }
});

