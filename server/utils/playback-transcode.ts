import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { promisify } from 'node:util';
import { parseFile, parseBuffer } from 'music-metadata';
import { createError } from 'h3';

export const PLAYBACK_TRANSCODE_LIMITS = Object.freeze({
  inputBytes: 512 * 1024 * 1024, outputBytes: 32 * 1024 * 1024,
  seconds: 1200, timeoutMs: 120_000, cacheBytes: 64 * 1024 * 1024,
  entries: 4, ttlMs: 30 * 60_000,
});
const execute = promisify(execFile);

/** Finalize the MP3/Xing header before publishing any bytes or range offsets. */
export async function transcodePlaybackMp3(source: string, ffmpeg: string): Promise<Buffer> {
  let directory: string | undefined;
  try {
    const input = await stat(source);
    if (!input.isFile() || !input.size || input.size > PLAYBACK_TRANSCODE_LIMITS.inputBytes) {
      throw createError({ statusCode: 413, statusMessage: 'This track exceeds the compatible playback size limit' });
    }
    const metadata = await parseFile(source, { duration: true, skipCovers: true });
    const duration = metadata.format.duration;
    if (!duration || !Number.isFinite(duration) || duration > PLAYBACK_TRANSCODE_LIMITS.seconds) {
      throw createError({ statusCode: 413, statusMessage: 'This track exceeds the compatible playback duration limit' });
    }
    directory = await mkdtemp(join(tmpdir(), 'lyra-playback-'));
    const output = join(directory, 'complete.mp3');
    await execute(ffmpeg, [
      '-nostdin', '-v', 'error', '-protocol_whitelist', 'file,pipe', '-i', resolve(source),
      '-map', '0:a:0', '-vn', '-map_metadata', '-1', '-threads', '2',
      '-ac', '2', '-ar', '44100', '-c:a', 'libmp3lame', '-b:a', '192k',
      '-id3v2_version', '0', '-write_xing', '1',
      // A malicious duration header cannot drive unbounded conversion. Reaching
      // either safeguard is rejected below; no truncated representation is served.
      '-t', String(PLAYBACK_TRANSCODE_LIMITS.seconds + 1),
      '-fs', String(PLAYBACK_TRANSCODE_LIMITS.outputBytes), '-y', output,
    ], { shell: false, windowsHide: true, timeout: PLAYBACK_TRANSCODE_LIMITS.timeoutMs, killSignal: 'SIGKILL', maxBuffer: 64 * 1024 });
    const info = await stat(output);
    if (!info.size || info.size >= PLAYBACK_TRANSCODE_LIMITS.outputBytes) throw new Error('Output size limit');
    const bytes = await readFile(output);
    const decoded = await parseBuffer(bytes, { mimeType: 'audio/mpeg' }, { duration: true, skipCovers: true });
    const actual = decoded.format.duration;
    if (!actual || !Number.isFinite(actual) || actual > PLAYBACK_TRANSCODE_LIMITS.seconds || Math.abs(actual - duration) > .5) {
      throw new Error('Incomplete compatible representation');
    }
    return bytes;
  } catch (error: any) {
    if (error.statusCode) throw error;
    throw createError({ statusCode: 503, statusMessage: 'Compatible audio playback could not be prepared' });
  } finally {
    // Only the freshly allocated temporary child is removed, never a user path.
    if (directory && dirname(resolve(directory)) === resolve(tmpdir()) && directory.startsWith(join(tmpdir(), 'lyra-playback-'))) {
      await rm(directory, { recursive: true, force: true });
    }
  }
}

export function createPlaybackTranscodeCache(convert = transcodePlaybackMp3, now = Date.now) {
  const cache = new Map<string, { bytes: Buffer; expires: number; timer: ReturnType<typeof setTimeout> }>();
  let totalBytes = 0;
  let active: { key: string; promise: Promise<Buffer> } | undefined;
  const remove = (key: string) => {
    const item = cache.get(key);
    if (item) { clearTimeout(item.timer); totalBytes -= item.bytes.length; cache.delete(key); }
  };
  const clear = () => { for (const key of cache.keys()) remove(key); };
  async function get(source: string, ffmpeg: string): Promise<Buffer> {
    const path = resolve(source);
    let info;
    try { info = await stat(path); }
    catch { throw createError({ statusCode: 404, statusMessage: 'Audio file missing on server' }); }
    if (!info.isFile()) throw createError({ statusCode: 404, statusMessage: 'Audio file missing on server' });
    if (!info.size || info.size > PLAYBACK_TRANSCODE_LIMITS.inputBytes) throw createError({ statusCode: 413, statusMessage: 'This track exceeds the compatible playback size limit' });
    const key = JSON.stringify([path, info.size, info.mtimeMs, info.ctimeMs, ffmpeg, 'mp3-192k-v1']);
    for (const [id, item] of cache) if (item.expires <= now()) remove(id);
    const existing = cache.get(key);
    if (existing) { cache.delete(key); cache.set(key, existing); return existing.bytes; }
    if (active) {
      if (active.key === key) return active.promise;
      throw createError({ statusCode: 503, statusMessage: 'Another compatible audio track is being prepared. Try again shortly.' });
    }
    const promise = (async () => {
      try {
        const bytes = await convert(path, ffmpeg);
        if (!bytes.length || bytes.length >= PLAYBACK_TRANSCODE_LIMITS.outputBytes) throw createError({ statusCode: 413, statusMessage: 'Compatible audio exceeds the output limit' });
        const after = await stat(path);
        if (after.size !== info.size || after.mtimeMs !== info.mtimeMs || after.ctimeMs !== info.ctimeMs) throw createError({ statusCode: 409, statusMessage: 'Audio changed while compatible playback was prepared. Try again.' });
        while (cache.size >= PLAYBACK_TRANSCODE_LIMITS.entries || totalBytes + bytes.length > PLAYBACK_TRANSCODE_LIMITS.cacheBytes) remove(cache.keys().next().value!);
        const timer = setTimeout(() => remove(key), PLAYBACK_TRANSCODE_LIMITS.ttlMs);
        timer.unref?.();
        cache.set(key, { bytes, expires: now() + PLAYBACK_TRANSCODE_LIMITS.ttlMs, timer });
        totalBytes += bytes.length;
        return bytes;
      } finally { if (active?.key === key) active = undefined; }
    })();
    active = { key, promise };
    return promise;
  }
  return { get, clear };
}
export const playbackTranscodes = createPlaybackTranscodeCache();
