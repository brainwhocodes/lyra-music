import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp, createRouter, toNodeListener } from 'h3';
import { createServer } from 'node:http';
import { eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { mediaFolders, users } from '~/server/db/schema';
import { generateToken } from '~/server/utils/auth';
import listFolders from '~/server/api/settings/folders/index.get';
import deleteFolder from '~/server/api/settings/folders/[id].delete';
import { migrateTestDatabase } from '../helpers/database';

describe('media folder configuration ownership over real HTTP/JWT/SQLite', () => {
  let server: ReturnType<typeof createServer>, origin: string;
  const request = (method: string, url: string, user: string | null = 'owner') => fetch(origin + url, {
    method, headers: user ? { authorization: `Bearer ${generateToken({ userId: user, name: user, email: user + '@example.test' })}` } : {},
  });
  beforeAll(async () => {
    vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: 'folder-owner-integration-secret-not-for-real-accounts' }));
    db.$client.pragma('foreign_keys = ON'); migrateTestDatabase(db.$client);
    db.insert(users).values(['owner', 'other'].map(userId => ({ userId, name: userId, email: userId + '@example.test', passwordHash: 'unused' }))).run();
    const router = createRouter().get('/api/settings/folders', listFolders).delete('/api/settings/folders/:id', deleteFolder);
    server = createServer(toNodeListener(createApp().use(router)));
    await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
    origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
  });
  beforeEach(() => {
    db.delete(mediaFolders).run();
    db.insert(mediaFolders).values([
      { mediaFolderId: 'mine', userId: 'owner', path: '/private/owner/music' },
      { mediaFolderId: 'theirs', userId: 'other', path: '/private/other/music' },
    ]).run();
  });
  afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); db.$client.close(); vi.unstubAllGlobals(); });
  it('lists only the authenticated user’s folder configuration', async () => {
    const response = await request('GET', '/api/settings/folders');
    expect(response.status).toBe(200);
    expect((await response.json()).folders.map((folder: { mediaFolderId: string }) => folder.mediaFolderId)).toEqual(['mine']);
  });
  it('rejects anonymous reads and deletions without touching stored configuration', async () => {
    expect((await request('GET', '/api/settings/folders', null)).status).toBe(401);
    expect((await request('DELETE', '/api/settings/folders/mine', null)).status).toBe(401);
    expect(db.select().from(mediaFolders).all()).toHaveLength(2);
  });
  it('does not allow deleting another user’s folder even with its exact ID', async () => {
    expect((await request('DELETE', '/api/settings/folders/theirs')).status).toBe(404);
    expect(db.select().from(mediaFolders).where(eq(mediaFolders.mediaFolderId, 'theirs')).get()).toBeTruthy();
    expect((await request('DELETE', '/api/settings/folders/missing')).status).toBe(404);
  });
  it('lets the owner delete their own folder while preserving other users’ entries', async () => {
    expect((await request('DELETE', '/api/settings/folders/mine')).status).toBe(200);
    expect(db.select().from(mediaFolders).all().map(folder => folder.mediaFolderId)).toEqual(['theirs']);
  });
});
