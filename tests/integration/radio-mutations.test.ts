import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { readFile, writeFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '~/server/db';
import { artists, genres, playlists, playlistTracks, radioChannels, radioChannelArtists, radioChannelGenres, tracks, users } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateToken } from '~/server/utils/auth';
import createStation from '~/server/api/radio-stations/index.post';
import updateStation from '~/server/api/radio-stations/[id]/index.put';
import deleteStation from '~/server/api/radio-stations/[id]/index.delete';
import updateImages from '~/server/api/radio-stations/[id]/images.put';
import updateTracks from '~/server/api/playlists/[id]/tracks.post';
import { migrateTestDatabase } from '../helpers/database';
import { stationImagePath } from '~/server/utils/radio-station';

describe('radio and playlist mutations over real JWT/HTTP/SQLite', () => {
  let server: ReturnType<typeof createServer>, origin: string;
  const token = (userId: string) => generateToken({ userId, name: userId, email: `${userId}@example.test` });
  const request = (url: string, method: string, body?: unknown, user: string | null = 'owner') => fetch(origin + url, {
    method, headers: { ...(user ? { authorization: `Bearer ${token(user)}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'radio-integration-secret-not-for-real-accounts' }));
    db.$client.pragma('foreign_keys = ON'); migrateTestDatabase(db.$client);
    db.insert(users).values(['owner', 'other'].map(userId => ({ userId, name: userId, email: `${userId}@example.test`, passwordHash: 'unused' }))).run();
    db.insert(artists).values([{ artistId: 'a', name: 'A' }, { artistId: 'b', name: 'B' }]).run();
    db.insert(genres).values({ genreId: 'g', name: 'Classical' }).run();
    db.insert(tracks).values([{ trackId: 'one', title: 'One', filePath: '/shared/one.mp3' }, { trackId: 'two', title: 'Two', filePath: '/shared/two.mp3' }]).run();
    const router = createRouter().post('/api/radio-stations', createStation)
      .put('/api/radio-stations/:id', updateStation).delete('/api/radio-stations/:id', deleteStation)
      .put('/api/radio-stations/:id/images', updateImages).post('/api/playlists/:id/tracks', updateTracks);
    server = createServer(toNodeListener(createApp().use(router)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => {
    db.delete(radioChannels).run(); db.delete(playlists).run();
    db.insert(radioChannels).values({ channelId: 'station', userId: 'owner', name: 'Original' }).run();
    db.insert(radioChannelArtists).values({ channelId: 'station', artistId: 'a' }).run();
    db.insert(playlists).values({ playlistId: 'list', userId: 'owner', name: 'Mix' }).run();
  });
  afterAll(async () => {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    db.$client.close(); vi.unstubAllGlobals();
  });

  it('creates a station and seed relations atomically, deduplicating requested seeds', async () => {
    const response = await request('/api/radio-stations', 'POST', { name: ' New station ', artistIds: ['a', 'a'], genreIds: ['g'] });
    expect(response.status).toBe(200);
    const created = await response.json();
    expect(created).toMatchObject({ name: 'New station', userId: 'owner' });
    expect(created.radioChannelArtists).toHaveLength(1); expect(created.radioChannelGenres).toHaveLength(1);
    expect(db.select().from(radioChannels).all()).toHaveLength(2);
  });
  it('updates seeds and name, preserving original state on invalid replacement', async () => {
    expect((await request('/api/radio-stations/station', 'PUT', { name: 'Changed', artistIds: ['b'], genreIds: ['g'] })).status).toBe(200);
    expect((await request('/api/radio-stations/station', 'PUT', { name: 'Bad', artistIds: ['missing'] })).status).toBe(400);
    expect(db.select().from(radioChannels).get()?.name).toBe('Changed');
    expect(db.select().from(radioChannelArtists).all().map(x => x.artistId)).toEqual(['b']);
    expect(db.select().from(radioChannelGenres).all().map(x => x.genreId)).toEqual(['g']);
  });
  it('does not create a partial station for nonexistent seeds or invalid bodies', async () => {
    for (const body of [null, {}, { name: ' ' }, { name: 'Bad', artistIds: ['missing'] }]) {
      expect((await request('/api/radio-stations', 'POST', body)).status).toBe(400);
      expect(db.select().from(radioChannels).all()).toHaveLength(1);
    }
  });
  it('preserves seeds when the branding form changes only the name', async () => {
    expect((await request('/api/radio-stations/station', 'PUT', { name: 'New name' })).status).toBe(200);
    expect(db.select().from(radioChannelArtists).all().map(x => x.artistId)).toEqual(['a']);
    expect((await request('/api/radio-stations/station', 'PUT', { name: 'New name', artistIds: [] })).status).toBe(200);
    expect(db.select().from(radioChannelArtists).all()).toEqual([]);
  });
  it('allows station changes only by its owner', async () => {
    for (const [url, method, body] of [
      ['/api/radio-stations/station', 'PUT', { name: 'Stolen' }],
      ['/api/radio-stations/station', 'DELETE', undefined],
      ['/api/radio-stations/station/images', 'PUT', {}],
    ] as const) {
      expect((await request(url, method, body, 'other')).status).toBe(404);
      expect((await request(url, method, body, null)).status).toBe(401);
      expect(db.select().from(radioChannels).get()?.name).toBe('Original');
    }
    expect((await request('/api/radio-stations', 'POST', { name: 'Anonymous' }, null)).status).toBe(401);
  });
  it('deletes owned stations and dependent seeds while refusing arbitrary image paths', async () => {
    const sentinel = path.resolve('.test-radio-delete-sentinel');
    await writeFile(sentinel, 'keep');
    try {
      db.update(radioChannels).set({ logoImagePath: sentinel }).where(eq(radioChannels.channelId, 'station')).run();
      expect((await request('/api/radio-stations/station', 'DELETE')).status).toBe(200);
      expect(db.select().from(radioChannelArtists).all()).toEqual([]);
      expect(await readFile(sentinel, 'utf8')).toBe('keep');
      expect((await request('/api/radio-stations/missing', 'DELETE')).status).toBe(404);
    } finally { await unlink(sentinel); }
  });
  it('validates actual image bytes and extensions before writing; valid image is removed on station deletion', async () => {
    for (const body of [null, { logoImageBase64: 'dGVzdA==', logoImageExtension: '/../../outside.txt' }, { logoImageBase64: 'dGVzdA==', logoImageExtension: '.png' }]) {
      expect((await request('/api/radio-stations/station/images', 'PUT', body)).status).toBe(400);
      expect(db.select().from(radioChannels).get()?.logoImagePath).toBeNull();
    }
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const response = await request('/api/radio-stations/station/images', 'PUT', { logoImageBase64: png.toString('base64'), logoImageExtension: '.png' });
    expect(response.status).toBe(200);
    const imagePath = stationImagePath((await response.json()).logoImagePath)!;
    let replacementPath: string | undefined;
    try {
      expect(await readFile(imagePath)).toEqual(png);
      const replacement = await request('/api/radio-stations/station/images', 'PUT', { logoImageBase64: png.toString('base64'), logoImageExtension: '.png' });
      expect(replacement.status).toBe(200);
      replacementPath = stationImagePath((await replacement.json()).logoImagePath)!;
      expect(replacementPath).not.toBe(imagePath);
      await expect(readFile(imagePath)).rejects.toMatchObject({ code: 'ENOENT' });
      expect(await readFile(replacementPath)).toEqual(png);
      expect((await request('/api/radio-stations/station/images', 'PUT', { removeLogo: true, logoImageBase64: png.toString('base64'), logoImageExtension: '.png' })).status).toBe(400);
      expect(await readFile(replacementPath)).toEqual(png);
      const removed = await request('/api/radio-stations/station/images', 'PUT', { removeLogo: true });
      expect(removed.status).toBe(200);
      expect((await removed.json()).logoImagePath).toBeNull();
      await expect(readFile(replacementPath)).rejects.toMatchObject({ code: 'ENOENT' });
      await request('/api/radio-stations/station', 'DELETE');
      await expect(readFile(replacementPath)).rejects.toMatchObject({ code: 'ENOENT' });
    } finally {
      await unlink(imagePath).catch(() => {});
      if (replacementPath) await unlink(replacementPath).catch(() => {});
    }
  });
  it('deduplicates playlist additions within a request and across retries, then compacts removal', async () => {
    for (let i = 0; i < 2; i++) expect((await request('/api/playlists/list/tracks', 'POST', { action: 'add', trackIds: ['one', 'one', 'two'] })).status).toBe(200);
    expect(db.select().from(playlistTracks).all().map(x => [x.trackId, x.order])).toEqual([['one', 0], ['two', 1]]);
    expect((await request('/api/playlists/list/tracks', 'POST', { action: 'remove', trackIds: ['one'] })).status).toBe(200);
    expect(db.select().from(playlistTracks).all().map(x => [x.trackId, x.order])).toEqual([['two', 0]]);
  });
  it('rejects malformed playlist IDs and foreign/anonymous playlist mutations without writes', async () => {
    for (const body of [null, {}, { action: 'add', trackIds: [] }, { action: 'add', trackIds: [42] }, { action: 'add', trackIds: ['missing'] }]) {
      expect((await request('/api/playlists/list/tracks', 'POST', body)).status).toBe(400);
    }
    expect((await request('/api/playlists/list/tracks', 'POST', { action: 'add', trackIds: ['one'] }, 'other')).status).toBe(404);
    expect((await request('/api/playlists/list/tracks', 'POST', { action: 'add', trackIds: ['one'] }, null)).status).toBe(401);
    expect(db.select().from(playlistTracks).all()).toEqual([]);
  });
});
