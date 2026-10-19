import { randomUUID } from 'node:crypto';
import { and, eq, isNull, lte, or, sql } from 'drizzle-orm';
import { db } from '../../db';
import { jobQueue, recommendationSnapshots, users, type RecommendationMetrics } from '../../db/schema';
import { limits } from '../../jobs/limits';
import type { RecommendationJobPayload } from '../../jobs/types';
import { embeddingConfig } from './embedding-service';
import { qualifiedRecommendationHistory, recommendTracks, RECOMMENDATION_WINDOW_DAYS } from './math';
import { readHistory, readLibrary, trackContentHash } from './repository';
import { IntelligenceError, type EmbeddingOptions, type LibraryTrack } from './types';

export const RECOMMENDATION_INTERVAL_MS = 24 * 60 * 60 * 1000;
const FAILURE_BACKOFF_MS = 60 * 60 * 1000;
const SIGNALS = ['qualified-recorded-plays', 'recency', 'repeat-frequency-capped-at-three', 'cached-embedding-similarity', 'album-diversity'];
const modelKey = (options: EmbeddingOptions) => {
  const config = embeddingConfig(options);
  return JSON.stringify(['daily-v1', config.model, config.revision, config.dimensions]);
};
const publicTrack = (track: LibraryTrack, score: number, reason: string, seedTrackId?: string) => ({
  trackId: track.trackId, title: track.title, albumId: track.albumId, albumTitle: track.albumTitle,
  artists: track.artists, coverPath: track.coverPath, duration: track.duration, genre: track.genre,
  score, reason, ...(seedTrackId ? { seedTrackId } : {}),
});
const emptyMetrics = (): RecommendationMetrics => ({ windowDays: RECOMMENDATION_WINDOW_DAYS, qualifiedPlays: 0, distinctTracks: 0, signals: SIGNALS });
const coldStart = (tracks: LibraryTrack[], limit: number) => [...tracks]
  .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.trackId.localeCompare(b.trackId)).slice(0, limit)
  .map(track => publicTrack(track, 0, 'Recently added to your library; play more tracks to personalize recommendations.'));

/** Worker and HTTP use the same model configuration; the worker never runs inference. */
export function recommendationWorkerOptions(): EmbeddingOptions {
  return {
    embeddingModel: process.env.NUXT_EMBEDDING_MODEL || undefined,
    embeddingRevision: process.env.NUXT_EMBEDDING_REVISION || undefined,
    embeddingDimensions: process.env.NUXT_EMBEDDING_DIMENSIONS || undefined,
    embeddingMaxTracks: process.env.NUXT_EMBEDDING_MAX_TRACKS || undefined,
  };
}

/** New embeddings can turn a cold start into semantic recommendations before tomorrow. */
export function invalidateRecommendationSnapshot(userId: string) {
  db.update(recommendationSnapshots).set({ nextRefreshAt: 0, retryAfter: null })
    .where(eq(recommendationSnapshots.userId, userId)).run();
}

