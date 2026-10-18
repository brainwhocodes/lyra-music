import { evalite } from 'evalite';
import { rankTracks, classifyTags, recommendTracks } from '../server/services/intelligence/math';
import type { IndexedTrack } from '../server/services/intelligence/types';
import { TAG_TAXONOMY } from '../server/services/intelligence/taxonomy';
import { CATALOG } from './catalog';
import { ndcgAt, recallAt, reciprocalRank, wordErrors } from './metrics';

const makeTrack = (index: number, vector: number[]): IndexedTrack => ({ ...CATALOG[index]!,
  retrievalVector: vector, similarityVector: vector, classificationVector: vector });
const records = [makeTrack(0, [1, 0]), makeTrack(1, [0.98, 0.02]), makeTrack(2, [0, 1]), makeTrack(3, [0.1, 0.9])];
const exact = ({ output, expected }: { output: unknown; expected?: unknown }) => Number(JSON.stringify(output) === JSON.stringify(expected));
const corrupt = process.env.LYRA_EVAL_NEGATIVE_CONTROL === '1';

evalite('Ranking policy / known geometry, not semantic quality', {
  data: [
    { input: { query: [1, 0], limit: 2 }, expected: ['quiet-piano', 'quiet-guitar'] },
    { input: { query: [0, 1], limit: 2 }, expected: ['dance-synth', 'dance-drums'] },
    { input: { query: [1, 0], limit: 0 }, expected: [] },
  ],
  task: ({ query, limit }) => {
    const ranked = rankTracks(query, records, limit).map(item => item.track.trackId);
    return corrupt ? ranked.reverse() : ranked;
  },
  scorers: [{ name: 'Exact ranking and limit', scorer: exact }],
});

evalite('Tag policy / threshold, abstention and maximum', {
  data: [
    { input: { query: [1, 0], threshold: 0.8, limit: 3 }, expected: ['calm'] },
    { input: { query: [-1, -1], threshold: 0.35, limit: 3 }, expected: [] },
    { input: { query: [1, 1], threshold: 0.35, limit: 1 }, expected: ['calm'] },
  ],
  task: ({ query, threshold, limit }) => classifyTags(query, [
    { tag: TAG_TAXONOMY.find(tag => tag.id === 'calm')!, vector: [1, 0] },
    { tag: TAG_TAXONOMY.find(tag => tag.id === 'energetic')!, vector: [0, 1] },
  ], threshold, limit).map(tag => tag.id),
  scorers: [{ name: 'Exact calibrated decision', scorer: exact }],
});

const now = Date.parse('2026-02-01T12:00:00.000Z');
evalite('Recommendation policy / behavior is required for personalization', {
  data: [
    { input: { trackId: 'quiet-piano', duration: 90_000, date: '2026-02-01T11:00:00.000Z' }, expected: { basis: 'history', first: 'quiet-guitar' } },
    { input: { trackId: 'dance-synth', duration: 90_000, date: '2026-02-01T11:00:00.000Z' }, expected: { basis: 'history', first: 'dance-drums' } },
    { input: { trackId: 'quiet-piano', duration: 1_000, date: '2026-02-01T11:00:00.000Z' }, expected: { basis: 'cold-start', first: 'dance-drums' } },
    { input: { trackId: 'quiet-piano', duration: 90_000, date: '2025-01-01T11:00:00.000Z' }, expected: { basis: 'cold-start', first: 'dance-drums' } },
    { input: { trackId: 'outside-user-library', duration: 90_000, date: '2026-02-01T11:00:00.000Z' }, expected: { basis: 'cold-start', first: 'dance-drums' } },
  ],
  task: input => {
    const result = recommendTracks(records, [{ trackId: input.trackId, playedAt: input.date, playDurationMs: input.duration }], { now, limit: 2 });
    return { basis: result.basis, first: result.tracks[0]?.track.trackId };
  },
  scorers: [{ name: 'Correct basis and first result', scorer: exact }],
});

evalite('Evaluation metric negative controls', {
  data: [
    { input: 'perfect', expected: [1, 1, 1, 0] },
    { input: 'wrong', expected: [0, 0, 0, 2] },
  ],
  task: input => {
    const ranked = input === 'perfect' ? ['a', 'b'] : ['x', 'y'];
    return [reciprocalRank(ranked, ['a']), recallAt(ranked, ['a'], 2), ndcgAt(ranked, { a: 2 }, 2),
      wordErrors('one two', input === 'perfect' ? 'ONE, two!' : 'three four').errors];
  },
  scorers: [{ name: 'Metrics detect irrelevant output', scorer: exact }],
});
