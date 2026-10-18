import { defineEventHandler, readBody, getRouterParam, createError } from 'h3';
import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { radioChannels, radioChannelArtists, radioChannelGenres } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { parseStationInput, validateStationSeeds, stationRelations } from '~/server/utils/radio-station';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const channelId = getRouterParam(event, 'id');
  if (!channelId) throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  const input = parseStationInput(await readBody(event));
  db.transaction(tx => {
    const owned = and(eq(radioChannels.channelId, channelId), eq(radioChannels.userId, user.userId));
    if (!tx.select().from(radioChannels).where(owned).get()) throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
    validateStationSeeds(tx, input);
    tx.update(radioChannels).set({ name: input.name, updatedAt: new Date().toISOString() }).where(owned).run();
    if (input.replaceArtists) {
      tx.delete(radioChannelArtists).where(eq(radioChannelArtists.channelId, channelId)).run();
      if (input.artistIds.length) tx.insert(radioChannelArtists).values(input.artistIds.map(artistId => ({ channelId, artistId }))).run();
    }
    if (input.replaceGenres) {
      tx.delete(radioChannelGenres).where(eq(radioChannelGenres.channelId, channelId)).run();
      if (input.genreIds.length) tx.insert(radioChannelGenres).values(input.genreIds.map(genreId => ({ channelId, genreId }))).run();
    }
  });
  return db.query.radioChannels.findFirst({ where: eq(radioChannels.channelId, channelId), with: stationRelations });
});

