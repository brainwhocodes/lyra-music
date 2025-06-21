import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { tracks, lyrics, artists, artistsTracks, type NewLyrics } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { transcribeAudioWithTimestamps } from '~/server/utils/gemini-service';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { mkdir, rm, unlink } from 'node:fs';
import path from 'node:path';

const exec = promisify(execCallback);

export default defineEventHandler(async (event) => {
  const trackId: string | undefined = getRouterParam(event, 'trackId');

  if (!trackId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Track ID is required for generating lyrics.',
    });
  }

  let processedFilePath: string | null = null;
  let tempProcessedDir: string | null = null;

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
    // .where(eq(artistsTracks.isPrimaryArtist, true)) // Consider re-evaluating primary artist logic
    .groupBy(tracks.trackId)
    .get();

    if (!trackData || !trackData.filePath || !trackData.title || !trackData.artistName) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Track not found, or essential track information (file path, title, artist name) is missing.',
      });
    }

    // 2. Process audio with ffmpeg to attempt vocal isolation
    const originalFilePath: string = trackData.filePath;
    // Create a unique temporary directory for this operation
    tempProcessedDir = path.join(path.dirname(originalFilePath), `temp_processed_lyrics_${trackId}_${Date.now()}`);
    mkdir(tempProcessedDir, { recursive: true } as any, (err) => {
      if (err) {
        console.error(`[LyricsGeneration] Error creating temp directory ${tempProcessedDir}:`, err);
        throw createError({
          statusCode: 500,
          statusMessage: `Failed to create temp directory: ${err.message || 'Unknown error'}`,
        });
      }
    });

    const tempFileName: string = `processed_${path.basename(originalFilePath)}.mp3`;
    processedFilePath = path.join(tempProcessedDir, tempFileName);

    // IMPORTANT: Ensure ffmpeg is installed and in the system PATH on the server
    const ffmpegCommand: string = `ffmpeg -i "${originalFilePath}" -af "pan=mono|c0=0.5*c0+0.5*c1" -y "${processedFilePath}"`;

    console.log(`[LyricsGeneration] Processing audio with ffmpeg for track ${trackId}: ${ffmpegCommand}`);
    try {
      const { stdout, stderr } = await exec(ffmpegCommand);
      // ffmpeg often outputs informational data to stderr, so we check if it specifically contains 'error'
      // or rely on exec throwing an error for non-zero exit codes.
      if (stderr) {
        if (stderr.toLowerCase().includes('error')) {
          console.error(`[LyricsGeneration] ffmpeg stderr (error) for track ${trackId}: ${stderr}`);
        } else {
          console.info(`[LyricsGeneration] ffmpeg stderr (info) for track ${trackId}: ${stderr.substring(0, 500)}${stderr.length > 500 ? '...' : ''}`);
        }
      }
      if (stdout) {
        console.log(`[LyricsGeneration] ffmpeg stdout for track ${trackId}: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
      }
      console.log(`[LyricsGeneration] Audio processed successfully for track ${trackId}: ${processedFilePath}`);
    } catch (ffmpegError: any) {
      console.error(`[LyricsGeneration] ffmpeg execution failed for track ${trackId}:`, ffmpegError);
      // The 'finally' block will handle cleanup of processedFilePath and tempProcessedDir if they were set.
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to process audio with ffmpeg: ${ffmpegError.message || 'Unknown ffmpeg error'}`,
      });
    }

    // 3. Transcribe processed audio to get timestamped lyrics
    console.log(`[LyricsGeneration] Starting transcription for processed track: ${trackData.title} by ${trackData.artistName}`);
    let generatedLyrics;
    try {
      generatedLyrics = await transcribeAudioWithTimestamps(
        processedFilePath, // Use the processed file
        'audio/mp3',       // MIME type is now mp3 as ffmpeg output is mp3
        trackData.title,
        trackData.artistName
      );
      console.log(`[LyricsGeneration] Successfully transcribed ${generatedLyrics.length} lyric lines for track ${trackId}`);
    } catch (transcriptionError: any) {
      console.error(`[LyricsGeneration] Transcription failed for track ${trackId}:`, transcriptionError);
      throw createError({
        statusCode: 500,
        statusMessage: `Failed to transcribe audio: ${transcriptionError.message || 'Unknown error'}`,
      });
    }
    
    const generatedLyricsJson = generatedLyrics;

    // 4. Prepare lyrics data for database insertion/update
    const lyricsData: NewLyrics = {
      trackId: trackId,
      lyricsJson: generatedLyricsJson,
      source: 'gemini_transcription_ffmpeg_mono', // Updated source
      llmModelUsed: 'transcription:gemini-2.5-flash-preview-05-20', // Model name might need update if Gemini changes
      rawLlmOutput: JSON.stringify({ 
        generatedLyrics: generatedLyricsJson
      }),
    };

    // 5. Insert or update lyrics in the database
    const savedLyrics = await db.insert(lyrics)
      .values(lyricsData)
      .onConflictDoUpdate({
        target: lyrics.trackId,
        set: {
          lyricsJson: generatedLyricsJson,
          source: lyricsData.source,
          llmModelUsed: lyricsData.llmModelUsed,
          rawLlmOutput: lyricsData.rawLlmOutput,
          updatedAt: new Date().toISOString(),
        },
      })
      .returning();
      
    if (!savedLyrics || savedLyrics.length === 0) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to save lyrics to the database.',
      });
    }

    console.log(`[LyricsGeneration] Successfully generated and saved lyrics for track ${trackId}.`);
    return savedLyrics[0];

  } catch (error: any) {
    console.error(`Error generating lyrics for track ${trackId}:`, error);
    if (error.statusCode && error.statusMessage) { // Check if it's an H3Error from createError
      throw error; // Re-throw H3 errors directly
    }
    // For other types of errors, wrap them in a generic 500 error
    throw createError({
      statusCode: 500,
      statusMessage: `An internal server error occurred while generating lyrics: ${error.message || 'Unknown error'}.`,
    });
  } finally {
    if (processedFilePath) {
      try {
        unlink(processedFilePath, (err) => {
          if (err) {
            console.error(`[LyricsGeneration] Error cleaning up temp file ${processedFilePath}:`, err);
          }
        });
        console.log(`[LyricsGeneration] Cleaned up temp file: ${processedFilePath}`);
      } catch (cleanupError) {
        console.error(`[LyricsGeneration] Error cleaning up temp file ${processedFilePath}:`, cleanupError);
      }
    }
    if (tempProcessedDir) {
       try {
         rm(tempProcessedDir, { recursive: true, force: true } as any, (err) => {
           if (err) {
             console.error(`[LyricsGeneration] Error cleaning up temp directory ${tempProcessedDir}:`, err);
           }
         });
         console.log(`[LyricsGeneration] Cleaned up temp directory: ${tempProcessedDir}`);
       } catch (cleanupDirError) {
         console.error(`[LyricsGeneration] Error cleaning up temp directory ${tempProcessedDir}:`, cleanupDirError);
       }
    }
  }
});
