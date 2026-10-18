// Standalone real-codec proof. Uses a file:// page, not an application/test server.
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');
const output = resolve('.test-data/audio-analysis');
await mkdir(output, { recursive: true });
const bundle = await build({ stdin: { contents: "export { analyzeAudioBlob } from './utils/audio/track-analysis'; export { decodeWaveformBlob } from './utils/audio/track-waveform';", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'LyraAudioProof', target: 'es2022' });
await writeFile(resolve(output, 'decoder.js'), bundle.outputFiles[0].contents);
await writeFile(resolve(output, 'index.html'), '<!doctype html><meta charset="utf-8"><title>Lyra real audio decoder proof</title><script src="decoder.js"></script>');
const browser = await chromium.launch();
const report = { browser: await browser.version(), source: 'Production analyzeAudioBlob/decodeWaveformBlob, unmodified Mediabunny decoder and native Chromium AudioDecoder', fixtures: [], fullTimeline: null };
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(String(error)));
  await page.goto(pathToFileURL(resolve(output, 'index.html')).href);
  assert.equal(await page.evaluate(() => typeof AudioDecoder), 'function', 'Chromium must expose the real WebCodecs AudioDecoder');
  for (const name of ['the-distant-sun.mp3', 'signal-to-noise.mp3']) {
    const path = resolve('tests/fixtures/music/audio', name);
    const bytes = await readFile(path);
    const result = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
      return await LyraAudioProof.analyzeAudioBlob(new Blob([bytes], { type: 'audio/mpeg' }));
    }, bytes.toString('base64'));
    const waveform = await page.evaluate(async base64 => {
      const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
      return await LyraAudioProof.decodeWaveformBlob(new Blob([bytes], { type: 'audio/mpeg' }));
    }, bytes.toString('base64'));
    const reference = spawnSync('ffmpeg', ['-v', 'error', '-i', path, '-map', '0:a:0', '-t', '30', '-f', 'f32le', '-acodec', 'pcm_f32le', 'pipe:1'], { maxBuffer: 64 * 1024 * 1024 });
    assert.equal(reference.status, 0, reference.stderr?.toString() || String(reference.error));
    let peak = 0, squares = 0;
    for (let index = 0; index < reference.stdout.length; index += 4) {
      const value = reference.stdout.readFloatLE(index);
      peak = Math.max(peak, Math.abs(value)); squares += value * value;
    }
    const rms = Math.sqrt(squares / (reference.stdout.length / 4));
    assert.equal(result.codec, 'mp3');
    assert.ok(result.analyzedDurationSeconds > 11 && result.analyzedDurationSeconds < 13);
    assert.ok(result.peak > .001 && result.rms > .0001);
    assert.ok(Math.abs(result.peak - peak) < .02, 'Independent FFmpeg peak must agree within .02 linear amplitude');
    assert.ok(Math.abs(result.rms - rms) / rms < .05, 'Independent FFmpeg RMS must agree within5% (codec delay/padding tolerated)');
    assert.ok(result.bins.length > 40 && result.bins.every(bin => Number.isFinite(bin.peak) && Number.isFinite(bin.rms)));
    assert.equal(waveform.complete, true);
    assert.ok(waveform.bins.length <= 256);
    assert.ok(Math.abs(waveform.durationSeconds - result.analyzedDurationSeconds) < 1e-8);
    assert.equal(waveform.peak, result.peak);
    assert.equal(waveform.rms, result.rms);
    report.fixtures.push({ name, result, waveform, ffmpeg: { peak, rms }, rmsRelativeDifference: Math.abs(result.rms - rms) / rms });
  }
  // Original65s mono signal: silence until61s, a1kHz tone through63s, silence again.
  const sampleRate = 16000, frames = sampleRate * 65;
  const raw = Buffer.alloc(frames * 4);
  for (let frame = 61 * sampleRate; frame < 63 * sampleRate; frame++) raw.writeFloatLE(.5 * Math.sin(2 * Math.PI * 1000 * frame / sampleRate), frame * 4);
  const encoded = spawnSync('ffmpeg', ['-v', 'error', '-f', 'f32le', '-ar', String(sampleRate), '-ac', '1', '-i', 'pipe:0', '-c:a', 'libmp3lame', '-b:a', '64k', '-f', 'mp3', 'pipe:1'], { input: raw, maxBuffer: 8 * 1024 * 1024 });
  assert.equal(encoded.status, 0, encoded.stderr?.toString() || String(encoded.error));
  const longResult = await page.evaluate(async base64 => {
    const bytes = Uint8Array.from(atob(base64), value => value.charCodeAt(0));
    const start = performance.now();
    const result = await LyraAudioProof.decodeWaveformBlob(new Blob([bytes], { type: 'audio/mpeg' }));
    return { result, elapsedMs: performance.now() - start };
  }, encoded.stdout.toString('base64'));
  assert.equal(longResult.result.complete, true);
  assert.ok(longResult.result.durationSeconds > 65 && longResult.result.durationSeconds < 65.3);
  assert.ok(longResult.result.bins.length <= 256);
  assert.ok(longResult.result.bins.filter(bin => bin.endSeconds <= 30).every(bin => bin.peak === 0));
  const audible = longResult.result.bins.filter(bin => bin.peak > .1);
  assert.ok(audible.length > 0 && audible.every(bin => bin.startSeconds >= 60 && bin.endSeconds <= 64));
  report.fullTimeline = { ...longResult, signal: 'Original65s PCM encoded to MP3 by FFmpeg; only audible signal61–63s', encodedBytes: encoded.stdout.length };
  assert.deepEqual(errors, []);
  await writeFile(resolve(output, 'real-codec-report.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ browser: report.browser, fixtures: report.fixtures.map(({ name, result, waveform, ffmpeg, rmsRelativeDifference }) => ({ name, codec: result.codec, sampleRate: result.sampleRate, channels: result.channels, seconds: result.analyzedDurationSeconds, peak: result.peak, rms: result.rms, fullWaveformBins: waveform.bins.length, ffmpeg, rmsRelativeDifference })), fullTimeline: { seconds: longResult.result.durationSeconds, bins: longResult.result.bins.length, elapsedMs: longResult.elapsedMs, audibleIntervals: audible.map(bin => [bin.startSeconds, bin.endSeconds]) }, report: resolve(output, 'real-codec-report.json') }, null, 2));
} finally { await browser.close(); }
