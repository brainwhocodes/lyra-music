import { defineEventHandler, readBody, createError } from 'h3';
import { db } from '~/server/db';
import { userTrackPlays } from '~/server/db/schema';
import { DateTime } from 'luxon';
import { getUserFromEvent } from '~/server/utils/auth';

interface PlayRequestBody {
  trackId: string;
  playDurationMs?: number;
  source?: string;
}

export default defineEventHandler(async (event) => {
  const body = await readBody<PlayRequestBody>(event);
  const { trackId, playDurationMs, source = 'web' } = body;

  const user = await getUserFromEvent(event);
  const userId = user?.userId;

  if (!userId) {
    return createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: User ID not found.',
    });
  }

  if (!trackId) {
    return createError({
      statusCode: 400,
      statusMessage: 'Bad Request: trackId is required.',
    });
  }

  try {
    await db.insert(userTrackPlays).values({
      userId,
      trackId,
      playedAt: DateTime.utc().toISO(), // Store as ISO string in UTC
      playDurationMs: playDurationMs ?? null,
      source,
    });

    return { success: true, message: 'Play recorded.' };
  } catch (error: any) {
    console.error('Error recording play:', error);
    return createError({
      statusCode: 500,
      statusMessage: `Internal Server Error: Could not record play. ${error.message}`,
    });
  }
});
