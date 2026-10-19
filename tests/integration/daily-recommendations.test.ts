import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { eq } from 'drizzle-orm';
import { albums, jobQueue, recommendationSnapshots, tracks, trackEmbeddings, users, userTrackPlays } from '../../server/db/schema';
import { migrateTestDatabase } from '../helpers/database';

const state = vi.hoisted(() => ({ db: undefined as any }));
vi.mock('../../server/db', () => ({ db: state.db }));
let sqlite: Database.Database;
let service: typeof import('../../server/services/intelligence/recommendations');
let queue: typeof import('../../server/jobs/queue');
const now = Date.parse('2026-10-18T12:00:00.000Z');
const day = 86_400_000;

async function runQueued(at = now) {
  const leased = await queue.leaseNextJob('recommendation-test-worker', ['recommendations.refresh']);
  if (!leased) throw new Error('Expected queued refresh');
  const result = await service.runRecommendationRefreshJob(leased.jobId, leased.payload as any, async () => false, at);
  await queue.markJobSucceeded(leased.jobId, result);
  return leased;
}

beforeAll(async () => {
  sqlite = new Database(':memory:'); sqlite.pragma('foreign_keys = ON'); migrateTestDatabase(sqlite);
  state.db = drizzle(sqlite);
  service = await import('../../server/services/intelligence/recommendations');
  queue = await import('../../server/jobs/queue');
});
beforeEach(async () => {
  vi.useFakeTimers(); vi.setSystemTime(now);
  sqlite.exec('DELETE FROM recommendation_snapshots; DELETE FROM job_queue; DELETE FROM user_track_plays; DELETE FROM track_embeddings; DELETE FROM tracks; DELETE FROM albums; DELETE FROM users;');
  for (const userId of ['alice', 'bob']) {
    state.db.insert(users).values({ userId, name: userId, email: `${userId}@test.invalid`, passwordHash: 'unused' }).run();
    for (const n of [1, 2, 3]) {
      state.db.insert(albums).values({ albumId: `${userId}-album-${n}`, userId, title: `${userId} album ${n}` }).run();
      state.db.insert(tracks).values({ trackId: `${userId}-${n}`, albumId: `${userId}-album-${n}`, title: `${userId} ${n}`, filePath: `/private/${userId}/${n}.mp3`, duration: 120, createdAt: new Date(now - n * day).toISOString() }).run();
    }
  }
  const { readLibrary, trackContentHash } = await import('../../server/services/intelligence/repository');
  const { embeddingConfig } = await import('../../server/services/intelligence/embedding-service');
  const config = embeddingConfig();
  for (const userId of ['alice', 'bob']) for (const track of readLibrary(userId, config).pending) {
    const vector = Array<number>(256).fill(0); vector[0] = 1;
    state.db.insert(trackEmbeddings).values({ trackId: track.trackId, contentHash: trackContentHash(track), model: config.model, revision: config.revision,
      dimensions: 256, retrievalVector: vector, classificationVector: vector, similarityVector: vector, indexedAt: new Date(now).toISOString() }).run();
  }
});
afterAll(() => { vi.useRealTimers(); sqlite.close(); });

