import { describe, expect, it } from 'vitest';
import { classifyTags, cosineSimilarity, lexicalCoverage, normalizeVector, rankTracks, recommendTracks } from '../../server/services/intelligence/math';
import { TAG_TAXONOMY } from '../../server/services/intelligence/taxonomy';
import { parseEmbeddingOutput, prepareEmbeddingText, embeddingConfig } from '../../server/services/intelligence/embedding-service';
import type { IndexedTrack } from '../../server/services/intelligence/types';

const track = (id: string, vector: number[], albumId = id): IndexedTrack => ({
  trackId: id, title: id, albumId, albumTitle: albumId, artists: [], genre: null, year: null, duration: 120,
  coverPath: null, lyrics: '', createdAt: '2026-10-01', retrievalVector: vector, classificationVector: vector, similarityVector: vector,
});
const now = Date.parse('2026-10-18T00:00:00Z');
const play = (trackId: string, extra = {}) => ({ trackId, playedAt: '2026-10-17T00:00:00Z', playDurationMs: 60_000, ...extra });

describe('semantic ranking mathematics (synthetic vectors, not model quality)', () => {
  it('normalizes inputs and rejects invalid vectors instead of silently ranking NaN', () => {
    expect(normalizeVector([3, 4])).toEqual([0.6, 0.8]);
    expect(cosineSimilarity([1, 0], [2, 0])).toBe(1);
    expect(() => cosineSimilarity([1], [1, 0])).toThrow();
    for (const value of [[], [0, 0], [NaN], [Infinity]]) expect(() => normalizeVector(value)).toThrow();
  });
  it('ranks nearest vectors with stable ties and bounds results', () => {
    expect(rankTracks([1, 0], [track('far', [0, 1]), track('b', [1, 0]), track('a', [1, 0])], 2).map(x => x.track.trackId)).toEqual(['a', 'b']);
    expect(rankTracks([1, 0], [track('a', [1, 0])], 0)).toEqual([]);
  });
  it('abstains from weak taxonomy matches and returns scores rather than probabilities', () => {
    const labels = [{ tag: TAG_TAXONOMY[0]!, vector: [1, 0] }, { tag: TAG_TAXONOMY[1]!, vector: [0, 1] }];
    expect(classifyTags([1, 0], labels, 0.7)).toMatchObject([{ id: 'calm', score: 1 }]);
    expect(classifyTags([-1, -1], labels, 0.7)).toEqual([]);
  });
  it('uses explicit text evidence without boosting misleading titles or negated requests', () => {
    const misleading = { ...track('Forest Rain', [1, 0]), genre: 'Rock', lyrics: 'An arena guitar solo.' };
    const explicit = { ...track('Unrelated name', [1, 0]), genre: 'Ambient', lyrics: 'Forests and rain.' };
    expect(lexicalCoverage('forest rain', misleading)).toBe(0);
    expect(lexicalCoverage('forest rain', explicit)).toBe(1);
    expect(rankTracks([1, 0], [misleading, explicit], 2, 'forest rain')[0]?.track.trackId).toBe('Unrelated name');
    expect(lexicalCoverage('not jazz', { genre: 'Jazz', lyrics: '' })).toBeNull();
    expect(lexicalCoverage('music', explicit)).toBeNull();
  });
  it('gives distinct tag categories a chance without lowering score thresholds', () => {
    const tag = (id: string) => TAG_TAXONOMY.find(item => item.id === id)!;
    const labels = [
      { tag: tag('instrumental'), vector: [1, 0] }, { tag: tag('electronic'), vector: [0.999, 0.001] },
      { tag: tag('calm'), vector: [0.998, 0.002] }, { tag: tag('nature'), vector: [0.997, 0.003] },
    ];
    expect(classifyTags([1, 0], labels).map(item => item.id)).toEqual(['instrumental', 'calm', 'nature']);
    expect(classifyTags([-1, 0], labels)).toEqual([]);
  });
  it('personalizes with history, excludes heard tracks, and explains an actual seed', () => {
    const result = recommendTracks([track('seed', [1, 0]), track('similar', [0.99, 0.01]), track('other', [0, 1])], [play('seed')], { now, limit: 2 });
    expect(result.basis).toBe('history');
    expect(result.tracks.map(item => item.track.trackId)).toEqual(['similar', 'other']);
    expect(result.tracks[0]?.seedTrackId).toBe('seed');
    expect(result.tracks[0]?.reason).toContain('seed');
  });
  it('ignores foreign history, short skips, invalid dates and ancient history', () => {
    const records = [track('a', [1, 0]), track('b', [0, 1])];
    const result = recommendTracks(records, [play('secret'), play('a', { playDurationMs: 1000 }), play('b', { playedAt: 'bad' }), play('a', { playedAt: '2020-01-01' })], { now });
    expect(result.basis).toBe('cold-start');
    expect(result.tracks[0]?.reason).toContain('play more');
    expect(result.tracks.every(item => item.score === 0)).toBe(true);
  });
  it('handles empty libraries, zero limits, and an exactly cancelled preference profile', () => {
    expect(recommendTracks([], [], { now }).tracks).toEqual([]);
    expect(recommendTracks([track('a', [1, 0])], [], { limit: 0 }).tracks).toEqual([]);
    expect(recommendTracks([track('a', [1, 0]), track('b', [-1, 0]), track('c', [0.9, 0.1])], [play('a'), play('b')], { now }).tracks[0]?.track.trackId).toBe('c');
  });
  it('gives other albums an opportunity in a limited recommendation list', () => {
    const records = [track('seed', [1, 0]), track('a', [1, 0], 'same'), track('b', [0.99, 0.01], 'same'), track('c', [0.98, 0.02], 'same'), track('d', [0.8, 0.2], 'different')];
    expect(recommendTracks(records, [play('seed')], { now, limit: 3 }).tracks.map(x => x.track.trackId)).toEqual(['a', 'b', 'd']);
  });
  it('counts meaningful listens to short tracks instead of treating every short recording as a skip', () => {
    const records = [{ ...track('short', [1, 0]), duration: 12 }, track('similar', [1, 0])];
    expect(recommendTracks(records, [play('short', { playDurationMs: 11_000 })], { now }).basis).toBe('history');
    expect(recommendTracks(records, [play('short', { playDurationMs: NaN })], { now }).basis).toBe('cold-start');
  });
});

