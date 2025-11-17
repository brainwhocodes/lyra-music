import { defineEventHandler, getRouterParam, readBody, createError } from 'h3';
import { db } from '~/server/db';
import { lyrics, type NewLyrics } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';

interface LyricsUpdateRequest {
  lyricsJson: Array<{ time: string; text: string }>;
}

export default defineEventHandler(async (event) => {
  const trackId: string | undefined = getRouterParam(event, 'trackId');

  if (!trackId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Track ID is required for updating lyrics.',
    });
  }

  const body = await readBody<LyricsUpdateRequest>(event);

  if (!body || !body.lyricsJson) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Lyrics content (lyricsJson) is required in the request body.',
    });
  }

  const { lyricsJson } = body;

  try {
    const newLyricsData: Partial<NewLyrics> = {
      trackId,
      lyricsJson,
      source: 'user_edited',
      llmModelUsed: null, // Clear LLM specific fields as lyrics are user-edited
      rawLlmOutput: null, // Clear LLM specific fields
      updatedAt: new Date().toISOString() as any,
    };

    // Using onConflictDoUpdate because there's a unique index on trackId
    // This will insert if no lyrics exist for the track, or update if they do.
    const result = await db.insert(lyrics)
      .values(newLyricsData as NewLyrics) // Cast because not all NewLyrics fields are provided (e.g. lyricsId, createdAt)
      .onConflictDoUpdate({
        target: lyrics.trackId,
        set: {
          lyricsJson: newLyricsData.lyricsJson,
          source: newLyricsData.source,
          llmModelUsed: newLyricsData.llmModelUsed,
          rawLlmOutput: newLyricsData.rawLlmOutput,
          updatedAt: new Date().toISOString() as any,
        },
      })
      .returning();

    if (!result || result.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update lyrics in the database.',
      });
    }

    return { message: 'Lyrics updated successfully', updatedLyrics: result[0] };

  } catch (error: any) {
    console.error(`Error updating lyrics for track ${trackId}:`, error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: `An unexpected error occurred while updating lyrics: ${error.message}`,
    });
  }
});
