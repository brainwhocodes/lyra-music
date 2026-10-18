import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createRouter, defineEventHandler, getRouterParam, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { db } from '~/server/db';
import { albumArtists, albums, artists, users } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import { generateToken } from '~/server/utils/auth';
import { migrateTestDatabase } from '../helpers/database';

describe('album edits through real multipart HTTP and SQLite', () => {
  let server: ReturnType<typeof createServer>, origin: string;
  const createdFiles: string[] = [];
  const headers = (user = 'owner') => ({ authorization: `Bearer ${generateToken({ userId: user, name: user, email: `${user}@example.test` })}` });
  const form = (values: Record<string, string>) => { const data = new FormData(); for (const [key, value] of Object.entries(values)) data.set(key, value); return data; };
  const update = (data: FormData, user: string | null = 'owner') => fetch(origin + '/api/albums/album', { method: 'PUT', headers: user ? headers(user) : {}, body: data });
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'album-integration-secret-not-for-real-accounts' }));
    // Existing Nuxt routes rely on auto-imports; the raw HTTP harness supplies them.
    vi.stubGlobal('defineEventHandler', defineEventHandler); vi.stubGlobal('getRouterParam', getRouterParam);
    db.$client.pragma('foreign_keys = ON'); migrateTestDatabase(db.$client);
    db.insert(users).values(['owner', 'other'].map(userId => ({ userId, name: userId, email: `${userId}@example.test`, passwordHash: 'unused' }))).run();
    db.insert(artists).values({ artistId: 'original-artist', name: 'Original artist' }).run();
    const updateAlbum = (await import('~/server/api/albums/[id].put')).default;
    const router = createRouter().put('/api/albums/:id', updateAlbum);
    // Import the runtime asset handler only in its own test to keep the pre-fix control executable.
    router.get('/uploads/**:path', defineEventHandler(async event => (await import('~/server/routes/uploads/[...path].get')).default(event)));
    server = createServer(toNodeListener(createApp().use(router)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => {
    db.delete(albums).run();
    db.insert(albums).values({ albumId: 'album', userId: 'owner', title: 'Original title', year: 2020 }).run();
    db.insert(albumArtists).values({ albumId: 'album', artistId: 'original-artist', isPrimaryArtist: 1 }).run();
  });
  afterAll(async () => {
    server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve()));
    await Promise.all(createdFiles.map(file => unlink(file).catch(() => {})));
    db.$client.close(); vi.unstubAllGlobals();
  });
  it('updates title and year successfully without disturbing artists', async () => {
    const response = await update(form({ title: '  New title  ', year: '2025' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ title: 'New title', year: 2025, artists: [{ name: 'Original artist', isPrimaryArtist: true }] });
    expect(db.select().from(albums).get()).toMatchObject({ title: 'New title', year: 2025 });
    expect((await update(form({ year: '' }))).status).toBe(200);
    expect(db.select().from(albums).get()?.year).toBeNull();
  });
  it('atomically replaces artists and deduplicates their relation records', async () => {
    const response = await update(form({ artistName: 'New artist, New artist, Original artist' }));
    expect(response.status).toBe(200);
    expect((await response.json()).artists).toMatchObject([{ name: 'New artist', isPrimaryArtist: true }, { name: 'Original artist', isPrimaryArtist: false }]);
    expect(db.select().from(albumArtists).all()).toHaveLength(2);
  });
  it('rejects malformed fields without partially changing title or relations', async () => {
    for (const fields of [{ title: 'Changed', artistName: '' }, { title: ' ' }, { title: 'Changed', year: '2025junk' }, { title: 'Changed', year: '-1' }]) {
      expect((await update(form(fields))).status).toBe(400);
      expect(db.select().from(albums).get()?.title).toBe('Original title');
      expect(db.select().from(albumArtists).all()).toHaveLength(1);
    }
  });
  it('rejects anonymous and other-user writes without changing the album', async () => {
    expect((await update(form({ title: 'Foreign' }), 'other')).status).toBe(404);
    expect((await update(form({ title: 'Anonymous' }), null)).status).toBe(401);
    expect(db.select().from(albums).get()?.title).toBe('Original title');
  });
  it('rejects disguised non-image content and oversized uploads before any album change', async () => {
    for (const [bytes, filename, status] of [[Buffer.from('<svg onload="alert(1)"/>'), 'cover.png', 400], [Buffer.alloc(5 * 1024 * 1024 + 1), 'cover.png', 413]] as const) {
      const data = form({ title: 'Changed' }); data.set('coverImage', new Blob([bytes]), filename);
      expect((await update(data)).status).toBe(status);
      expect(db.select().from(albums).get()?.coverPath).toBeNull();
      expect(db.select().from(albums).get()?.title).toBe('Original title');
    }
  });
  it('stores decoded raster images at safe runtime paths and serves them after upload', async () => {
    const png = await sharp({ create: { width: 2, height: 2, channels: 3, background: 'red' } }).png().toBuffer();
    const data = form({ title: 'With art' }); data.set('coverImage', new Blob([png]), '../../untrusted.html');
    const response = await update(data); expect(response.status).toBe(200);
    const { coverPath } = await response.json();
    expect(coverPath).toMatch(/^\/uploads\/images\/covers\/[a-f0-9-]{36}\.webp$/);
    const file = path.join(process.cwd(), coverPath); createdFiles.push(file);
    expect((await sharp(await readFile(file)).metadata()).format).toBe('webp');
    const image = await fetch(origin + coverPath, { headers: headers() });
    expect(image.status).toBe(200); expect(image.headers.get('content-type')).toBe('image/webp');
    expect(image.headers.get('x-content-type-options')).toBe('nosniff');
    expect((await image.arrayBuffer()).byteLength).toBeGreaterThan(0);
    expect((await fetch(origin + coverPath)).status).toBe(401);
    expect((await fetch(origin + '/uploads/images/covers/unknown.html', { headers: headers() })).status).toBe(404);
    const second = form({ title: 'Replacement' }); second.set('coverImage', new Blob([png]), 'cover.png');
    const replacement = await update(second); expect(replacement.status).toBe(200);
    createdFiles.push(path.join(process.cwd(), (await replacement.json()).coverPath));
    await expect(readFile(file)).rejects.toMatchObject({ code: 'ENOENT' });
  });
});
