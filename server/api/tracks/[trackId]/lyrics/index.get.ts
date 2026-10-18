import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { lyrics } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const trackId = getRouterParam(event, 'trackId');
  if (!trackId) throw createError({ statusCode: 400, statusMessage: 'Track ID is required' });
  const record = await db.select().from(lyrics).where(eq(lyrics.trackId, trackId)).get();
  if (!record) throw createError({ statusCode: 404, statusMessage: 'Lyrics not found for this track' });
  let lines: unknown = record.lyricsJson;
  if (typeof lines === 'string') {
    try { lines = JSON.parse(lines); }
    catch { throw createError({ statusCode: 500, statusMessage: 'Saved lyrics could not be read.' }); }
  }
  return { ...record, lyricsJson: Array.isArray(lines) ? lines : [] };
});
