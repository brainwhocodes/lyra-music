import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import { createApp, createRouter, toNodeListener } from 'h3';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import jwt from 'jsonwebtoken';
import { eq } from 'drizzle-orm';
import { albumGenres, albums, genres, lyrics, tracks, trackEmbeddings, users, userTrackPlays } from '../../server/db/schema';
import { migrateTestDatabase } from '../helpers/database';

const state = vi.hoisted(() => ({ embed: vi.fn(), db: undefined as any }));
vi.mock('../../server/db', () => ({ db: state.db }));
vi.mock('../../server/services/intelligence/embedding-service', async original => ({
  ...await original<typeof import('../../server/services/intelligence/embedding-service')>(), embedTexts: state.embed,
}));
const vector = Array<number>(256).fill(0); vector[0] = 1;
const secret = 'intelligence-integration-only-secret';
let sqlite: Database.Database;
let server: Server;
let baseURL: string;
const token = (userId: string) => jwt.sign({ userId, name: userId, email: `${userId}@example.test` }, secret);
const request = (path: string, userId: string | null = 'alice', body?: unknown) => fetch(`${baseURL}/api/intelligence/${path}`, {
  method: body !== undefined ? 'POST' : 'GET',
  headers: { ...(userId ? { Authorization: `Bearer ${token(userId)}` } : {}), ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
  ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
});
beforeAll(async () => {
  sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys = ON'); migrateTestDatabase(sqlite);
  state.db = drizzle(sqlite);
  vi.stubGlobal('useRuntimeConfig', () => ({ jwtSecret: secret }));
  const router = createRouter();
  for (const name of ['status', 'search', 'recommendations', 'tags']) router.get(`/api/intelligence/${name}`, (await import(`../../server/api/intelligence/${name}.get.ts`)).default);
  router.post('/api/intelligence/index', (await import('../../server/api/intelligence/index/index.post')).default);
  const app = createApp(); app.use(router);
  server = createServer(toNodeListener(app));
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  baseURL = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
beforeEach(() => {
  sqlite.exec('DELETE FROM recommendation_snapshots; DELETE FROM job_queue; DELETE FROM user_track_plays; DELETE FROM track_embeddings; DELETE FROM lyrics; DELETE FROM tracks; DELETE FROM albums; DELETE FROM genres; DELETE FROM users;');
  for (const userId of ['alice', 'bob']) {
    state.db.insert(users).values({ userId, name: userId, email: `${userId}@example.test`, passwordHash: 'unused' }).run();
    state.db.insert(albums).values({ albumId: `${userId}-album`, userId, title: `${userId} album` }).run();
    for (const n of [1, 2]) state.db.insert(tracks).values({ trackId: `${userId}-${n}`, albumId: `${userId}-album`, title: `${userId} song ${n}`, filePath: `/private/${userId}/${n}.mp3`, duration: 180 }).run();
  }
  state.embed.mockReset().mockImplementation(async inputs => inputs.map(() => [...vector]));
});
afterAll(async () => {
  await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  sqlite.close(); vi.unstubAllGlobals();
});

describe('intelligence HTTP, JWT and migrated SQLite (embedding boundary mocked)', () => {
  it('requires authentication for all endpoints before starting inference', async () => {
    for (const path of ['status', 'search?q=rain', 'recommendations', 'tags?trackId=alice-1']) expect((await request(path, null)).status).toBe(401);
    expect((await request('index', null, {})).status).toBe(401);
    expect(state.embed).not.toHaveBeenCalled();
  });
  it('reports an unindexed library without inventing semantic results', async () => {
    expect(await (await request('status')).json()).toMatchObject({ totalTracks: 2, indexedTracks: 0, pendingTracks: 2, ready: false });
    expect(await (await request('search?q=rain')).json()).toMatchObject({ tracks: [], pendingTracks: 2 });
    expect(state.embed).not.toHaveBeenCalled();
  });
  it('indexes only the authenticated library and reuses cached embeddings', async () => {
    expect(await (await request('index', 'alice', { limit: 1 })).json()).toMatchObject({ indexedThisBatch: 1, indexedTracks: 1, pendingTracks: 1 });
    expect(await (await request('index', 'alice', {})).json()).toMatchObject({ indexedTracks: 2, pendingTracks: 0 });
    expect(await (await request('index', 'alice', {})).json()).toMatchObject({ indexedThisBatch: 0 });
    expect(state.embed).toHaveBeenCalledTimes(2);
    expect(sqlite.prepare('SELECT track_id FROM track_embeddings ORDER BY track_id').all()).toEqual([{ track_id: 'alice-1' }, { track_id: 'alice-2' }]);
  });
  it('does not reveal another user through tags, search, recommendations or history', async () => {
    await request('index', 'alice', {}); await request('index', 'bob', {});
    state.db.insert(userTrackPlays).values({ userId: 'bob', trackId: 'bob-1', playDurationMs: 60_000 }).run();
    expect((await request('tags?trackId=bob-1')).status).toBe(404);
    const search = await (await request('search?q=music')).json();
    expect(search.tracks.map((x: any) => x.trackId)).toEqual(['alice-1', 'alice-2']);
    expect(JSON.stringify(search)).not.toContain('/private/');
    expect(JSON.stringify(search)).not.toContain('bob');
    expect(await (await request('recommendations')).json()).toMatchObject({ basis: 'cold-start' });
  });
  it('invalidates changed metadata and lyrics without serving old semantics', async () => {
    await request('index', 'alice', {});
    state.db.update(tracks).set({ title: 'Changed' }).where(eq(tracks.trackId, 'alice-1')).run();
    state.db.insert(lyrics).values({ trackId: 'alice-2', lyricsJson: [{ time: '00:00.000', text: 'Rain on the forest' }] }).run();
    expect(await (await request('status')).json()).toMatchObject({ indexedTracks: 0, pendingTracks: 2 });
    expect((await request('tags?trackId=alice-1')).status).toBe(409);
    await request('index', 'alice', {});
    expect(await (await request('status')).json()).toMatchObject({ indexedTracks: 2, pendingTracks: 0 });
  });
  it('does not persist results after ownership changes while inference runs', async () => {
    state.embed.mockImplementationOnce(async inputs => {
      state.db.update(albums).set({ userId: 'bob' }).where(eq(albums.albumId, 'alice-album')).run();
      return inputs.map(() => [...vector]);
    });
    expect(await (await request('index', 'alice', {})).json()).toMatchObject({ indexedThisBatch: 0, totalTracks: 0 });
    expect(sqlite.prepare('SELECT COUNT(*) n FROM track_embeddings').get()).toEqual({ n: 0 });
  });
  it('includes owned album genres and still invalidates a title used only by the retrieval prefix', async () => {
    state.db.insert(genres).values({ genreId: 'ambient', name: 'Ambient' }).run();
    state.db.insert(albumGenres).values({ albumId: 'alice-album', genreId: 'ambient' }).run();
    await request('index', 'alice', {});
    const inputs = state.embed.mock.calls[0]![0];
    expect(inputs[0].text).toContain('title: alice song 1 | text: Genre: Ambient');
    expect(inputs[1].text).not.toContain('alice song 1');
    state.db.update(tracks).set({ title: 'New name' }).where(eq(tracks.trackId, 'alice-1')).run();
    expect(await (await request('status')).json()).toMatchObject({ indexedTracks: 1, pendingTracks: 1 });
  });
  it('rechecks read ownership after awaiting query inference', async () => {
    await request('index', 'alice', {});
    state.embed.mockImplementationOnce(async () => {
      state.db.update(albums).set({ userId: 'bob' }).where(eq(albums.albumId, 'alice-album')).run();
      return [[...vector]];
    });
    expect(await (await request('search?q=music')).json()).toMatchObject({ tracks: [], totalTracks: 0 });
  });
  it('tags retain model, revision, taxonomy and input provenance', async () => {
    await request('index', 'alice', {});
    const result = await (await request('tags?trackId=alice-1')).json();
    expect(result.tags.length).toBeGreaterThan(0);
    expect(result.tags[0]).toMatchObject({ source: 'embeddinggemma-taxonomy', model: 'google/embeddinggemma-2', taxonomyVersion: 'music-text-v1', evidence: ['metadata'] });
    expect(result.scoreMeaning).toBe('cosine-similarity-not-probability');
  });
  it('uses only this user listening history and excludes played seed tracks', async () => {
    await request('index', 'alice', {});
    state.db.insert(userTrackPlays).values({ userId: 'alice', trackId: 'alice-1', playDurationMs: 60_000 }).run();
    expect(await (await request('recommendations')).json()).toMatchObject({ generatedAt: null, refreshState: 'queued', stale: true });
    const { processSingleJob } = await import('../../server/jobs/worker');
    await processSingleJob();
    const result = await (await request('recommendations')).json();
    expect(result.basis).toBe('history');
    expect(result.tracks.map((x: any) => x.trackId)).toEqual(['alice-2']);
    expect(result.tracks[0].seedTrackId).toBe('alice-1');
  });
  it('rejects malformed queries and bounds indexing and result limits', async () => {
    for (const path of ['search', 'search?q=', 'search?q=one&q=two', 'search?q=ok&limit=0', 'recommendations?limit=9999', 'tags']) expect((await request(path)).status).toBe(400);
    expect((await request('index', 'alice', { limit: 17 })).status).toBe(400);
    expect((await request('index', 'alice', [])).status).toBe(400);
    expect(state.embed).not.toHaveBeenCalled();
  });
  it('returns a useful model unavailable response and leaves the index untouched', async () => {
    const { IntelligenceError } = await import('../../server/services/intelligence/types');
    state.embed.mockRejectedValueOnce(new IntelligenceError('Install the local model.', 503));
    expect((await request('index', 'alice', {})).status).toBe(503);
    expect(sqlite.prepare('SELECT COUNT(*) n FROM track_embeddings').get()).toEqual({ n: 0 });
    expect((await request('index', 'alice', {})).status).toBe(200);
  });
  it('deletes derived embeddings with their track through the real foreign key', async () => {
    await request('index', 'alice', {});
    state.db.delete(tracks).where(eq(tracks.trackId, 'alice-1')).run();
    expect(sqlite.prepare('SELECT COUNT(*) n FROM track_embeddings').get()).toEqual({ n: 1 });
  });
});
