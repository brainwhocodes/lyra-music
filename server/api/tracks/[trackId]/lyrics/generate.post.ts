import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { tracks, lyrics, artists, artistsTracks, type NewLyrics } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { transcribeAudioWithTimestamps } from '~/server/utils/gemini-service';

export default defineEventHandler(async (event) => {
  const trackId: string | undefined = getRouterParam(event, 'trackId');

  if (!trackId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Track ID is required for generating lyrics.',
    });
  }

  try {
    // 1. Verify track exists and get its file path, title, and primary artist name
    const trackData = await db.select({
      trackId: tracks.trackId,
      filePath: tracks.filePath,
      title: tracks.title,
      artistName: artists.name
    })
    .from(tracks)
    .leftJoin(artistsTracks, eq(tracks.trackId, artistsTracks.trackId))
    .leftJoin(artists, eq(artistsTracks.artistId, artists.artistId))
    .where(eq(tracks.trackId, trackId))
    // .where(eq(artistsTracks.isPrimaryArtist, true)) // Ideal: filter for primary artist
    // For now, we'll take the first artist found if multiple. A more robust solution might be needed.
    .groupBy(tracks.trackId) // Ensure we get one row per track if multiple artists and no primary filter
    .get();

    if (!trackData || !trackData.filePath || !trackData.title || !trackData.artistName) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Track not found, or essential track information (file path, title, artist name) is missing.',
      });
    }

    // 2. Transcribe audio to get timestamped lyrics
    // Determine MIME type based on file extension (simple approach)
    const mimeType = trackData.filePath.toLowerCase().endsWith('.mp3') ? 'audio/mp3' : 
                    trackData.filePath.toLowerCase().endsWith('.wav') ? 'audio/wav' : 
                    trackData.filePath.toLowerCase().endsWith('.ogg') ? 'audio/ogg' : 
                    trackData.filePath.toLowerCase().endsWith('.flac') ? 'audio/flac' : 
                    'audio/mpeg'; // Default fallback
    
    // Transcribe audio to get lyrics with timestamps
    console.log(`[LyricsGeneration] Starting transcription for track: ${trackData.title} by ${trackData.artistName}`);
    let generatedLyrics;
    try {
      generatedLyrics = await transcribeAudioWithTimestamps(
        trackData.filePath,
        mimeType,
        trackData.title,
        trackData.artistName
      );
      console.log(`[LyricsGeneration] Successfully transcribed ${generatedLyrics.length} lyric lines`);
    } catch (transcriptionError) {
      console.error('[LyricsGeneration] Transcription failed:', transcriptionError);
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to transcribe audio: ${transcriptionError instanceof Error ? transcriptionError.message : 'Unknown error'}`,
      });
    }
    
    // Use the transcribed lyrics as the final result
    const generatedLyricsJson = generatedLyrics;
    console.log('[LyricsGeneration Debug] trackId for DB operation:', trackId);
    console.log('[LyricsGeneration Debug] generatedLyricsJson (type:', typeof generatedLyricsJson, 'length:', generatedLyricsJson?.length, '):', JSON.stringify(generatedLyricsJson, null, 2));

    // 3. Prepare lyrics data for database insertion/update
    const lyricsData: NewLyrics = {
      trackId: trackId, // Use the trackId from the route parameter directly
      lyricsJson: generatedLyricsJson, // Assign the array directly, Drizzle handles stringification for JSON types
      source: 'gemini_transcription_only',
      llmModelUsed: 'transcription:gemini-2.5-flash-preview-05-20',
      rawLlmOutput: JSON.stringify({ 
        generatedLyrics: generatedLyricsJson // This is likely a text field, so stringify is correct here
      }),
      // createdAt will be set by default, updatedAt needs to be handled by onConflictDoUpdate or manually
    };
    console.log('[LyricsGeneration Debug] lyricsData for DB:', JSON.stringify(lyricsData, null, 2));

    // 4. Insert or update lyrics in the database
    // The `lyrics_track_idx` unique index on `trackId` allows `onConflictDoUpdate`
    console.log('[LyricsGeneration Debug] Attempting db.insert(lyrics).values(lyricsData).onConflictDoUpdate...');
    const savedLyrics = await db.insert(lyrics)
      .values(lyricsData)
      .onConflictDoUpdate({
        target: lyrics.trackId, // Conflict target is the trackId column
        set: {
          lyricsJson: generatedLyricsJson, // Assign the array directly here as well
          source: lyricsData.source,
          llmModelUsed: lyricsData.llmModelUsed,
          rawLlmOutput: lyricsData.rawLlmOutput,
          updatedAt: sql`CURRENT_TIMESTAMP`, // Explicitly update timestamp
        },
      })
      .returning(); // Return the inserted or updated record
      
    console.log('[LyricsGeneration Debug] savedLyrics result from DB:', JSON.stringify(savedLyrics, null, 2));
    if (!savedLyrics || savedLyrics.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to save lyrics to the database.',
      });
    }

    return savedLyrics[0];

  } catch (error: any) {
    console.error('[LyricsGeneration Debug] Error in catch block:', error);
    console.error(`Error generating lyrics for track ${trackId}:`, error);
    if (error.statusCode) {
      throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: 'An internal server error occurred while generating lyrics.',
    });
  }
});
