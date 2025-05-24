import { z } from 'zod'
import { db } from '~/server/db'
import { tracks } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { createReadStream, stat } from 'node:fs'
import { promisify } from 'node:util'
import path from 'node:path'
import type { H3Event } from 'h3'
import { sendStream } from 'h3';

const statAsync = promisify(stat);

// Schema to validate the trackId path parameter
const paramsSchema = z.object({
  trackId: z.coerce.string()
});

// Simple mime type mapping based on extension
const getMimeType = (filePath: string): string => {
    const ext = path.extname(filePath).toLowerCase();
    switch (ext) {
        case '.mp3': return 'audio/mpeg';
        case '.flac': return 'audio/flac';
        case '.ogg': return 'audio/ogg';
        case '.opus': return 'audio/opus';
        case '.m4a': return 'audio/mp4'; // Often used for AAC
        case '.aac': return 'audio/aac';
        case '.wav': return 'audio/wav';
        default: return 'application/octet-stream'; // Default binary stream
    }
};

/**
 * @description Streams the audio data for a given trackId.
 *              TODO: Add handling for Range requests for seeking.
 */
export default defineEventHandler(async (event: H3Event) => {
    // Authentication check (optional - depends if streaming needs auth)
    const user = event.context.user;
    // if (!user || !user.userId) {
    //   throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
    // }

    // Validate trackId from path
    const paramsResult = await getValidatedRouterParams(event, params => paramsSchema.safeParse(params));

    if (!paramsResult.success) {
        throw createError({
            statusCode: 400,
            statusMessage: 'Bad Request: Invalid Track ID.',
            data: paramsResult.error.format()
        });
    }

    const { trackId } = paramsResult.data;

    try {
        // 1. Fetch track details from DB
        const trackResult = await db
            .select({
                filePath: tracks.filePath
            })
            .from(tracks)
            .where(eq(tracks.trackId, trackId))
            .limit(1);

        if (trackResult.length === 0 || !trackResult[0]?.filePath) {
            throw createError({
                statusCode: 404,
                statusMessage: 'Not Found: Track not found or path missing.'
            });
        }

        const filePath = trackResult[0].filePath;

        // 2. Check if file exists and get stats
        let fileStats;
        try {
            fileStats = await statAsync(filePath);
        } catch (err: any) {
            if (err.code === 'ENOENT') {
                console.error(`Streaming error: File not found at path for track ${trackId}: ${filePath}`);
                throw createError({
                    statusCode: 404,
                    statusMessage: 'Not Found: Audio file missing on server.'
                });
            }
            // Re-throw other stat errors
            throw err;
        }

        if (!fileStats.isFile()) {
             console.error(`Streaming error: Path is not a file for track ${trackId}: ${filePath}`);
            throw createError({
                statusCode: 500, // Or 404?
                statusMessage: 'Internal Server Error: Invalid file path.'
            });
        }

        // 3. Determine Content-Type
        const mimeType = getMimeType(filePath);

        // 4. Set headers
        setResponseHeader(event, 'Content-Type', mimeType);
        setResponseHeader(event, 'Content-Length', fileStats.size);
        setResponseHeader(event, 'Accept-Ranges', 'bytes'); // Indicate range requests are supported (though not fully handled yet)

        // 5. Create and return stream
        const stream = createReadStream(filePath);
        return sendStream(event, stream);

    } catch (error: any) {
        // Handle potential createError calls from above
        if (error.statusCode) throw error;

        // Handle unexpected errors
        console.error(`Error streaming track ${trackId}:`, error);
        throw createError({
            statusCode: 500,
            statusMessage: 'Internal Server Error: Could not stream track.'
        });
    }
});
