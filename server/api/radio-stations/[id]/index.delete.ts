import { defineEventHandler, getRouterParam, createError } from 'h3';
import { and, eq } from 'drizzle-orm';
import { unlink } from 'node:fs/promises';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { stationImagePath } from '~/server/utils/radio-station';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const channelId = getRouterParam(event, 'id');
  if (!channelId) throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  const station = db.delete(radioChannels).where(and(eq(radioChannels.channelId, channelId), eq(radioChannels.userId, user.userId))).returning().get();
  if (!station) throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
  await Promise.all([station.logoImagePath, station.backgroundImagePath].map(async stored => {
    const file = stationImagePath(stored);
    if (file) await unlink(file).catch(() => {});
  }));
  return { success: true };
});
