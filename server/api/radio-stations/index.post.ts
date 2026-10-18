import { defineEventHandler, readBody, createError } from 'h3';
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { radioChannels, radioChannelArtists, radioChannelGenres } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { parseStationInput, validateStationSeeds, stationRelations } from '~/server/utils/radio-station';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const input = parseStationInput(await readBody(event));
  const station = db.transaction(tx => {
    validateStationSeeds(tx, input);
    const created = tx.insert(radioChannels).values({ name: input.name, userId: user.userId }).returning().get();
    if (input.artistIds.length) tx.insert(radioChannelArtists).values(input.artistIds.map(artistId => ({ channelId: created.channelId, artistId }))).run();
    if (input.genreIds.length) tx.insert(radioChannelGenres).values(input.genreIds.map(genreId => ({ channelId: created.channelId, genreId }))).run();
    return created;
  });
  return db.query.radioChannels.findFirst({ where: eq(radioChannels.channelId, station.channelId), with: stationRelations });
});

