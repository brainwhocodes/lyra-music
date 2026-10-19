import type { IndexedTrack, PlayHistory, RankedTrack, TagMatch, TaxonomyTag } from './types';
import { TAG_SIMILARITY_THRESHOLD } from './taxonomy';

export function normalizeVector(vector: readonly number[]): number[] {
  if (!vector.length || vector.some(value => !Number.isFinite(value))) throw new Error('Invalid embedding vector.');
  const norm = Math.hypot(...vector);
  if (norm <= 1e-12 || !Number.isFinite(norm)) throw new Error('Invalid embedding norm.');
  return vector.map(value => value / norm);
}

export function cosineSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error('Embedding dimensions do not match.');
  const left = normalizeVector(a);
  const right = normalizeVector(b);
  return Math.max(-1, Math.min(1, left.reduce((sum, value, i) => sum + value * right[i]!, 0)));
}

/** Inputs have already been normalized once for this ranking pass. */
function normalizedSimilarity(a: readonly number[], b: readonly number[]): number {
  if (a.length !== b.length) throw new Error('Embedding dimensions do not match.');
  let score = 0;
  for (let i = 0; i < a.length; i++) score += a[i]! * b[i]!;
  return Math.max(-1, Math.min(1, score));
}

const QUERY_STOP_WORDS = new Set('a an and are as at be by for from has have i in is it me more my of on or our some something that the their them there these this to was we were with you your help song songs music lyrics track tracks after before no not without'.split(' '));
function searchTokens(text: string): Set<string> {
  const words = text.normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}]+/gu) ?? [];
  return new Set(words.filter(word => word.length > 1 && !QUERY_STOP_WORDS.has(word)).map(word => {
    // Conservative English inflection matching; non-ASCII words retain exact normalized form.
    if (!/^[a-z]+$/.test(word)) return word;
    let stem = word;
    if (stem.length > 5 && stem.endsWith('ing')) stem = stem.slice(0, -3);
    else if (stem.length > 4 && stem.endsWith('ed')) stem = stem.slice(0, -2);
    else if (stem.length > 4 && stem.endsWith('es')) stem = stem.slice(0, -2);
    else if (stem.length > 3 && stem.endsWith('s') && !stem.endsWith('ss')) stem = stem.slice(0, -1);
    if (stem.length > 3 && stem.endsWith('e')) stem = stem.slice(0, -1);
    return stem;
  }));
}

/** A small explicit-text signal complements embeddings; names/titles never get this boost. */
export function lexicalCoverage(query: string, track: Pick<IndexedTrack, 'genre' | 'lyrics'>): number | null {
  // Lexical overlap cannot interpret negation; let the embedding handle such requests.
  if (/\b(?:no|not|without|avoid|excluding|exclude)\b/i.test(query)) return null;
  const terms = searchTokens(query);
  if (!terms.size) return null;
  const document = searchTokens(`${track.genre ?? ''} ${track.lyrics.slice(0, 3000)}`);
  return [...terms].filter(term => document.has(term)).length / terms.size;
}

export function rankTracks(queryVector: number[], records: IndexedTrack[], limit = 20, query = ''): RankedTrack[] {
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return [];
  return records.map(track => {
    const semantic = cosineSimilarity(queryVector, track.retrievalVector);
    const lexical = lexicalCoverage(query, track);
    return { track, score: lexical === null ? semantic : 0.85 * semantic + 0.15 * lexical,
      reason: 'Related track information and available lyrics.' };
  })
    .sort((a, b) => b.score - a.score || a.track.trackId.localeCompare(b.track.trackId)).slice(0, limit);
}

