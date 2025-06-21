import { defineEventHandler } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema';
import { asc } from 'drizzle-orm';

export default defineEventHandler(async () => {
  const stations = await db.query.radioChannels.findMany({
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
    orderBy: [asc(radioChannels.name)],
  });

  return stations;
});
