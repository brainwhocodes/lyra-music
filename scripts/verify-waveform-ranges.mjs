// Real-codec regression for container probes that reread evicted compressed data.
// Generates original deterministic noise; no user music or application DB is read.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from '@playwright/test';

const negativeControl = process.argv.includes('--negative-control');
const output = resolve('.test-data/waveform-ranges');
await mkdir(output, { recursive: true });
const fixture = resolve(output, 'original-noise.ogg');
const encoded = spawnSync(process.env.FFMPEG_PATH || 'ffmpeg', [
  '-v', 'error', '-f', 'lavfi', '-i', 'anoisesrc=color=white:sample_rate=44100:duration=180:seed=2026:amplitude=0.25',
  '-ac', '2', '-c:a', 'libvorbis', '-q:a', '10', '-y', fixture,
], { timeout: 60_000, maxBuffer: 1024 * 1024 });
assert.equal(encoded.status, 0, encoded.stderr?.toString() || String(encoded.error));
const bytes = await readFile(fixture);
assert.ok(bytes.length > 8 * 1024 * 1024 && bytes.length < 16 * 1024 * 1024,
  'The original fixture must span several cache windows but fit the unchanged download ceiling');

const require = createRequire(import.meta.url);
const { build } = createRequire(require.resolve('tsx/package.json'))('esbuild');
const bundle = await build({
  stdin: { contents: "export { decodeTrackWaveform } from './utils/audio/track-waveform';", resolveDir: process.cwd(), loader: 'ts' },
  bundle: true, write: false, platform: 'browser', format: 'iife', globalName: 'LyraRangeProof', target: 'es2022',
  // Restore the known failing cache only inside this diagnostic bundle. The
  // ordinary assertion must fail; the production source is never rewritten.
  plugins: negativeControl ? [{ name: 'old-cache-negative-control', setup(plugin) {
    plugin.onLoad({ filter: /full-waveform\.ts$/ }, async args => ({
      contents: (await readFile(args.path, 'utf8')).replace('cacheBytes: 16 * 1024 * 1024', 'cacheBytes: 2 * 1024 * 1024'), loader: 'ts',
    }));
  } }] : [],
});
const requests = [];
const server = createServer((request, response) => {
  if (request.url === '/') {
    response.setHeader('Content-Type', 'text/html');
    response.end('<!doctype html><meta charset="utf-8"><title>Original Ogg range proof</title><script src="decoder.js"></script>');
    return;
  }
  if (request.url === '/decoder.js') {
    response.setHeader('Content-Type', 'text/javascript'); response.end(bundle.outputFiles[0].contents); return;
  }
  if (request.url === '/favicon.ico') { response.writeHead(204); response.end(); return; }
  if (request.url !== '/api/tracks/original-range-noise/stream') { response.writeHead(404); response.end(); return; }
  const range = /^bytes=(\d+)-(\d*)$/.exec(request.headers.range || '');
  const start = range ? Number(range[1]) : 0;
  const end = range?.[2] ? Math.min(Number(range[2]), bytes.length - 1) : bytes.length - 1;
  if (!range || start > end || start >= bytes.length) { response.writeHead(416); response.end(); return; }
  requests.push({ start, end, status: 206 });
  response.writeHead(206, { 'Content-Type': 'audio/ogg', 'Accept-Ranges': 'bytes',
    'Content-Length': end - start + 1, 'Content-Range': `bytes ${start}-${end}/${bytes.length}` });
  response.end(bytes.subarray(start, end + 1));
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [], failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push({ path: new URL(request.url()).pathname, error: request.failure()?.errorText }));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = await page.evaluate(async () => {
    const start = performance.now(); let progress;
    try {
      const waveform = await LyraRangeProof.decodeTrackWaveform('original-range-noise', { onProgress: value => { progress = value; } });
      return { status: 'complete', seconds: waveform.durationSeconds, receivedBytes: waveform.receivedBytes,
        decodedFrames: waveform.decodedFrames, channels: waveform.channels, sampleRate: waveform.sampleRate,
        bins: waveform.bins.length, peak: waveform.peak, rms: waveform.rms, elapsedMs: performance.now() - start };
    } catch (error) {
      return { status: 'failed', code: error.code, message: error.message, progress, elapsedMs: performance.now() - start };
    }
  });
  const evidence = { browser: await browser.version(), negativeControl, fileBytes: bytes.length,
    fixture: 'Original seeded 180-second white noise, FFmpeg Vorbis quality 10', result, requests, failures, errors };
  await writeFile(resolve(output, negativeControl ? 'negative-control.json' : 'result.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence));
  assert.equal(result.status, 'complete', 'Complete bounded Ogg must decode without cache-induced repeated downloads');
  assert.ok(Math.abs(result.seconds - 180) < .25);
  assert.equal(result.receivedBytes, bytes.length, 'No compressed byte should be charged twice');
  assert.equal(result.channels, 2);
  assert.equal(result.sampleRate, 44100);
  assert.ok(result.decodedFrames >= 180 * 44100 && result.bins <= 256);
  assert.ok(result.rms > .05 && result.rms < .2 && result.peak > .15);
  assert.deepEqual(errors, []);
  // A finished waveform and exact full-file byte count independently establish
  // completed work before qualifying these specific range-worker cleanups.
  assert.ok(failures.every(item => item.path === '/api/tracks/original-range-noise/stream' && item.error === 'net::ERR_ABORTED'));
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
