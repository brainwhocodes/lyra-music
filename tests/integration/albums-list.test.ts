import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { db } from '~/server/db';
import { albums, albumArtists, artists, users } from '~/server/db/schema';
import listAlbums from '~/server/api/albums/index.get';
import { generateToken } from '~/server/utils/auth';
import { migrateTestDatabase } from '../helpers/database';
import { serveHandler } from '../helpers/http';

describe('album artist filtering over HTTP', () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  let token: string;
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'album-filter-secret-not-for-real-accounts' }));
    migrateTestDatabase(db.$client);
    db.insert(users).values(['listener', 'other'].map(userId => ({ userId, email: `${userId}@example.test`, name: userId, passwordHash: 'unused' }))).run();
    db.insert(artists).values([{ artistId: 'featured', name: 'Featured artist' }, { artistId: 'primary', name: 'Primary artist' }]).run();
    db.insert(albums).values([
      { albumId: 'collaboration', userId: 'listener', title: 'Collaboration' },
      { albumId: 'unrelated', userId: 'listener', title: 'Unrelated' },
      { albumId: 'other-library', userId: 'other', title: 'Other library' },
    ]).run();
    db.insert(albumArtists).values([
      { albumId: 'collaboration', artistId: 'featured', isPrimaryArtist: 0 },
      { albumId: 'collaboration', artistId: 'primary', isPrimaryArtist: 1 },
      { albumId: 'other-library', artistId: 'featured', isPrimaryArtist: 1 },
    ]).run();
    token = generateToken({ userId: 'listener', email: 'listener@example.test', name: 'Listener' });
    server = await serveHandler('/api/albums', listAlbums);
  });
  afterAll(async () => { await server.close(); db.$client.close(); vi.unstubAllGlobals(); });
  it('honors artistId for any album credit and preserves existing library ownership', async () => {
    const response = await fetch(`${server.url}/api/albums?artistId=featured`, { headers: { authorization: `Bearer ${token}` } });
    expect(response.status).toBe(200);
    expect((await response.json()).map((album: any) => album.albumId)).toEqual(['collaboration']);
  });
  it('returns an empty result for an unknown artist', async () => {
    expect(await (await fetch(`${server.url}/api/albums?artistId=missing`, { headers: { authorization: `Bearer ${token}` } })).json()).toEqual([]);
  });
});
