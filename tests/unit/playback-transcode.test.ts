import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm, truncate, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createPlaybackTranscodeCache, PLAYBACK_TRANSCODE_LIMITS, transcodePlaybackMp3 } from '../../server/utils/playback-transcode';

let directory: string;
const caches: ReturnType<typeof createPlaybackTranscodeCache>[] = [];
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), 'lyra-transcode-test-')); });
afterEach(async () => { for (const cache of caches.splice(0)) cache.clear(); await rm(directory, { recursive: true, force: true }); });
function cache(convert: (source: string, ffmpeg: string) => Promise<Buffer>, now?: () => number) {
  const result = createPlaybackTranscodeCache(convert, now); caches.push(result); return result;
}
async function file(name: string) { const path = join(directory, name); await writeFile(path, name); return path; }
async function silentWav(seconds: number) {
  const path = join(directory, 'silence.wav');
  const dataBytes = seconds * 8000;
  const header = Buffer.alloc(44);
  header.write('RIFF'); header.writeUInt32LE(36 + dataBytes, 4); header.write('WAVEfmt ', 8);
  header.writeUInt32LE(16, 16); header.writeUInt16LE(1, 20); header.writeUInt16LE(1, 22);
  header.writeUInt32LE(8000, 24); header.writeUInt32LE(8000, 28);
  header.writeUInt16LE(1, 32); header.writeUInt16LE(8, 34);
  header.write('data', 36); header.writeUInt32LE(dataBytes, 40);
  await writeFile(path, header); await truncate(path, header.length + dataBytes);
  return path;
}

describe('bounded compatible playback cache', () => {
  it('shares simultaneous work for one representation and rejects another instead of building an unbounded queue', async () => {
    const source = await file('one'), other = await file('two');
    let finish!: (value: Buffer) => void;
    const convert = vi.fn(() => new Promise<Buffer>(resolve => { finish = resolve; }));
    const model = cache(convert);
    const first = model.get(source, 'ffmpeg');
    await vi.waitFor(() => expect(convert).toHaveBeenCalledTimes(1));
    const duplicate = model.get(source, 'ffmpeg');
    await expect(model.get(other, 'ffmpeg')).rejects.toMatchObject({ statusCode: 503 });
    finish(Buffer.from('complete representation'));
    expect(await first).toBe(await duplicate);
    expect(await model.get(source, 'ffmpeg')).toBe(await first);
    expect(convert).toHaveBeenCalledTimes(1);
  });
  it('invalidates changed source files, expires old entries and limits retained entries', async () => {
    let clock = 0;
    const convert = vi.fn(async () => Buffer.from('complete'));
    const model = cache(convert, () => clock);
    const first = await file('one');
    await model.get(first, 'ffmpeg');
    await writeFile(first, 'changed bytes'); await model.get(first, 'ffmpeg');
    expect(convert).toHaveBeenCalledTimes(2);
    clock += PLAYBACK_TRANSCODE_LIMITS.ttlMs;
    await model.get(first, 'ffmpeg'); expect(convert).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 4; i++) await model.get(await file(`other-${i}`), 'ffmpeg');
    await model.get(first, 'ffmpeg'); expect(convert).toHaveBeenCalledTimes(8);
  });
  it('rejects a source changed during conversion and releases failed work for retry', async () => {
    const source = await file('one');
    const convert = vi.fn(async () => { await writeFile(source, 'changed size'); return Buffer.from('stale'); });
    const model = cache(convert);
    await expect(model.get(source, 'ffmpeg')).rejects.toMatchObject({ statusCode: 409 });
    convert.mockImplementationOnce(async () => Buffer.from('current'));
    expect(await model.get(source, 'ffmpeg')).toEqual(Buffer.from('current'));
  });
  it('rejects oversized input before conversion and oversized output before caching', async () => {
    const source = await file('oversize');
    await truncate(source, PLAYBACK_TRANSCODE_LIMITS.inputBytes + 1);
    const convert = vi.fn(async () => Buffer.alloc(PLAYBACK_TRANSCODE_LIMITS.outputBytes));
    const model = cache(convert);
    await expect(model.get(source, 'ffmpeg')).rejects.toMatchObject({ statusCode: 413 });
    expect(convert).not.toHaveBeenCalled();
    await expect(model.get(await file('valid'), 'ffmpeg')).rejects.toMatchObject({ statusCode: 413 });
  });
});

describe('compatible playback process boundaries', () => {
  it('rejects an actual over-duration WAV before invoking an unavailable encoder instead of truncating it', async () => {
    const source = await silentWav(PLAYBACK_TRANSCODE_LIMITS.seconds + 1);
    await expect(transcodePlaybackMp3(source, join(directory, 'missing-ffmpeg'))).rejects.toMatchObject({ statusCode: 413 });
  });
  it('removes its temporary output directory after a real child process failure and permits a retry', async () => {
    const source = await silentWav(1);
    // Other test workers may also convert audio: inspect only this worker's
    // dedicated temporary root, never another process's active directory.
    for (const name of ['TEMP', 'TMP', 'TMPDIR']) vi.stubEnv(name, directory);
    try {
      // Node is a real executable, but intentionally rejects the FFmpeg arguments.
      // This exercises execFile rejection and cleanup without a slow timeout.
      for (let attempt = 0; attempt < 2; attempt++) {
        await expect(transcodePlaybackMp3(source, process.execPath)).rejects.toMatchObject({ statusCode: 503 });
        const leaked = (await readdir(directory)).filter(name => name.startsWith('lyra-playback-'));
        expect(leaked).toEqual([]);
      }
    } finally { vi.unstubAllEnvs(); }
  });
});
