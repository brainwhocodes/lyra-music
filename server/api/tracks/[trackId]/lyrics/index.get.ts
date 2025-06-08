import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { lyrics } from '~/server/db/schema';
import { eq } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
    // trackId will be obtained and validated inside the try block now
  // if (!trackId) {
    // });
  // }

  try {
    const trackIdFromParam: string | undefined = getRouterParam(event, 'trackId');
    console.log(`[API Lyrics GET Debug] Received request for trackId: ${trackIdFromParam}`);

    if (!trackIdFromParam) {
      console.error('[API Lyrics GET Debug] Track ID is missing from router params.');
      throw createError({
        statusCode: 400,
        statusMessage: 'Track ID is required',
      });
    }

    console.log(`[API Lyrics GET Debug] Querying database for trackId: ${trackIdFromParam}`);
    const trackLyrics = await db.select().from(lyrics).where(eq(lyrics.trackId, trackIdFromParam)).get();
    console.log('[API Lyrics GET Debug] Database query result (trackLyrics):', JSON.stringify(trackLyrics, null, 2));

    if (!trackLyrics) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Lyrics not found for this track',
      });
    }

    let parsedLyricsJson = [];
    if (trackLyrics.lyricsJson && typeof trackLyrics.lyricsJson === 'string') {
      try {
        parsedLyricsJson = JSON.parse(trackLyrics.lyricsJson);
      } catch (e) {
        console.error(`[API Lyrics GET] Error parsing lyricsJson for track ${trackIdFromParam}:`, e);
        // Return empty array or throw an error if parsing fails. Client expects an array.
        // For now, let's allow the client to handle potentially empty lyrics if parsing fails.
      }
    } else if (Array.isArray(trackLyrics.lyricsJson)) {
      // If Drizzle already parsed it or it's somehow already an array
      parsedLyricsJson = trackLyrics.lyricsJson;
    } else if (trackLyrics.lyricsJson) {
        console.warn(`[API Lyrics GET] lyricsJson for track ${trackIdFromParam} is neither a string nor an array. Type: ${typeof trackLyrics.lyricsJson}`);
    }

    return {
      ...trackLyrics, // Spread other properties from the fetched lyrics record
      lyricsJson: parsedLyricsJson // Ensure lyricsJson is an array
    };
  } catch (error: any) {
    // Log the error for server-side debugging
    const trackIdFromParamForError = getRouterParam(event, 'trackId') || 'UNKNOWN_TRACK_ID';
    console.error(`Error fetching lyrics for track ${trackIdFromParamForError}:`, error);

    // If it's an error we threw intentionally, re-throw it
    if (error.statusCode) {
      throw error;
    }

    // For unexpected errors, throw a generic server error
    throw createError({
      statusCode: 500,
      statusMessage: 'An internal server error occurred while fetching lyrics.',
    });
  }
});
