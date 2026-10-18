import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createWhistleTranscriber, runBoundedProcess } from '../../server/utils/whistle-service';

// Opt-in because the official public runtime/model must be provisioned once first.
describe.skipIf(process.env.WHISTLE_REAL_TESTS !== '1')('real offline Whistle runtime (no API keys)', () => {
  let root: string;
  const transcribe = createWhistleTranscriber();
  const ffmpeg = process.env.NUXT_WHISTLE_FFMPEG_PATH || process.env.WHISTLE_FFMPEG_PATH || 'ffmpeg';
  const options = {
    whistlePython: process.env.NUXT_WHISTLE_PYTHON || process.env.WHISTLE_PYTHON,
    whistleModelPath: process.env.NUXT_WHISTLE_MODEL_PATH || process.env.WHISTLE_MODEL_PATH,
    whistleFfmpegPath: ffmpeg,
    whistleTimeoutMs: 60_000,
  };
  beforeAll(async () => { root = await mkdtemp(path.join(tmpdir(), 'lyra-whistle-real-')); });
  afterAll(async () => { await rm(root, { recursive: true, force: true }); });

  it('recognizes the committed spoken fixture with grounded word times', async () => {
    const result = await transcribe(path.resolve('tests/fixtures/music/audio/spoken-test.wav'), options);
    expect(result.length).toBeGreaterThan(0);
    expect(result.map(line => line.text).join(' ').toLowerCase()).toMatch(/music.*morning/);
    expect(result.every(line => /^\d{2}:\d{2}\.\d{3}$/.test(line.time))).toBe(true);
  }, 65_000);

  it('returns no lyrics for real digital silence', async () => {
    const silence = path.join(root, 'silence.wav');
    await runBoundedProcess(ffmpeg, ['-nostdin', '-loglevel', 'error', '-f', 'lavfi', '-i', 'anullsrc=r=16000:cl=mono', '-t', '1', '-y', silence], { timeoutMs: 5000, maxOutputBytes: 4096 });
    expect(await transcribe(silence, options)).toEqual([]);
  }, 65_000);

  it('retains absolute timestamps beyond the first 30-second model window', async () => {
    const repeated = path.join(root, 'long-speech.wav');
    await runBoundedProcess(ffmpeg, ['-nostdin', '-loglevel', 'error', '-stream_loop', '-1', '-i', path.resolve('tests/fixtures/music/audio/spoken-test.wav'), '-t', '36', '-y', repeated], { timeoutMs: 5000, maxOutputBytes: 4096 });
    const result = await transcribe(repeated, options);
    expect(result.some(line => Number(line.time.split(':')[1]) >= 30)).toBe(true);
    expect(result.map(line => line.text).join(' ').toLowerCase()).toContain('music');
  }, 65_000);

  it('handles a real instrumental fixture without fabricated timing formats', async () => {
    // Whistle documents that music can produce hallucinated words; this checks the
    // integration contract, never claims lyric accuracy for instrumental music.
    const result = await transcribe(path.resolve('tests/fixtures/music/audio/the-distant-sun.mp3'), options);
    expect(Array.isArray(result)).toBe(true);
    expect(result.every(line => /^00:\d{2}\.\d{3}$/.test(line.time) && line.text.trim())).toBe(true);
  }, 65_000);
});