describe('durable daily recommendations and job lifecycle', () => {
  it('returns a cold start before the job and persists qualified personal recommendations for exactly 24 hours', async () => {
    state.db.insert(userTrackPlays).values({ userId: 'alice', trackId: 'alice-1', playedAt: new Date(now - 1000).toISOString(), playDurationMs: 30_000 }).run();
    const first = service.readDailyRecommendations('alice', 2, {}, now);
    expect(first).toMatchObject({ basis: 'cold-start', generatedAt: null, refreshState: 'queued', stale: true });
    expect(first.tracks.map(track => track.trackId)).toEqual(['alice-1', 'alice-2']);
    await runQueued();
    const generated = service.readDailyRecommendations('alice', 2, {}, now);
    expect(generated).toMatchObject({ basis: 'history', generatedAt: new Date(now).toISOString(), nextRefreshAt: new Date(now + day).toISOString(), refreshState: 'idle', stale: false, metrics: { qualifiedPlays: 1, distinctTracks: 1, windowDays: 30 } });
    expect(generated.tracks.map(track => track.trackId)).toEqual(['alice-2', 'alice-3']);
    expect(service.readDailyRecommendations('alice', 2, {}, now + day - 1).refreshState).toBe('idle');
    expect(service.readDailyRecommendations('alice', 2, {}, now + day).refreshState).toBe('queued');
  });

  it('deduplicates requests and scheduler checks while a refresh is queued or running', async () => {
    const results = await Promise.all(Array.from({ length: 20 }, () => Promise.resolve().then(() => service.queueRecommendationRefresh('alice', {}, now))));
    expect(new Set(results.map(result => 'jobId' in result ? result.jobId : null)).size).toBe(1);
    await queue.leaseNextJob('lease-owner', ['recommendations.refresh']);
    expect(service.queueRecommendationRefresh('alice', {}, now)).toMatchObject({ state: 'running' });
    service.enqueueDueRecommendations({}, now);
    expect(sqlite.prepare("SELECT count(*) n FROM job_queue WHERE json_extract(payload, '$.userId') = 'alice'").get()).toEqual({ n: 1 });
  });

  it('does not advance the clock when a published job is redelivered after a lease loss', async () => {
    service.queueRecommendationRefresh('alice', {}, now);
    const leased = await queue.leaseNextJob('first-worker', ['recommendations.refresh']);
    await service.runRecommendationRefreshJob(leased!.jobId, leased!.payload as any, async () => false, now);
    expect(await service.runRecommendationRefreshJob(leased!.jobId, leased!.payload as any, async () => false, now + 60_000)).toMatchObject({ skipped: true });
    expect(state.db.select().from(recommendationSnapshots).get().generatedAt).toBe(new Date(now).toISOString());
  });

  it('retains the old successful snapshot on failure and backs off after exhausted retries', async () => {
    service.queueRecommendationRefresh('alice', {}, now); await runQueued();
    const before = service.readDailyRecommendations('alice', 20, {}, now);
    vi.setSystemTime(now + day);
    service.queueRecommendationRefresh('alice', {}, now + day);
    const leased = await queue.leaseNextJob('failing-worker', ['recommendations.refresh']);
    await expect(service.runRecommendationRefreshJob(leased!.jobId, { ...(leased!.payload as any), embeddingDimensions: 7 }, async () => false, now + day)).rejects.toThrow();
    await queue.markJobFailed(leased!.jobId, new Error('local configuration failure'), 3, 3);
    const failed = service.readDailyRecommendations('alice', 20, {}, now + day + 1);
    expect(failed).toMatchObject({ generatedAt: before.generatedAt, nextRefreshAt: before.nextRefreshAt, stale: true, refreshState: 'failed' });
    expect(failed.tracks).toEqual(before.tracks);
    expect(JSON.stringify(failed)).not.toContain('local configuration failure');
    expect(service.queueRecommendationRefresh('alice', {}, now + day + 60 * 60 * 1000).state).toBe('queued');
  });

  it('filters transferred/deleted/changed candidates and reconstructs seed explanations from current owned data', async () => {
    state.db.insert(userTrackPlays).values({ userId: 'alice', trackId: 'alice-1', playDurationMs: 30_000 }).run();
    service.queueRecommendationRefresh('alice', {}, now); await runQueued();
    state.db.update(albums).set({ userId: 'bob' }).where(eq(albums.albumId, 'alice-album-1')).run();
    state.db.delete(tracks).where(eq(tracks.trackId, 'alice-2')).run();
    const result = service.readDailyRecommendations('alice', 20, {}, now);
    expect(result.tracks.map(track => track.trackId)).toEqual(['alice-3']);
    expect(result.tracks[0]).not.toHaveProperty('seedTrackId');
    expect(result.tracks[0]!.reason).not.toContain('alice 1');
    state.db.update(tracks).set({ title: 'changed metadata' }).where(eq(tracks.trackId, 'alice-3')).run();
    expect(service.readDailyRecommendations('alice', 20, {}, now).tracks).toEqual([]);
    expect(JSON.stringify(result)).not.toContain('/private/');
  });

  it('backs off from terminal failure time after a long queue delay, without blocking other accounts', async () => {
    service.queueRecommendationRefresh('alice', {}, now);
    const leased = await queue.leaseNextJob('delayed-worker', ['recommendations.refresh']);
    const failedAt = now + 2 * 60 * 60 * 1000;
    vi.setSystemTime(failedAt);
    await queue.markJobFailed(leased!.jobId, new Error('delayed failure'), 3, 3);

    // The scheduler must enforce backoff even before Alice next visits the UI.
    expect(service.enqueueDueRecommendations({}, failedAt)).toBe(1);
    expect(state.db.select().from(jobQueue).all()).toHaveLength(2);
    expect(service.readDailyRecommendations('alice', 20, {}, failedAt).refreshState).toBe('failed');
    expect(service.queueRecommendationRefresh('alice', {}, failedAt + 60 * 60 * 1000 - 1).state).toBe('failed');
    expect(service.queueRecommendationRefresh('alice', {}, failedAt + 60 * 60 * 1000).state).toBe('queued');
  });

  it('does not let more than 100 old active jobs starve an account without a snapshot', () => {
    for (let i = 0; i < 101; i++) {
      const userId = `backlog-${String(i).padStart(3, '0')}`;
      state.db.insert(users).values({ userId, name: userId, email: `${userId}@test.invalid`, passwordHash: 'unused' }).run();
      service.queueRecommendationRefresh(userId, {}, now);
    }
    service.queueRecommendationRefresh('alice', {}, now);
    state.db.update(jobQueue).set({ state: 'running' }).where(eq(jobQueue.jobId, state.db.select().from(recommendationSnapshots).where(eq(recommendationSnapshots.userId, 'alice')).get().refreshJobId)).run();
    const later = now + 2 * 60 * 60 * 1000;
    vi.setSystemTime(later);
    expect(service.enqueueDueRecommendations({}, later)).toBe(1);
    expect(state.db.select().from(recommendationSnapshots).where(eq(recommendationSnapshots.userId, 'bob')).get()).toMatchObject({ userId: 'bob' });
    expect(state.db.select().from(jobQueue).all()).toHaveLength(103);
    expect(service.enqueueDueRecommendations({}, later)).toBe(0);
  });

  it('uses the documented runtime model variables for scheduled jobs, ignoring obsolete build-only defaults', () => {
    try {
      vi.stubEnv('EMBEDDING_MODEL', 'obsolete-build-model');
      vi.stubEnv('NUXT_EMBEDDING_MODEL', 'test/runtime-model');
      vi.stubEnv('NUXT_EMBEDDING_REVISION', 'runtime-revision');
      vi.stubEnv('NUXT_EMBEDDING_DIMENSIONS', '128');
      vi.stubEnv('NUXT_EMBEDDING_MAX_TRACKS', '500');
      service.enqueueDueRecommendations(undefined, now);
      for (const job of state.db.select().from(jobQueue).all()) expect(JSON.parse(job.payload)).toMatchObject({
        embeddingModel: 'test/runtime-model', embeddingRevision: 'runtime-revision', embeddingDimensions: 128, embeddingMaxTracks: 500,
      });
    } finally { vi.unstubAllEnvs(); }
  });

  it('ignores another user history, malformed/old/future plays and supports an entirely unindexed library', async () => {
    for (const values of [
      { userId: 'bob', trackId: 'alice-1', playedAt: new Date(now).toISOString(), playDurationMs: 60_000 },
      { userId: 'alice', trackId: 'alice-1', playedAt: new Date(now - 31 * day).toISOString(), playDurationMs: 60_000 },
      { userId: 'alice', trackId: 'alice-1', playedAt: new Date(now + 1000).toISOString(), playDurationMs: 60_000 },
      { userId: 'alice', trackId: 'alice-1', playedAt: new Date(now).toISOString(), playDurationMs: 1000 },
    ]) state.db.insert(userTrackPlays).values(values).run();
    state.db.delete(trackEmbeddings).run();
    service.queueRecommendationRefresh('alice', {}, now); await runQueued();
    expect(service.readDailyRecommendations('alice', 20, {}, now)).toMatchObject({ basis: 'cold-start', indexedTracks: 0, metrics: { qualifiedPlays: 0 }, tracks: [{ trackId: 'alice-1' }, { trackId: 'alice-2' }, { trackId: 'alice-3' }] });
  });

  it('does not publish cancelled or superseded jobs, and queues a new model configuration', async () => {
    service.queueRecommendationRefresh('alice', {}, now);
    const leased = await queue.leaseNextJob('worker', ['recommendations.refresh']);
    expect(await service.runRecommendationRefreshJob(leased!.jobId, leased!.payload as any, async () => true, now)).toEqual({ cancelled: true });
    expect(await service.runRecommendationRefreshJob('unrelated-job', leased!.payload as any, async () => false, now)).toEqual({ skipped: true });
    await service.runRecommendationRefreshJob(leased!.jobId, leased!.payload as any, async () => false, now);
    await queue.markJobSucceeded(leased!.jobId, {});
    const changed = service.readDailyRecommendations('alice', 20, { embeddingDimensions: 128 }, now + 1000);
    expect(changed).toMatchObject({ generatedAt: null, stale: true, refreshState: 'queued', basis: 'cold-start' });
  });

  it('schedules accounts after downtime without requiring an HTTP visit and respects fresh snapshots', async () => {
    expect(service.enqueueDueRecommendations({}, now)).toBe(2);
    await runQueued(); await runQueued();
    expect(service.enqueueDueRecommendations({}, now + day - 1)).toBe(0);
    vi.setSystemTime(now + 2 * day);
    expect(service.enqueueDueRecommendations({}, now + 2 * day)).toBe(2);
    expect(() => service.queueRecommendationRefresh('', {}, now)).toThrow('Authentication');
    expect(() => service.queueRecommendationRefresh('missing-account', {}, now)).toThrow('Account not found');
  });

  it('lets newly saved embeddings invalidate a fresh cold start without erasing its successful timestamp', async () => {
    service.queueRecommendationRefresh('alice', {}, now); await runQueued();
    service.invalidateRecommendationSnapshot('alice');
    const result = service.readDailyRecommendations('alice', 20, {}, now + 1000);
    expect(result).toMatchObject({ generatedAt: new Date(now).toISOString(), stale: true, refreshState: 'queued' });
  });
});
