import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mkdtemp, mkdir, copyFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { parseFile } from 'music-metadata';
import { migrateTestDatabase } from '../helpers/database';

// Framework config shim and external enrichment boundary only. Metadata parsing,
// scanner discovery, scanner persistence and SQLite are the real implementations.
vi.mock('#imports', () => ({ useRuntimeConfig: () => ({ scannerDisableGenius: 'true' }) }));
vi.mock('~/server/utils/genius-service', () => ({
  GeniusService: class { constructor() { throw new Error('Genius must be disabled for offline ingestion'); } },
}));
vi.mock('~/server/utils/musicbrainz', () => ({
  searchReleaseByTitleAndArtist: vi.fn(async () => null),
  getReleaseInfoWithTags: vi.fn(async () => null),
  getReleaseTracklist: vi.fn(async () => []),
}));
import { db } from '~/server/db';
import { users, albums, tracks, artists, albumArtists, artistsTracks } from '~/server/db/schema';
import { findAudioFiles } from '~/server/utils/scanner/file-utils';
import { processAudioFile } from '~/server/utils/scanner';
import { resetScanSession } from '~/server/utils/scanner/db-operations';

const root = resolve('tests/fixtures/music');
const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));

describe('licensed music fixtures through the real scanner', () => {
  let libraryPath: string;
  beforeAll(async () => {
    libraryPath = await mkdtemp(join(tmpdir(), 'lyra-licensed-library-'));
    for (const fixture of manifest.tracks) {
      const albumDirectory = join(libraryPath, fixture.album);
      await mkdir(albumDirectory);
      await copyFile(resolve(root, fixture.file), join(albumDirectory, `${fixture.id}.mp3`));
    }
    migrateTestDatabase(db.$client);
    db.insert(users).values({ userId: 'fixture-listener', name: 'Fixture listener', email: 'fixture@example.test', passwordHash: 'not-used-for-auth' }).run();
    vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Unexpected network call in offline music test'); }));
  });
  afterAll(async () => { vi.unstubAllGlobals(); if (libraryPath) await rm(libraryPath, { recursive: true, force: true }); });

  it('pins licensed audio bytes and independently parses tagged album metadata', async () => {
    const discovered = await findAudioFiles(resolve(root, 'audio'));
    expect(discovered).toHaveLength(3);
    for (const fixture of manifest.tracks) {
      const file = resolve(root, fixture.file);
      expect(discovered).toContain(file);
      expect(createHash('sha256').update(readFileSync(file)).digest('hex')).toBe(fixture.sha256);
      const metadata = await parseFile(file, { duration: true });
      expect(metadata.common.title).toBe(fixture.title);
      expect(metadata.common.album).toBe(fixture.album);
      expect(metadata.common.artist).toBe(manifest.artist);
      expect(metadata.common.track.no).toBe(fixture.trackNumber);
      expect(metadata.format.duration).toBeGreaterThanOrEqual(12);
      expect(metadata.format.duration).toBeLessThan(12.2);
      expect(metadata.format.numberOfChannels).toBe(2);
    }
  });

  it('imports two albums, links their artist and preserves identity on a second scan', async () => {
    const ingest = async () => {
      await resetScanSession();
      for (const fixture of manifest.tracks) {
        const result = await processAudioFile(join(libraryPath, fixture.album, `${fixture.id}.mp3`), {
          userId: 'fixture-listener', artistsProcessedForImages: new Set([manifest.artist]),
        });
        expect(result).toMatchObject({ title: fixture.album, primaryArtistName: manifest.artist });
      }
    };
    await ingest();
    const originalTrackIds = db.select().from(tracks).all().map((track) => track.trackId).sort();
    expect(db.select().from(albums).all().map((album) => album.title).sort()).toEqual(['Library Songs 5', 'Monomyth']);
    expect(db.select().from(artists).all()).toHaveLength(1);
    expect(db.select().from(albumArtists).all()).toHaveLength(2);
    expect(db.select().from(artistsTracks).all()).toHaveLength(2);
    await ingest();
    expect(db.select().from(tracks).all().map((track) => track.trackId).sort()).toEqual(originalTrackIds);
    expect(db.select().from(albums).all()).toHaveLength(2);
    expect(db.select().from(albumArtists).all()).toHaveLength(2);
    expect(db.select().from(artistsTracks).all()).toHaveLength(2);
    expect(fetch).not.toHaveBeenCalled();
  });
});
