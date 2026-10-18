import { test, expect, vi } from 'vitest';
import { readFile, writeFile, stat, open } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { scryptSync, randomBytes } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { parseFile } from 'music-metadata';
import { validatePrivateRun, validatePrivateManifest } from '../../scripts/private-albums-paths.mjs';

// Only providers outside the application boundary are replaced. Metadata,
// artwork conversion, file discovery, scanner deduplication, and SQLite are real.
vi.mock('#imports', () => ({ useRuntimeConfig: () => ({ scannerDisableGenius: 'true' }) }));
vi.mock('~/server/utils/genius-service', () => ({ GeniusService: class {
  constructor() { throw new Error('Private offline import must not contact Genius'); }
} }));
vi.mock('~/server/utils/musicbrainz', () => ({
  searchReleaseByTitleAndArtist: vi.fn(async () => null),
  getReleaseInfoWithTags: vi.fn(async () => null),
  getReleaseTracklist: vi.fn(async () => []),
}));

test('imports every private file with real metadata, artwork, codec decoding, and idempotent rescanning', async () => {
  const repository = resolve(import.meta.dirname, '../..');
  if (!process.env.LYRA_PRIVATE_RUN) throw new Error('Launch through scripts/private-albums.mjs; a fresh isolated run directory is required');
  const run = await validatePrivateRun(repository, process.env.LYRA_PRIVATE_RUN, true);
  const extracted = join(repository, '.test-data/private-albums/extracted');
  const manifest = JSON.parse(await readFile(join(extracted, 'manifest.json'), 'utf8'));
  const expectedFiles = await validatePrivateManifest(repository, manifest);
  expect(expectedFiles.length).toBeGreaterThan(0);
  const metadata = await Promise.all(expectedFiles.map(async (file: string) => ({ file, metadata: await parseFile(file, { duration: true }) })));
  const artistNames = new Set<string>();
  const { splitArtistString } = await import('~/server/utils/artist-utils');
  for (const item of metadata) {
    for (const name of splitArtistString(item.metadata.common.artist || '')) artistNames.add(name);
    for (const name of splitArtistString(item.metadata.common.albumartist || '')) artistNames.add(name);
  }
  const sqlFiles = await Promise.all(['0000_sloppy_mole_man.sql', '0002_colossal_christian_walker.sql', '0003_track_embeddings.sql']
    .map(file => readFile(join(repository, 'server/db/migrations', file), 'utf8')));
  // Atomically reserve this run's new database. A concurrent or redirected
  // preexisting filename causes EEXIST before SQLite can touch it.
  const reservation = await open(join(run, 'library.sqlite'), 'wx');
  await reservation.close();
  // Scanner artwork is relative to cwd. Move only this fork into its allocated
  // private runtime before importing scanner modules, never the user's checkout.
  process.chdir(run);
  process.env.DATABASE_URL = join(run, 'library.sqlite');
  process.env.NODE_ENV = 'test';
  const { db } = await import('~/server/db');
  const sqlite = db.$client;
  for (const sql of sqlFiles) sqlite.exec(sql);
  const salt = randomBytes(16);
  const credentials = { email: 'private@example.test', password: randomBytes(32).toString('base64url') };
  const hash = `$scrypt$ln=14,r=8,p=1$${salt.toString('base64')}$${scryptSync(credentials.password, salt, 64).toString('base64')}`;
  const now = new Date().toISOString();
  sqlite.prepare('INSERT INTO users (user_id,name,email,verified,password_hash,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run('private-listener', 'Private local listener', 'private@example.test', 1, hash, now, now);
  const { findAudioFiles } = await import('~/server/utils/scanner/file-utils');
  const { processAudioFile } = await import('~/server/utils/scanner');
  const { resetScanSession } = await import('~/server/utils/scanner/db-operations');
  const discovered = await findAudioFiles(extracted);
  expect(discovered.map(file => resolve(file)).sort()).toEqual(expectedFiles.map((file: string) => resolve(file)).sort());
  const originalFetch = globalThis.fetch;
  globalThis.fetch = vi.fn(async () => { throw new Error('Unexpected outbound network during private offline scan'); });
  try {
    for (const file of discovered) {
      expect(await processAudioFile(file, { userId: 'private-listener', artistsProcessedForImages: artistNames })).not.toBeNull();
    }
    const before = sqlite.prepare('SELECT track_id AS id,file_path AS filePath,title,album_id AS albumId,duration,track_number AS trackNumber FROM tracks ORDER BY track_id').all() as any[];
    expect(before).toHaveLength(expectedFiles.length);
    expect(new Set(before.map(row => row.filePath)).size).toBe(expectedFiles.length);
    const albums = sqlite.prepare('SELECT album_id AS id,title,cover_path AS coverPath FROM albums ORDER BY title').all() as any[];
    expect(albums).toHaveLength(new Set(metadata.map(item => item.metadata.common.album)).size);
    expect(albums).toHaveLength(manifest.archives.length);
    let covers = 0;
    for (const album of albums) {
      expect(album.coverPath).toMatch(/^\/uploads\/images\/covers\/[a-f0-9]+\.webp$/);
      expect((await stat(join(run, album.coverPath))).size).toBeGreaterThan(100);
      covers++;
    }
    let unicodeTracks = 0;
    const codecs = new Set<string>();
    const tracks = [];
    for (const item of metadata) {
      const row = before.find(row => row.filePath === item.file);
      expect(row.title).toBe(item.metadata.common.title?.trim());
      expect(row.duration).toBe(Math.round(item.metadata.format.duration!));
      expect(row.trackNumber).toBe(item.metadata.common.track.no);
      expect(row.duration).toBeGreaterThan(30);
      if (/[^\x00-\x7f]/.test(row.title)) unicodeTracks++;
      const codec = item.metadata.format.codec || item.metadata.format.container || 'unknown';
      codecs.add(codec);
      // Decode the entire original file, not merely its header or first frame.
      execFileSync(process.env.FFMPEG_PATH || 'ffmpeg', ['-v', 'error', '-xerror', '-i', item.file, '-map', '0:a:0', '-f', 'null', '-'], { stdio: 'pipe', timeout: 60_000 });
      tracks.push({ ...row, codec, sampleRate: item.metadata.format.sampleRate,
        channels: item.metadata.format.numberOfChannels, exactDuration: item.metadata.format.duration,
        artist: item.metadata.common.artist, album: item.metadata.common.album });
    }
    expect(unicodeTracks).toBeGreaterThan(0);
    resetScanSession();
    for (const file of discovered) await processAudioFile(file, { userId: 'private-listener', artistsProcessedForImages: artistNames });
    expect(sqlite.prepare('SELECT track_id AS id,file_path AS filePath,title,album_id AS albumId,duration,track_number AS trackNumber FROM tracks ORDER BY track_id').all()).toEqual(before);
    expect(sqlite.prepare('SELECT COUNT(*) AS n FROM albums').get()).toEqual({ n: albums.length });
    const artists = sqlite.prepare('SELECT artist_id AS id,name FROM artists').all();
    const genres = sqlite.prepare('SELECT genre_id AS id,name FROM genres').all();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    const report = { private: true, databasePath: process.env.DATABASE_URL, credentials, run, tracks, albums, artists, genres,
      aggregate: { archives: manifest.archives.length, tracks: tracks.length, albums: albums.length, covers,
        unicodeTracks, codecs: [...codecs], totalDurationSeconds: tracks.reduce((sum, track) => sum + track.exactDuration, 0),
        longestTrackSeconds: Math.max(...tracks.map(track => track.exactDuration)), fullyDecodedFiles: tracks.length,
        idempotentRescan: true, outboundProviderCalls: 0 } };
    await writeFile(join(run, 'import-report.json'), JSON.stringify(report, null, 2));
    sqlite.pragma('wal_checkpoint(TRUNCATE)');
  } finally {
    globalThis.fetch = originalFetch;
    sqlite.close();
    process.chdir(repository);
  }
});
