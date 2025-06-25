import { z } from 'zod'
import { db } from '~/server/db'
import { tracks } from '~/server/db/schema'
import { eq } from 'drizzle-orm'
import { createReadStream, stat } from 'node:fs'
import { promisify } from 'node:util'
import type { H3Event } from 'h3'
import { sendStream, setResponseHeader, setResponseStatus, getRequestHeader, createError } from 'h3';
import { getMimeType } from '~/server/utils/formatters';

const statAsync = promisify(stat);

// Schema to validate the trackId path parameter
const paramsSchema = z.object({
  trackId: z.coerce.string()
});


/**
 * @description Streams the audio data for a given trackId.
 *              Supports HTTP Range requests for seeking within the track.
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

        // 4. Handle optional Range header for seeking support
        const rangeHeader = getRequestHeader(event, 'range');
        let start = 0;
        let end = fileStats.size - 1;

        if (rangeHeader) {
            const match = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
            if (!match) {
                throw createError({
                    statusCode: 416,
                    statusMessage: 'Range Not Satisfiable'
                });
            }
            const startStr = match[1];
            const endStr = match[2];

            if (startStr === '' && endStr === '') {
                throw createError({
                    statusCode: 416,
                    statusMessage: 'Range Not Satisfiable'
                });
            }

            if (startStr) {
                start = parseInt(startStr, 10);
                if (isNaN(start) || start >= fileStats.size) {
                    throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' });
                }
            }

            if (endStr) {
                end = parseInt(endStr, 10);
                if (isNaN(end) || end >= fileStats.size) {
                    end = fileStats.size - 1;
                }
            }

            if (!startStr && endStr) {
                const suffixLength = parseInt(endStr, 10);
                start = fileStats.size - suffixLength;
                end = fileStats.size - 1;
                if (start < 0) start = 0;
            }

            if (start > end) {
                throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' });
            }

            setResponseStatus(event, 206);
            setResponseHeader(event, 'Content-Range', `bytes ${start}-${end}/${fileStats.size}`);
            setResponseHeader(event, 'Content-Length', end - start + 1);
        } else {
            setResponseHeader(event, 'Content-Length', fileStats.size);
        }

        setResponseHeader(event, 'Content-Type', mimeType);
        setResponseHeader(event, 'Accept-Ranges', 'bytes');

        // 5. Create and return stream
        const stream = createReadStream(filePath, { start, end });
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