describe('embedding model boundary', () => {
  it('uses the documented asymmetric and custom taxonomy prompts', () => {
    expect(prepareEmbeddingText({ text: 'rain', task: 'query' })).toBe('task: search result | query: rain');
    expect(prepareEmbeddingText({ text: 'title: Rain | text: weather', task: 'document' })).toBe('title: Rain | text: weather');
    expect(prepareEmbeddingText({ text: 'calm music', task: 'classification' })).toBe('task: clustering | query: calm music');
    expect(prepareEmbeddingText({ text: 'rain', task: 'similarity' })).toBe('task: sentence similarity | query: rain');
  });
  it('rejects malformed, non-unit, wrong-sized and non-finite model output', () => {
    for (const output of ['bad', '{}', '{"vectors":[]}', '{"vectors":[[0,0]]}', '{"vectors":[[3,4]]}', '{"vectors":[[null,1]]}', '{"vectors":[[1]]}']) {
      expect(() => parseEmbeddingOutput(output, 1, 2)).toThrow();
    }
    expect(parseEmbeddingOutput('{"vectors":[[0.6,0.8]]}', 1, 2)).toEqual([[0.6, 0.8]]);
  });
  it('validates configurable dimensions and resource bounds', () => {
    expect(embeddingConfig().dimensions).toBe(256);
    expect(() => embeddingConfig({ embeddingDimensions: 255 })).toThrow();
    expect(() => embeddingConfig({ embeddingTimeoutMs: 0.1 })).toThrow();
    expect(() => embeddingConfig({ embeddingTimeoutMs: 0 })).toThrow();
    expect(() => embeddingConfig({ embeddingDimensions: 0 })).toThrow();
    expect(() => embeddingConfig({ embeddingMaxTracks: 0 })).toThrow();
    expect(() => embeddingConfig({ embeddingMaxTracks: 30_000 })).toThrow();
    expect(() => prepareEmbeddingText({ text: '', task: 'query' })).toThrow();
    expect(() => prepareEmbeddingText({ text: 'a'.repeat(16_001), task: 'query' })).toThrow();
  });
});
