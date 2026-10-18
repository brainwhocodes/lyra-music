import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFile, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import type Database from 'better-sqlite3';

// Isolate only the DB connection. Queries, handlers, filesystem and HTTP
// responses are real; these tests do not invoke any external API.
const state = vi.hoisted(() => ({ sqlite: null as Database.Database | null }));
vi.mock('~/server/db', async () => {
  const { default: Sqlite } = await import('better-sqlite3');
  const { drizzle } = await import('drizzle-orm/better-sqlite3');
  const sqlite = new Sqlite(':memory:');
  sqlite.exec('CREATE TABLE tracks (track_id TEXT PRIMARY KEY, file_path TEXT NOT NULL)');
  state.sqlite = sqlite;
  return { db: drizzle(sqlite) };
});

import streamTrack from '~/server/api/tracks/[trackId]/stream.get';
import playTrack from '~/server/api/tracks/[trackId]/play.get';
import { playbackTranscodes } from '../../server/utils/playback-transcode';
import { parseBuffer } from 'music-metadata';

const hasFfmpeg = spawnSync('ffmpeg', ['-version'], { timeout: 5000, windowsHide: true }).status === 0;
const bytes = Buffer.from('0123456789');
const safari = 'Mozilla/5.0 Version/18.0 Safari/605.1.15';
let directory: string;
let baseUrl: string;
let server: Server;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'lyra-stream-'));
  const audioPath = join(directory, 'seek.mp3');
  const emptyPath = join(directory, 'empty.mp3');
  const invalidFlacPath = join(directory, 'invalid.flac');
  await writeFile(audioPath, bytes);
  await writeFile(emptyPath, '');
  await writeFile(invalidFlacPath, 'This is deliberately not FLAC audio.');
  const insert = state.sqlite!.prepare('INSERT INTO tracks (track_id, file_path) VALUES (?, ?)');
  insert.run('seek', audioPath);
  insert.run('empty', emptyPath);
  insert.run('deleted', join(directory, 'deleted.mp3'));
  insert.run('invalid-flac', invalidFlacPath);

  if (hasFfmpeg) {
    const flacPath = join(directory, 'synthetic.flac');
    await promisify(execFile)('ffmpeg', [
      '-nostdin', '-v', 'error', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.25',
      '-c:a', 'flac', flacPath,
    ], { timeout: 10000, windowsHide: true });
    insert.run('flac', flacPath);
  }

  const app = createApp();
  const router = createRouter();
  router.get('/tracks/:trackId/stream', streamTrack);
  router.get('/tracks/:trackId/play', playTrack);
  app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Missing HTTP test server address');
  baseUrl = `http://127.0.0.1:${address.port}`;
}, 20000);

