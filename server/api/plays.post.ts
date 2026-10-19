import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '~/server/db';
import { albums, tracks, userTrackPlays } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { z } from 'zod';
import { getUserFromEvent } from '~/server/utils/auth';

const playSchema = z.object({
  trackId: z.string().trim().min(1).max(200),
  playDurationMs: z.number().int().nonnegative().max(86_400_000).optional(),
  source: z.string().trim().min(1).max(100).default('web'),
});

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  const userId = user?.userId;

  if (!userId) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User ID not found.',
    });
  }

  const parsed = playSchema.safeParse(await readBody(event));
  if (!parsed.success) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid recorded play.',
    });
  }

  const { trackId, playDurationMs, source } = parsed.data;
  // Ownership and insertion share a write transaction so a transfer cannot race the check.
  db.transaction(() => {
    const owned = db.select({ trackId: tracks.trackId }).from(tracks)
      .innerJoin(albums, eq(tracks.albumId, albums.albumId))
      .where(and(eq(tracks.trackId, trackId), eq(albums.userId, userId))).get();
    if (!owned) throw createError({ statusCode: 404, statusMessage: 'Track not found.' });
    db.insert(userTrackPlays).values({ userId, trackId, playedAt: new Date().toISOString(), playDurationMs: playDurationMs ?? null, source }).run();
  }, { behavior: 'immediate' });
  return { success: true, message: 'Play recorded.' };
});