/** BEGIN IMMEDIATE serializes independent web/worker processes before checking the pointer. */
export function queueRecommendationRefresh(userId: string, options: EmbeddingOptions = {}, now = Date.now()) {
  if (!userId) throw new IntelligenceError('Authentication required.', 401);
  const config = embeddingConfig(options);
  const key = modelKey(options);
  return db.transaction(() => {
    if (!db.select({ userId: users.userId }).from(users).where(eq(users.userId, userId)).get()) throw new IntelligenceError('Account not found.', 401);
    const snapshot = db.select().from(recommendationSnapshots).where(eq(recommendationSnapshots.userId, userId)).get();
    const previousJob = snapshot?.refreshJobId ? db.select().from(jobQueue).where(eq(jobQueue.jobId, snapshot.refreshJobId)).get() : undefined;
    if (previousJob && ['queued', 'running'].includes(previousJob.state)) return { state: previousJob.state as 'queued' | 'running', jobId: previousJob.jobId };
    if (snapshot?.generatedAt && snapshot.modelKey === key && (snapshot.nextRefreshAt ?? 0) > now) return { state: 'idle' as const };
    // A queued job can wait longer than the original backoff. Start terminal
    // failure backoff at failure time, otherwise a busy worker immediately
    // exhausts another retry budget as soon as a delayed job fails.
    const failedRetryAt = previousJob?.state === 'failed' ? Date.parse(previousJob.updatedAt) + FAILURE_BACKOFF_MS : 0;
    if (Math.max(snapshot?.retryAfter ?? 0, failedRetryAt) > now) return { state: previousJob?.state === 'failed' ? 'failed' as const : 'waiting' as const };
    const queued = db.select({ count: sql<number>`count(*)` }).from(jobQueue).where(eq(jobQueue.state, 'queued')).get()?.count ?? 0;
    if (queued >= limits.queueMaxLength) return { state: 'waiting' as const };
    const jobId = randomUUID();
    const payload: RecommendationJobPayload = { userId, embeddingModel: config.model, embeddingRevision: config.revision, embeddingDimensions: config.dimensions, embeddingMaxTracks: config.maxTracks };
    db.insert(jobQueue).values({ jobId, jobType: 'recommendations.refresh', payload: JSON.stringify(payload), runAfter: Math.floor(now / 1000), maxAttempts: 3 }).run();
    db.insert(recommendationSnapshots).values({ userId, refreshJobId: jobId, retryAfter: now + FAILURE_BACKOFF_MS })
      .onConflictDoUpdate({ target: recommendationSnapshots.userId, set: { refreshJobId: jobId, retryAfter: now + FAILURE_BACKOFF_MS } }).run();
    return { state: 'queued' as const, jobId };
  }, { behavior: 'immediate' });
}

/** Bounded work on startup and every minute; snapshots retain the exact 24h cadence. */
export function enqueueDueRecommendations(options: EmbeddingOptions = recommendationWorkerOptions(), now = Date.now()) {
  const due = db.select({ userId: users.userId }).from(users)
    .leftJoin(recommendationSnapshots, eq(users.userId, recommendationSnapshots.userId))
    .leftJoin(jobQueue, eq(jobQueue.jobId, recommendationSnapshots.refreshJobId))
    .where(and(or(isNull(recommendationSnapshots.nextRefreshAt), lte(recommendationSnapshots.nextRefreshAt, now),
      sql`${recommendationSnapshots.modelKey} != ${modelKey(options)}`),
    or(isNull(recommendationSnapshots.retryAfter), lte(recommendationSnapshots.retryAfter, now)),
    or(isNull(jobQueue.jobId), sql`${jobQueue.state} NOT IN ('queued', 'running')`),
    // Exclude backed-off failures before LIMIT so they cannot starve due users.
    or(isNull(jobQueue.jobId), sql`${jobQueue.state} != 'failed'`, lte(jobQueue.updatedAt, new Date(now - FAILURE_BACKOFF_MS).toISOString()))))
    .orderBy(sql`coalesce(${recommendationSnapshots.nextRefreshAt}, 0)`, users.userId).limit(100).all();
  let queued = 0;
  for (const user of due) if (queueRecommendationRefresh(user.userId, options, now).state === 'queued') queued++;
  return queued;
}