afterAll(async () => {
  playbackTranscodes.clear();
  if (server) {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
  state.sqlite?.close();
  if (directory) await rm(directory, { recursive: true, force: true });
});

describe.each(['stream', 'play'])('%s HTTP responses', (endpoint) => {
  it('streams the complete original bytes and content headers', async () => {
    const response = await fetch(`${baseUrl}/tracks/seek/${endpoint}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('10');
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(bytes);
  });

  it.each([
    ['bytes=2-5', 'bytes 2-5/10', '2345'],
    ['bytes=7-', 'bytes 7-9/10', '789'],
    ['bytes=-3', 'bytes 7-9/10', '789'],
    ['bytes=8-200', 'bytes 8-9/10', '89'],
    ['bytes=-200', 'bytes 0-9/10', '0123456789'],
    ['bytes=0-0', 'bytes 0-0/10', '0'],
  ])('honors range %s', async (range, contentRange, expected) => {
    const response = await fetch(`${baseUrl}/tracks/seek/${endpoint}`, { headers: { range } });
    expect(response.status).toBe(206);
    expect(response.headers.get('content-range')).toBe(contentRange);
    expect(response.headers.get('content-length')).toBe(String(expected.length));
    expect(await response.text()).toBe(expected);
  });

  it.each(['bytes=10-', 'bytes=8-2', 'bytes=-0', 'bytes=-', 'garbage bytes=0-1', 'bytes=0-1junk', 'bytes=0-1,3-4', 'bytes=999999999999999999999-', 'bytes=-999999999999999999999', 'bytes=0-999999999999999999999'])('rejects invalid range %s with the resource size', async (range) => {
    const response = await fetch(`${baseUrl}/tracks/seek/${endpoint}`, { headers: { range } });
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */10');
    await response.arrayBuffer();
  });

  it('serves an empty file without passing a negative end offset to fs', async () => {
    const response = await fetch(`${baseUrl}/tracks/empty/${endpoint}`);
    expect(response.status).toBe(200);
    expect(response.headers.get('content-length')).toBe('0');
    expect((await response.arrayBuffer()).byteLength).toBe(0);
  });

  it('rejects a range against an empty representation', async () => {
    const response = await fetch(`${baseUrl}/tracks/empty/${endpoint}`, { headers: { range: 'bytes=0-' } });
    expect(response.status).toBe(416);
    expect(response.headers.get('content-range')).toBe('bytes */0');
    await response.arrayBuffer();
  });

  it.each(['missing', 'deleted'])('returns 404 for %s files', async (id) => {
    const response = await fetch(`${baseUrl}/tracks/${id}/${endpoint}`);
    expect(response.status).toBe(404);
    await response.arrayBuffer();
  });
});

describe('capability-selected compatible playback', () => {
  it('also supports seeking in files that need no transcoding', async () => {
    const response = await fetch(`${baseUrl}/tracks/seek/play`, { headers: { 'user-agent': safari, range: 'bytes=2-5' } });
    expect(response.status).toBe(206);
    expect(await response.text()).toBe('2345');
  });

  it('returns a sanitized error when the source cannot be decoded', async () => {
    const response = await fetch(`${baseUrl}/tracks/invalid-flac/play?format=mp3`, { headers: { 'user-agent': safari } });
    expect(response.status).toBe(503);
    const error = await response.text();
    expect(error).toContain('Compatible audio playback could not be prepared');
    expect(error).not.toContain(directory);
  });

  it.skipIf(!hasFfmpeg)('does not infer codec support from a Safari User-Agent', async () => {
    const response = await fetch(`${baseUrl}/tracks/flac/play`, { headers: { 'user-agent': safari } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/flac');
    expect(Buffer.from(await response.arrayBuffer())).toEqual(await readFile(join(directory, 'synthetic.flac')));
  });

  it.skipIf(!hasFfmpeg)('finalizes real MP3 then serves byte-exact suffix and middle ranges for unsupported FLAC', async () => {
    const response = await fetch(`${baseUrl}/tracks/flac/play?unsupported=flac`, { headers: { 'user-agent': safari } });
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('audio/mpeg');
    expect(response.headers.get('accept-ranges')).toBe('bytes');
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    const actual = Buffer.from(await response.arrayBuffer());
    expect(Number(response.headers.get('content-length'))).toBe(actual.length);
    expect(actual.length).toBeGreaterThan(16);
    const metadata = await parseBuffer(actual, { mimeType: 'audio/mpeg' }, { duration: true });
    expect(metadata.format.codec).toContain('MPEG');
    expect(metadata.format.duration).toBeGreaterThanOrEqual(.25);
    expect(metadata.format.duration).toBeLessThan(.5);
    expect(actual).not.toEqual(await readFile(join(directory, 'synthetic.flac')));
    for (const [header, start, end] of [['bytes=2-15', 2, 15], ['bytes=-16', actual.length - 16, actual.length - 1]] as const) {
      const range = await fetch(`${baseUrl}/tracks/flac/play?format=mp3`, { headers: { range: header } });
      expect(range.status).toBe(206);
      expect(range.headers.get('content-range')).toBe(`bytes ${start}-${end}/${actual.length}`);
      expect(Number(range.headers.get('content-length'))).toBe(end - start + 1);
      expect(Buffer.from(await range.arrayBuffer())).toEqual(actual.subarray(start, end + 1));
    }
    const invalid = await fetch(`${baseUrl}/tracks/flac/play?format=mp3`, { headers: { range: 'bytes=999999999-' } });
    expect(invalid.status).toBe(416);
    expect(invalid.headers.get('content-range')).toBe(`bytes */${actual.length}`);
  });

  it.each(['format=aac', 'format=mp3&format=aac', 'unsupported=anything', 'unsupported=ogg&unsupported=flac'])('rejects unsupported format selectors: %s', async query => {
    expect((await fetch(`${baseUrl}/tracks/seek/play?${query}`)).status).toBe(400);
  });
});
