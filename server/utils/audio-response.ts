import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { createError, getRequestHeader, sendStream, setResponseHeader, setResponseStatus, type H3Event } from 'h3';

/** One complete representation has one byte range space, including transcodes. */
export async function sendAudioRepresentation(event: H3Event, source: string | Buffer, mime: string) {
  let size: number;
  if (typeof source === 'string') {
    let info;
    try { info = await stat(source); }
    catch { throw createError({ statusCode: 404, statusMessage: 'Audio file missing on server' }); }
    if (!info.isFile()) throw createError({ statusCode: 404, statusMessage: 'Audio file missing on server' });
    size = info.size;
  } else size = source.length;
  setResponseHeader(event, 'Content-Type', mime);
  setResponseHeader(event, 'Accept-Ranges', 'bytes');
  setResponseHeader(event, 'Cache-Control', 'private, no-store');
  let start = 0, end = size - 1;
  const header = getRequestHeader(event, 'range');
  if (header) {
    const reject = (): never => {
      setResponseHeader(event, 'Content-Range', `bytes */${size}`);
      throw createError({ statusCode: 416, statusMessage: 'Range Not Satisfiable' });
    };
    const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
    if (!match || (!match[1] && !match[2]) || !size) reject();
    if (match![1]) {
      start = Number(match![1]);
      if (!Number.isSafeInteger(start) || start >= size) reject();
      if (match![2]) {
        const requestedEnd = Number(match![2]);
        if (!Number.isSafeInteger(requestedEnd)) reject();
        end = Math.min(requestedEnd, size - 1);
      }
    } else {
      const suffix = Number(match![2]);
      if (!Number.isSafeInteger(suffix) || suffix <= 0) reject();
      start = Math.max(0, size - suffix);
    }
    if (start > end) reject();
    setResponseStatus(event, 206);
    setResponseHeader(event, 'Content-Range', `bytes ${start}-${end}/${size}`);
  }
  setResponseHeader(event, 'Content-Length', Math.max(0, end - start + 1));
  if (!size) return Buffer.alloc(0);
  return typeof source === 'string' ? sendStream(event, createReadStream(source, { start, end })) : source.subarray(start, end + 1);
}
