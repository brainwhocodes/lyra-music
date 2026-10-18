import { defineEventHandler, getRouterParam, getQuery, createError } from 'h3';
import { db } from '~/server/db';
import { tracks } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { getMimeType } from '~/server/utils/formatters';
import { sendAudioRepresentation } from '~/server/utils/audio-response';
import { playbackTranscodes } from '~/server/utils/playback-transcode';

export default defineEventHandler(async event => {
  const id = getRouterParam(event, 'trackId');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Track ID is required' });
  const query = getQuery(event);
  if ((query.format !== undefined && query.format !== 'mp3') ||
      (query.unsupported !== undefined && (typeof query.unsupported !== 'string' || !/^(ogg|flac)(,(ogg|flac))?$/.test(query.unsupported)))) {
    throw createError({ statusCode: 400, statusMessage: 'Invalid playback format selection' });
  }
  const track = await db.select({ filePath: tracks.filePath }).from(tracks).where(eq(tracks.trackId, id)).get();
  if (!track?.filePath) throw createError({ statusCode: 404, statusMessage: 'Track not found' });
  const mime = getMimeType(track.filePath);
  const family = mime === 'audio/ogg' ? 'ogg' : mime === 'audio/flac' ? 'flac' : null;
  const compatible = family && (query.format === 'mp3' || (query.unsupported as string | undefined)?.split(',').includes(family));
  if (!compatible) return sendAudioRepresentation(event, track.filePath, mime);
  const config = typeof useRuntimeConfig === 'function' ? useRuntimeConfig() : {};
  const ffmpeg = config.whistleFfmpegPath || 'ffmpeg';
  const bytes = await playbackTranscodes.get(track.filePath, ffmpeg);
  return sendAudioRepresentation(event, bytes, 'audio/mpeg');
});
