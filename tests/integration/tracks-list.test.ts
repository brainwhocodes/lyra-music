import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { db } from '~/server/db';
import { albums, artists, artistsTracks, tracks, users } from '~/server/db/schema';
import listTracks from '~/server/api/tracks/index.get';
import { migrateTestDatabase } from '../helpers/database';
import { serveHandler } from '../helpers/http';

describe('track list over HTTP and the actual many-to-many artist schema', () => {
  let server: Awaited<ReturnType<typeof serveHandler>>;
  beforeAll(async () => {
    migrateTestDatabase(db.$client);
    await db.insert(users).values({ userId: 'listener', email: 'listener@example.test', name: 'Listener', passwordHash: 'unused' });
    await db.insert(albums).values({ albumId: 'album', userId: 'listener', title: 'Free music' });
    await db.insert(artists).values([
      { artistId: 'primary', name: 'Primary Artist' },
      { artistId: 'guest', name: 'Guest Artist' },
    ]);
    await db.insert(tracks).values([
      { trackId: 'collaboration', albumId: 'album', title: 'Together', filePath: '/test/together.mp3', trackNumber: 1, genre: 'Folk' },
      { trackId: 'secondary-only', albumId: 'album', title: 'Solo', filePath: '/test/solo.mp3', trackNumber: 2 },
      { trackId: 'uncredited', title: 'Untitled', filePath: '/test/untitled.mp3' },
    ]);
    await db.insert(artistsTracks).values([
      { trackId: 'collaboration', artistId: 'guest', isPrimaryArtist: 0 },
      { trackId: 'collaboration', artistId: 'primary', isPrimaryArtist: 1 },
      { trackId: 'secondary-only', artistId: 'guest', isPrimaryArtist: 0 },
    ]);
    server = await serveHandler('/api/tracks', listTracks);
  });
  afterAll(async () => { await server?.close(); db.$client.close(); });

  it('returns each track once, preferring primary artist with a fallback credit', async () => {
    const response = await fetch(`${server.url}/api/tracks`);
    expect(response.status).toBe(200);
    const rows = await response.json();
    expect(rows).toHaveLength(3);
    expect(rows.find((track: any) => track.id === 'collaboration')).toMatchObject({ title: 'Together', artistName: 'Primary Artist', albumTitle: 'Free music' });
    expect(rows.find((track: any) => track.id === 'secondary-only')).toMatchObject({ artistName: 'Guest Artist' });
    expect(rows.find((track: any) => track.id === 'uncredited')).toMatchObject({ artistName: null });
  });

  it('filters the joined artist, album and title using real SQL', async () => {
    const response = await fetch(`${server.url}/api/tracks?artistName=Primary&albumId=album&title=gether&genre=Folk`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([expect.objectContaining({ id: 'collaboration', artistId: 'primary' })]);
  });
  it('filters by any credited artist ID, including a non-primary collaboration credit', async () => {
    const response = await fetch(`${server.url}/api/tracks?artistId=guest`);
    expect(response.status).toBe(200);
    expect((await response.json()).map((track: any) => track.id).sort()).toEqual(['collaboration', 'secondary-only']);
    expect(await (await fetch(`${server.url}/api/tracks?artistId=missing`)).json()).toEqual([]);
  });
});
