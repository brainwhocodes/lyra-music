import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { tracks } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { getMimeType } from '~/server/utils/formatters';
import { sendAudioRepresentation } from '~/server/utils/audio-response';

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'trackId');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Track ID is required' });
  const track = await db.select({ filePath: tracks.filePath }).from(tracks).where(eq(tracks.trackId, id)).get();
  if (!track?.filePath) throw createError({ statusCode: 404, statusMessage: 'Track not found' });
  return sendAudioRepresentation(event, track.filePath, getMimeType(track.filePath));
});
