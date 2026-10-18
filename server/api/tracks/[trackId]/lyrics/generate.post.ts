import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { tracks, lyrics, type NewLyrics } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { transcribeAudioWithTimestamps, WhistleError, WHISTLE_MODEL, WHISTLE_SOURCE } from '~/server/utils/whistle-service';

export default defineEventHandler(async (event) => {
  const trackId = getRouterParam(event, 'trackId');
  if (!trackId) throw createError({ statusCode: 400, statusMessage: 'Track ID is required for generating lyrics.' });
  try {
    const track = await db.select({ filePath: tracks.filePath }).from(tracks).where(eq(tracks.trackId, trackId)).get();
    if (!track?.filePath) throw createError({ statusCode: 404, statusMessage: 'Track audio file was not found.' });
    const config = useRuntimeConfig(event);
    const generatedLyrics = await transcribeAudioWithTimestamps(track.filePath, config);
    // Instrumentals/silence are valid model results, but must never erase saved lyrics.
    if (!generatedLyrics.length) throw createError({ statusCode: 422, statusMessage: 'No speech was detected. Existing lyrics were kept.' });
    const lyricsData: NewLyrics = {
      trackId,
      lyricsJson: generatedLyrics,
      source: WHISTLE_SOURCE,
      llmModelUsed: config.whistleModelPath ? `${WHISTLE_MODEL}:custom` : WHISTLE_MODEL,
      rawLlmOutput: JSON.stringify({ generatedLyrics }),
    };
    const saved = await db.insert(lyrics).values(lyricsData).onConflictDoUpdate({
      target: lyrics.trackId,
      set: {
        lyricsJson: lyricsData.lyricsJson,
        source: lyricsData.source,
        llmModelUsed: lyricsData.llmModelUsed,
        rawLlmOutput: lyricsData.rawLlmOutput,
        updatedAt: new Date().toISOString(),
      },
    }).returning();
    if (!saved[0]) throw createError({ statusCode: 500, statusMessage: 'Failed to save lyrics.' });
    return saved[0];
  } catch (error: unknown) {
    if (error instanceof WhistleError) throw createError({ statusCode: error.statusCode, statusMessage: error.message });
    if (error && typeof error === 'object' && 'statusCode' in error) throw error;
    console.error('[LyricsGeneration] Failed to generate or save lyrics:', error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to generate lyrics.' });
  }
});
