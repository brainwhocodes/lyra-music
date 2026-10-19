import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp, createRouter, toNodeListener } from 'h3';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import jwt from 'jsonwebtoken';
import { albums, tracks, users } from '../../server/db/schema';
import { migrateTestDatabase } from '../helpers/database';

const state = vi.hoisted(() => ({ db: undefined as any }));
vi.mock('../../server/db', () => ({ db: state.db }));
let sqlite: Database.Database;
let server: Server;
let url: string;
const secret = 'plays-integration-only-test-secret-32';
const request = (body: unknown, userId: string | null = 'alice') => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json', ...(userId ? { Authorization: `Bearer ${jwt.sign({ userId, name: userId, email: `${userId}@test.invalid` }, secret)}` } : {}) }, body: JSON.stringify(body),
});
beforeAll(async () => {
  sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys = ON'); migrateTestDatabase(sqlite); state.db = drizzle(sqlite);
  vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: secret }));
  const router = createRouter(); router.post('/api/plays', (await import('../../server/api/plays.post')).default);
  const app = createApp(); app.use(router); server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}/api/plays`;
});
beforeEach(() => {
  sqlite.exec('DELETE FROM user_track_plays; DELETE FROM tracks; DELETE FROM albums; DELETE FROM users;');
  for (const userId of ['alice', 'bob']) {
    state.db.insert(users).values({ userId, name: userId, email: `${userId}@test.invalid`, passwordHash: 'unused' }).run();
    state.db.insert(albums).values({ albumId: `${userId}-album`, userId, title: userId }).run();
    state.db.insert(tracks).values({ trackId: `${userId}-track`, albumId: `${userId}-album`, title: userId, filePath: `/private/${userId}.mp3` }).run();
  }
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); sqlite.close(); vi.unstubAllGlobals();
});

describe('recorded-play authentication, ownership and input bounds', () => {
  it('requires a valid authenticated account and never records another account track', async () => {
    expect((await request({ trackId: 'alice-track' }, null)).status).toBe(401);
    expect((await request({ trackId: 'bob-track' })).status).toBe(404);
    expect((await request({ trackId: 'missing-track' })).status).toBe(404);
    expect(sqlite.prepare('SELECT count(*) n FROM user_track_plays').get()).toEqual({ n: 0 });
  });
  it('rejects malformed durations, empty IDs, oversized sources and non-object bodies', async () => {
    for (const body of [null, [], {}, { trackId: '' }, ...[-1, 1.5, 86_400_001, '30000'].map(playDurationMs => ({ trackId: 'alice-track', playDurationMs })), { trackId: 'alice-track', source: 'x'.repeat(101) }]) {
      expect((await request(body)).status).toBe(400);
    }
    expect(sqlite.prepare('SELECT count(*) n FROM user_track_plays').get()).toEqual({ n: 0 });
  });
  it('stores server time and the authenticated user rather than body-supplied identities', async () => {
    expect(await (await request({ trackId: 'alice-track', playDurationMs: 30_000, source: 'web-player', userId: 'bob', playedAt: '2099-01-01' })).json()).toMatchObject({ success: true });
    const row = sqlite.prepare('SELECT user_id, track_id, played_at, play_duration_ms, source FROM user_track_plays').get() as any;
    expect(row).toMatchObject({ user_id: 'alice', track_id: 'alice-track', play_duration_ms: 30_000, source: 'web-player' });
    expect(Math.abs(Date.now() - Date.parse(row.played_at))).toBeLessThan(5000);
  });
});