/** Compute and publish atomically; a failed job leaves the last successful snapshot untouched. */
export async function runRecommendationRefreshJob(jobId: string, payload: RecommendationJobPayload, isCancelled: () => Promise<boolean>, now = Date.now()) {
  if (await isCancelled()) return { cancelled: true };
  return db.transaction(() => {
    const snapshot = db.select().from(recommendationSnapshots).where(eq(recommendationSnapshots.userId, payload.userId)).get();
    const job = db.select().from(jobQueue).where(eq(jobQueue.jobId, jobId)).get();
    if (!snapshot || snapshot.refreshJobId !== jobId || job?.cancelRequested || job?.state !== 'running') return { skipped: true };
    // A reclaimed lease after publication must not move the snapshot's clock forward.
    if (snapshot.generatedAt && snapshot.modelKey === modelKey(payload) && (snapshot.nextRefreshAt ?? 0) > now) return { skipped: true };
    const library = readLibrary(payload.userId, embeddingConfig(payload));
    const history = readHistory(payload.userId, now);
    const result = recommendTracks(library.indexed, history, { limit: 50, now });
    const qualified = qualifiedRecommendationHistory(library.indexed, history, now);
    const owned = new Map([...library.indexed, ...library.pending].map(track => [track.trackId, track]));
    const items = result.basis === 'history' ? result.tracks.map(item => ({ trackId: item.track.trackId, contentHash: trackContentHash(item.track), score: item.score, seedTrackId: item.seedTrackId }))
      : coldStart([...library.indexed, ...library.pending], 50).map(item => {
        const track = owned.get(item.trackId)!;
        return { trackId: item.trackId, contentHash: trackContentHash(track), score: 0 };
      });
    const generatedAt = new Date(now).toISOString();
    db.update(recommendationSnapshots).set({
      items, basis: result.basis, modelKey: modelKey(payload), generatedAt,
      nextRefreshAt: now + RECOMMENDATION_INTERVAL_MS, retryAfter: null,
      metrics: { windowDays: RECOMMENDATION_WINDOW_DAYS, qualifiedPlays: qualified.length, distinctTracks: new Set(qualified.map(play => play.trackId)).size, signals: SIGNALS },
    }).where(and(eq(recommendationSnapshots.userId, payload.userId), eq(recommendationSnapshots.refreshJobId, jobId))).run();
    return { generatedAt, trackCount: items.length, basis: result.basis };
  }, { behavior: 'immediate' });
}

export function readDailyRecommendations(userId: string, limit = 20, options: EmbeddingOptions = {}, now = Date.now()) {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) throw new IntelligenceError('Limit must be an integer from 1 to 50.', 400);
  const library = readLibrary(userId, embeddingConfig(options));
  const refresh = queueRecommendationRefresh(userId, options, now);
  const snapshot = db.select().from(recommendationSnapshots).where(eq(recommendationSnapshots.userId, userId)).get();
  const usable = Boolean(snapshot?.generatedAt && snapshot.modelKey === modelKey(options));
  const owned = new Map([...library.indexed, ...library.pending].map(track => [track.trackId, track]));
  const recommended = usable ? snapshot!.items.flatMap(item => {
    const track = owned.get(item.trackId);
    if (!track || trackContentHash(track) !== item.contentHash) return [];
    const seed = item.seedTrackId ? owned.get(item.seedTrackId) : undefined;
    const reason = snapshot!.basis === 'cold-start' ? 'Recently added to your library; play more tracks to personalize recommendations.'
      : seed ? `Similar metadata and lyrics to “${seed.title}”, which you listened to.` : 'Based on your recent recorded plays and related track information.';
    return [publicTrack(track, item.score, reason, seed?.trackId)];
  }).slice(0, limit) : coldStart([...owned.values()], limit);
  return {
    basis: usable ? snapshot!.basis : 'cold-start' as const, tracks: recommended,
    totalTracks: library.totalTracks, indexedTracks: library.indexed.length, pendingTracks: library.pending.length,
    generatedAt: usable ? snapshot!.generatedAt : null,
    nextRefreshAt: usable && snapshot!.nextRefreshAt ? new Date(snapshot!.nextRefreshAt).toISOString() : null,
    refreshState: refresh.state, stale: !usable || (snapshot!.nextRefreshAt ?? 0) <= now,
    metrics: usable ? snapshot!.metrics ?? emptyMetrics() : emptyMetrics(),
  };
}