export function classifyTags(trackVector: number[], taxonomyVectors: { tag: TaxonomyTag; vector: number[] }[], threshold = TAG_SIMILARITY_THRESHOLD, maxTags = 3): TagMatch[] {
  if (!Number.isInteger(maxTags) || maxTags < 1 || !Number.isFinite(threshold)) return [];
  const scored = taxonomyVectors.map(({ tag, vector }) => ({ ...tag, score: cosineSimilarity(trackVector, vector) }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
  // Abstain when there is no useful match; a cosine score is not a probability.
  const qualified = scored.filter(tag => tag.score >= threshold && tag.score >= (scored[0]?.score ?? 0) - 0.08);
  const result: TagMatch[] = [];
  const categories = new Set<TaxonomyTag['category']>();
  for (const tag of qualified) {
    if (categories.has(tag.category)) continue;
    categories.add(tag.category); result.push(tag);
    if (result.length === maxTags) return result;
  }
  for (const tag of qualified) {
    if (!result.includes(tag)) result.push(tag);
    if (result.length === maxTags) break;
  }
  return result;
}

export const RECOMMENDATION_WINDOW_DAYS = 30;

/** Only recorded, meaningful plays qualify. A scrobble is not proof of completion. */
export function qualifiedRecommendationHistory(records: Pick<IndexedTrack, 'trackId' | 'duration'>[], history: PlayHistory[], now = Date.now()) {
  const byId = new Map(records.map(track => [track.trackId, track]));
  return history.filter(play => {
    const track = byId.get(play.trackId);
    const playedAt = Date.parse(play.playedAt);
    if (!track || !Number.isFinite(playedAt) || playedAt > now || now - playedAt > RECOMMENDATION_WINDOW_DAYS * 86_400_000) return false;
    const threshold = track.duration && track.duration > 0 ? Math.min(30_000, track.duration * 500) : 30_000;
    return play.playDurationMs !== null && Number.isFinite(play.playDurationMs) && play.playDurationMs >= threshold;
  });
}

export function recommendTracks(records: IndexedTrack[], history: PlayHistory[], options: { limit?: number; now?: number } = {}): { basis: 'history' | 'cold-start'; tracks: RankedTrack[] } {
  const limit = options.limit ?? 20;
  if (!Number.isInteger(limit) || limit < 1 || limit > 50) return { basis: 'cold-start', tracks: [] };
  const now = options.now ?? Date.now();
  const byId = new Map(records.map(track => [track.trackId, track]));
  const weights = new Map<string, number>();
  const qualified = qualifiedRecommendationHistory(records, history, now);
  for (const play of qualified) {
    const ageDays = (now - Date.parse(play.playedAt)) / 86_400_000;
    const weight = Math.exp(-ageDays / 14);
    weights.set(play.trackId, Math.min(3, (weights.get(play.trackId) ?? 0) + weight));
  }
  const seeds = [...weights].sort((a, b) => b[1] - a[1]).slice(0, 25);
  if (!seeds.length) {
    return { basis: 'cold-start', tracks: [...records].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.trackId.localeCompare(b.trackId)).slice(0, limit)
      .map(track => ({ track, score: 0, reason: 'Recently added to your library; play more tracks to personalize recommendations.' })) };
  }
  const profile = Array<number>(records[0]!.similarityVector.length).fill(0);
  for (const [id, weight] of seeds) byId.get(id)!.similarityVector.forEach((value, i) => { profile[i]! += value * weight; });
  // Opposing preferences may cancel out. Use the strongest real seed rather than a zero vector.
  if (Math.hypot(...profile) <= 1e-12) profile.splice(0, profile.length, ...byId.get(seeds[0]![0])!.similarityVector);
  const normalizedProfile = normalizeVector(profile);
  const normalizedSeeds = seeds.map(([id]) => ({ track: byId.get(id)!, vector: normalizeVector(byId.get(id)!.similarityVector) }));
  const listened = new Set(qualified.filter(play => now - Date.parse(play.playedAt) < 7 * 86_400_000).map(play => play.trackId));
  const candidates = records.filter(track => !listened.has(track.trackId) && !weights.has(track.trackId));
  const scored = candidates.map(track => {
    const vector = normalizeVector(track.similarityVector);
    let nearest = normalizedSeeds[0]!;
    let nearestScore = -Infinity;
    for (const seed of normalizedSeeds) {
      const similarity = normalizedSimilarity(vector, seed.vector);
      if (similarity > nearestScore) { nearest = seed; nearestScore = similarity; }
    }
    return { track, score: normalizedSimilarity(normalizedProfile, vector), seedTrackId: nearest.track.trackId,
      reason: `Similar metadata and lyrics to “${nearest.track.title}”, which you listened to.` };
  }).sort((a, b) => b.score - a.score || a.track.trackId.localeCompare(b.track.trackId));
  // First pass caps each album at two tracks, then fills any remaining slots.
  const result: RankedTrack[] = [];
  const albumCounts = new Map<string, number>();
  for (const item of scored) {
    if ((albumCounts.get(item.track.albumId) ?? 0) >= 2) continue;
    result.push(item);
    albumCounts.set(item.track.albumId, (albumCounts.get(item.track.albumId) ?? 0) + 1);
    if (result.length === limit) break;
  }
  if (result.length < limit) for (const item of scored) {
    if (!result.includes(item)) result.push(item);
    if (result.length === limit) break;
  }
  return { basis: 'history', tracks: result };
}
