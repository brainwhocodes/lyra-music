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

  const candidate = body?.lyricsJson;
  let previousTime = -1;
  const valid = Array.isArray(candidate) && candidate.every(line => {
    if (!line || typeof line !== 'object' || Array.isArray(line) ||
        typeof line.time !== 'string' || typeof line.text !== 'string' ||
        !/^(?:\d+:)?\d+:[0-5]\d(?:\.\d{1,3})?$/.test(line.time)) return false;
    const parts = line.time.split(':').map(Number);
    if (parts.length === 3 && parts[1] > 59) return false;
    const seconds = parts.reduce((sum, part) => sum * 60 + part, 0);
    if (!Number.isFinite(seconds) || seconds < previousTime) return false;
    previousTime = seconds;
    return true;
  });
  if (!valid) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Provide an array of lyric lines with string text and chronological MM:SS.mmm or HH:MM:SS.mmm timestamps.',
    });
  }

  // Keep only the public timestamp/text contract. An empty array explicitly clears lyrics.
  const lyricsJson = candidate!.map(line => ({ time: line.time, text: line.text }));

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
