// server/api/tracks/[id]/play.get.ts
import { defineEventHandler, getRouterParam, createError, sendStream, setResponseHeader } from 'h3';
import { db } from '~/server/db';
import { tracks } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import fs from 'node:fs'; // Use node:fs for explicit import
import path from 'node:path';
import mime from 'mime-types';

export default defineEventHandler(async (event) => {
  const trackIdParam = getRouterParam(event, 'id');
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
    const contentType = mime.lookup(filePath) || 'application/octet-stream';
    setResponseHeader(event, 'Content-Type', contentType);

    // Get file stats for content length (optional but good for clients)
    const stats = fs.statSync(filePath);
    setResponseHeader(event, 'Content-Length', stats.size);

    // Set headers for potential range requests (important for seeking)
    setResponseHeader(event, 'Accept-Ranges', 'bytes');

    // Create a read stream and send it
    const stream = fs.createReadStream(filePath);

    // Handle stream errors
    stream.on('error', (err) => {
      console.error(`Error reading file stream for track ${trackId}:`, err);
      // We might not be able to send an H3 error if headers are already sent
      // event.node.res.end(); // Close the connection abruptly if possible
    });

    return sendStream(event, stream);

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
