// server/api/tracks/[id]/play.get.ts
import { defineEventHandler, getRouterParam, createError, sendStream, setResponseHeader } from 'h3';
import { db } from '~/server/db';
import { tracks } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs'; // Use node:fs for explicit import
import path from 'node:path';
import { getMimeType } from '~/server/utils/formatters';
import { spawn } from 'node:child_process';

export default defineEventHandler(async (event) => {
  const trackIdParam = getRouterParam(event, 'trackId');
  if (!trackIdParam) {
    throw createError({
      statusCode: 400,
      message: 'Track ID is required'
    });
  }

  const trackId = trackIdParam;
  if (!trackId) {
    throw createError({
      statusCode: 400,
      message: 'Invalid Track ID'
    });
  }

  try {
    // Fetch track details including the path
    const track = await db.select({
        filePath: tracks.filePath
      })
      .from(tracks)
      .where(eq(tracks.trackId, trackId))
      .get(); // Use .get() for single result

    if (!track || !track.filePath) {
      throw createError({
        statusCode: 404,
        message: 'Track not found or path missing'
      });
    }

    const filePath = track.filePath;

    // Security Check: Ensure the path is valid and exists
    // IMPORTANT: Add more robust path validation in a real application
    // to prevent directory traversal attacks (e.g., check if it's within allowed media dirs).
    if (!fs.existsSync(filePath)) {
       console.error(`File not found at path: ${filePath}`);
       throw createError({
        statusCode: 404,
        message: 'Audio file not found on server'
      });
    }

    // Determine content type
    const contentType = getMimeType(filePath);
    setResponseHeader(event, 'Content-Type', contentType);

    // Get file stats for content length (optional but good for clients)
    const stats = fs.statSync(filePath);
    setResponseHeader(event, 'Content-Length', stats.size);

    // Set headers for potential range requests (important for seeking)
    setResponseHeader(event, 'Accept-Ranges', 'bytes');

    // Create a read stream and send it
    const userAgent = event.node.req.headers['user-agent'] || '';
    const isSafari = userAgent.includes('Safari') && !userAgent.includes('Chrome') && !userAgent.includes('Edg');

    const originalMimeType = getMimeType(filePath);
    const needsTranscoding = isSafari && (originalMimeType === 'audio/ogg' || originalMimeType === 'audio/flac' || originalMimeType === 'audio/x-flac');

    if (needsTranscoding) {
      console.log(`Transcoding track ${trackId} (${originalMimeType}) to AAC for Safari.`);
      setResponseHeader(event, 'Content-Type', 'audio/aac');
      // Content-Length and Accept-Ranges are omitted for live transcoding as they are hard to determine.

      const ffmpegArgs = [
        '-i', filePath,
        '-f', 'adts',       // Output format AAC ADTS
        '-c:a', 'aac',      // AAC codec
        '-b:a', '192k',     // Audio bitrate
        '-movflags', '+faststart', // Optimizes for streaming, may not be strictly needed for live pipe
        'pipe:1'            // Output to stdout
      ];

      const ffmpegProcess = spawn('ffmpeg', ffmpegArgs);

      // Pipe ffmpeg's stdout to the HTTP response
      ffmpegProcess.stdout.pipe(event.node.res);

      // Handle errors from ffmpeg process
      ffmpegProcess.on('error', (err) => {
        console.error(`Failed to start ffmpeg process for track ${trackId}:`, err);
        if (!event.node.res.headersSent) {
          event.node.res.writeHead(500, { 'Content-Type': 'text/plain' });
        }
        event.node.res.end('Error during transcoding process startup.');
      });

      ffmpegProcess.stderr.on('data', (data) => {
        console.error(`ffmpeg stderr (track ${trackId}): ${data}`);
      });

      // Return a promise that resolves when the stream is finished or errors
      return new Promise<void>((resolve, reject) => {
        event.node.res.on('finish', () => {
          console.log(`Transcoding stream finished for track ${trackId}`);
          resolve();
        });
        event.node.res.on('close', () => { // Handle client closing connection
          console.log(`Client closed connection during transcoding for track ${trackId}`);
          ffmpegProcess.kill(); // Ensure ffmpeg process is killed
          resolve(); // Resolve as the response is effectively over
        });
        ffmpegProcess.on('close', (code) => {
          if (code !== 0 && code !== null) { // null can mean it was killed, 0 is success
            console.error(`ffmpeg process for track ${trackId} exited with code ${code}`);
            if (!event.node.res.writableEnded) {
              // If response not already ended by an error or finish event
              // event.node.res.end(); // This might already be handled by stdout pipe ending
            }
          }
          // Resolve or reject based on how you want to handle ffmpeg exit
          // If stdout pipe handles 'finish', this might just be for logging
        });
        // If ffmpegProcess.stdout errors, it should propagate to event.node.res and trigger 'error' or 'close'
      }).finally(() => {
        if (ffmpegProcess.exitCode === null && !ffmpegProcess.killed) {
           console.log(`Attempting to kill ffmpeg process for track ${trackId} on promise resolution`);
           ffmpegProcess.kill();
        }
      });

    } else {
      // Existing logic for non-transcoded files or non-Safari browsers
      setResponseHeader(event, 'Content-Type', originalMimeType);
      const stats = fs.statSync(filePath);
      setResponseHeader(event, 'Content-Length', stats.size);
      setResponseHeader(event, 'Accept-Ranges', 'bytes');

      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        console.error(`Error reading file stream for track ${trackId}:`, err);
        // Potentially destroy stream and end response if possible
        if (!event.node.res.headersSent) {
            // throw createError ... or handle differently
        }
      });
      return sendStream(event, stream);
    }


  } catch (error: any) {
    // Handle known errors explicitly
    if (error.statusCode) {
      throw error; // Re-throw H3 errors
    }
    // Handle unknown errors
    console.error(`Error fetching or streaming track ${trackId}:`, error);
    throw createError({
      statusCode: 500,
      message: 'Failed to stream track'
    });
  }
});
