import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createError, createRouter, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { db } from '~/server/db';
import { albums, artists, artistsTracks, discoveryPlaylists, discoveryPlaylistTracks, playlists, playlistTracks, tracks, users } from '~/server/db/schema';
import { generateToken } from '~/server/utils/auth';
import getPlaylist from '~/server/api/playlists/[id]/index.get';
import updatePlaylist from '~/server/api/playlists/[id]/index.put';
import removeTracks from '~/server/api/playlists/[id]/tracks.delete';
import reorderTracks from '~/server/api/playlists/[id]/reorder.put';
import getDiscovery from '~/server/api/discovery-playlists/[id]/index.get';
import { migrateTestDatabase } from '../helpers/database';

describe('collection routes with real HTTP, JWT sessions and SQLite', () => {
  let server: ReturnType<typeof createServer>;
  let origin: string;
  let token: string;
  let otherToken: string;
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'collection-test-secret-not-for-real-accounts' }));
    vi.stubGlobal('createError', createError);
    migrateTestDatabase(db.$client);
    db.insert(users).values(['listener', 'other'].map(userId => ({ userId, email: `${userId}@example.test`, name: userId, passwordHash: 'unused' }))).run();
    db.insert(albums).values({ albumId: 'album', userId: 'listener', title: 'Free music' }).run();
    db.insert(artists).values([{ artistId: 'primary', name: 'Primary Artist' }, { artistId: 'guest', name: 'Guest Artist' }]).run();
    db.insert(tracks).values([
      { trackId: 'together', albumId: 'album', title: 'Together', filePath: '/test/together.mp3' },
      { trackId: 'solo', albumId: 'album', title: 'Solo', filePath: '/test/solo.mp3' },
      { trackId: 'uncredited', title: 'Uncredited', filePath: '/test/uncredited.mp3' },
    ]).run();
    db.insert(artistsTracks).values([
      { trackId: 'together', artistId: 'guest', isPrimaryArtist: 0 },
      { trackId: 'together', artistId: 'primary', isPrimaryArtist: 1 },
      { trackId: 'solo', artistId: 'guest', isPrimaryArtist: 0 },
    ]).run();
    token = generateToken({ userId: 'listener', name: 'Listener', email: 'listener@example.test' });
    otherToken = generateToken({ userId: 'other', name: 'Other', email: 'other@example.test' });
    const router = createRouter()
      .get('/api/playlists/:id', getPlaylist)
      .put('/api/playlists/:id', updatePlaylist)
      .delete('/api/playlists/:id/tracks', removeTracks)
      .put('/api/playlists/:id/reorder', reorderTracks)
      .get('/api/discovery-playlists/:id', getDiscovery);
    server = createServer(toNodeListener(createApp().use(router)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => {
    db.delete(playlistTracks).run(); db.delete(discoveryPlaylistTracks).run();
    db.delete(playlists).run(); db.delete(discoveryPlaylists).run();
    db.insert(playlists).values([
      { playlistId: 'list', userId: 'listener', name: 'Local listening' },
      { playlistId: 'other-list', userId: 'listener', name: 'Other mix' },
    ]).run();
    db.insert(discoveryPlaylists).values({ discoveryPlaylistId: 'discovery', userId: 'listener', title: 'Quiet discoveries', type: 'new_discoveries' }).run();
    ['together', 'solo', 'uncredited'].forEach((trackId, order) => {
      db.insert(playlistTracks).values({ playlistTrackId: `item-${order}`, playlistId: 'list', trackId, order }).run();
      db.insert(discoveryPlaylistTracks).values({ discoveryPlaylistId: 'discovery', trackId, order }).run();
    });
  });
  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    db.$client.close(); vi.unstubAllGlobals();
  });
  const request = (path: string, method = 'GET', body?: unknown, auth: string | null = token) => fetch(`${origin}${path}`, {
    method, headers: { ...(auth ? { authorization: `Bearer ${auth}` } : {}), ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

  it.each(['/api/playlists/list', '/api/discovery-playlists/discovery'])('hydrates %s without duplicating collaboration tracks', async path => {
    const response = await request(path);
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.trackCount).toBe(3);
    expect(value.tracks.map((item: any) => item.track.trackId)).toEqual(['together', 'solo', 'uncredited']);
    expect(value.tracks[0].track).toMatchObject({ artistId: 'primary', artistName: 'Primary Artist', albumTitle: 'Free music' });
    expect(value.tracks[0].track.artists).toHaveLength(2);
    expect(value.tracks[1].track.artistName).toBe('Guest Artist');
    expect(value.tracks[2].track.artists).toEqual([]);
    if (path.includes('/playlists/')) expect(value).toMatchObject({ name: 'Local listening', userId: 'listener' });
  });

  it('renames and allows a no-op rename while rejecting a conflicting name', async () => {
    for (const name of ['Local listening', ' Renamed listening ']) {
      const response = await request('/api/playlists/list', 'PUT', { name });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ name: name.trim() });
    }
    expect((await request('/api/playlists/list', 'PUT', { name: 'Other mix' })).status).toBe(409);
    expect((await (await request('/api/playlists/list')).json()).name).toBe('Renamed listening');
    expect((await request('/api/playlists/list', 'PUT', { name: 42 })).status).toBe(400);
  });

  it('removes selected tracks and returns playable remaining tracks with sequential order', async () => {
    const response = await request('/api/playlists/list/tracks', 'DELETE', { trackIds: ['together', 'uncredited'] });
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.trackCount).toBe(1);
    expect(value.tracks).toEqual([expect.objectContaining({ order: 0, track: expect.objectContaining({ trackId: 'solo', artistName: 'Guest Artist' }) })]);
    expect((await (await request('/api/playlists/list')).json()).tracks).toEqual(value.tracks);
  });

  it('persists a complete reorder and rejects partial, duplicate or foreign entries without mutation', async () => {
    const response = await request('/api/playlists/list/reorder', 'PUT', { playlistTrackIds: ['item-2', 'item-0', 'item-1'] });
    expect(response.status).toBe(200);
    const value = await response.json();
    expect(value.tracks.map((item: any) => item.track.trackId)).toEqual(['uncredited', 'together', 'solo']);
    expect(value.tracks.map((item: any) => item.order)).toEqual([0, 1, 2]);
    for (const playlistTrackIds of [['item-0'], ['item-0', 'item-0', 'item-2'], ['item-0', 'item-1', 'foreign']]) {
      expect((await request('/api/playlists/list/reorder', 'PUT', { playlistTrackIds })).status).toBe(400);
      expect((await (await request('/api/playlists/list')).json()).tracks).toEqual(value.tracks);
    }
  });

  it.each([
    ['/api/playlists/list', 'GET', undefined],
    ['/api/discovery-playlists/discovery', 'GET', undefined],
    ['/api/playlists/list', 'PUT', { name: 'Stolen' }],
    ['/api/playlists/list/tracks', 'DELETE', { trackIds: ['together'] }],
    ['/api/playlists/list/reorder', 'PUT', { playlistTrackIds: ['item-2', 'item-1', 'item-0'] }],
  ])('protects %s %s from other listeners and unauthenticated requests', async (path, method, body) => {
    expect((await request(path as string, method as string, body, otherToken)).status).toBe(404);
    expect((await request(path as string, method as string, body, null)).status).toBe(401);
    expect((await (await request('/api/playlists/list')).json()).tracks.map((item: any) => item.track.trackId)).toEqual(['together', 'solo', 'uncredited']);
  });
});
