import { evalite } from 'evalite';
import { afterAll } from 'vitest';
import { embedTexts, closeEmbeddingWorker } from '../server/services/intelligence/embedding-service';
import { trackContent } from '../server/services/intelligence/repository';
import { rankTracks, classifyTags, recommendTracks } from '../server/services/intelligence/math';
import { TAG_TAXONOMY, TAG_SIMILARITY_THRESHOLD } from '../server/services/intelligence/taxonomy';
import type { EmbeddingInput, IndexedTrack } from '../server/services/intelligence/types';
import { CATALOG, SEARCH_CASES, TAG_CASES, RECOMMENDATION_CASES } from './catalog';
import { HOLDOUT_SEARCH_CASES } from './holdout';
import { ndcgAt, recallAt, reciprocalRank } from './metrics';

const evaluate = process.env.LYRA_MODEL_EVALS === '1' ? evalite : evalite.skip;
const corrupt = process.env.LYRA_EVAL_NEGATIVE_CONTROL === '1';

async function initialize() {
  const inputs: EmbeddingInput[] = CATALOG.flatMap(track => [
    { text: `title: ${track.title.slice(0, 200)} | text: ${trackContent(track)}`, task: 'document' as const },
    { text: trackContent(track), task: 'classification' as const },
    { text: trackContent(track), task: 'similarity' as const },
  ]);
  inputs.push(...TAG_TAXONOMY.map(tag => ({ text: tag.description, task: 'classification' as const })));
  inputs.push(...[...SEARCH_CASES, ...HOLDOUT_SEARCH_CASES].map(example => ({ text: example.query, task: 'query' as const })));
  const vectors = await embedTexts(inputs, { embeddingPython: process.env.NUXT_EMBEDDING_PYTHON,
    ...(process.env.EVAL_EMBEDDING_DIMENSIONS ? { embeddingDimensions: process.env.EVAL_EMBEDDING_DIMENSIONS } : {}),
  });
  const records: IndexedTrack[] = CATALOG.map((track, index) => ({ ...track,
    retrievalVector: vectors[index * 3]!, classificationVector: vectors[index * 3 + 1]!, similarityVector: vectors[index * 3 + 2]!,
  }));
  const taxonomy = TAG_TAXONOMY.map((tag, index) => ({ tag, vector: vectors[CATALOG.length * 3 + index]! }));
  const queries = vectors.slice(CATALOG.length * 3 + TAG_TAXONOMY.length);
  return { records, taxonomy, queries };
}
let pending: ReturnType<typeof initialize> | undefined;
function context() { return pending ??= initialize(); }
afterAll(closeEmbeddingWorker);

evaluate('Real EmbeddingGemma2 / semantic retrieval', {
  data: SEARCH_CASES.map((example, index) => ({ input: { query: example.query, index }, expected: example.relevance })),
  task: async ({ index }) => {
    const { records, queries } = await context();
    const ranked = rankTracks(queries[index]!, records, 12, SEARCH_CASES[index]!.query);
    return (corrupt ? ranked.reverse() : ranked).map(item => ({ id: item.track.trackId, score: item.score }));
  },
  scorers: [{ name: 'Retrieval floor: MRR >= .5, Recall@3 >= .5, nDCG@3 >= .7', scorer: ({ output, expected }) => {
    const ranked = output.map(item => item.id), relevant = Object.keys(expected!);
    const metrics = { mrr: reciprocalRank(ranked, relevant), recallAt3: recallAt(ranked, relevant, 3), ndcgAt3: ndcgAt(ranked, expected!, 3) };
    return { score: Number(metrics.mrr >= .5 && metrics.recallAt3 >= .5 && metrics.ndcgAt3 >= .7), metadata: metrics };
  } }],
});

evaluate('Real EmbeddingGemma2 / descriptive tags', {
  data: TAG_CASES.map(example => ({ input: example.trackId, expected: { required: example.required, forbidden: example.forbidden } })),
  task: async trackId => {
    const { records, taxonomy } = await context();
    const track = records.find(record => record.trackId === trackId)!;
    return classifyTags(track.classificationVector, taxonomy, TAG_SIMILARITY_THRESHOLD).map(tag => ({ id: tag.id, cosine: tag.score }));
  },
  scorers: [{ name: 'At least one relevant tag, no contradictory tag, bounded output', scorer: ({ output, expected }) => {
    const ids = output.map(item => item.id);
    return { score: Number(ids.length <= 3 && expected!.required.some(id => ids.includes(id)) && !expected!.forbidden.some(id => ids.includes(id))),
      metadata: { ids, allowedInterpretation: 'Text metadata/description affinity; not a measurement of the audio.' } };
  } }],
});

evaluate('Real EmbeddingGemma2 / additional query holdout', {
  data: HOLDOUT_SEARCH_CASES.map((example, index) => ({ input: { query: example.query, index }, expected: example.relevance })),
  task: async ({ index }) => {
    const { records, queries } = await context();
    return rankTracks(queries[SEARCH_CASES.length + index]!, records, 12, HOLDOUT_SEARCH_CASES[index]!.query).map(item => ({ id: item.track.trackId, score: item.score }));
  },
  scorers: [{ name: 'Unchanged retrieval floor on new queries', scorer: ({ output, expected }) => {
    const ranked = output.map(item => item.id), relevant = Object.keys(expected!);
    const metrics = { mrr: reciprocalRank(ranked, relevant), recallAt3: recallAt(ranked, relevant, 3), ndcgAt3: ndcgAt(ranked, expected!, 3) };
    return { score: Number(metrics.mrr >= .5 && metrics.recallAt3 >= .5 && metrics.ndcgAt3 >= .7), metadata: metrics };
  } }],
});

evaluate('Real EmbeddingGemma2 / listening-history recommendations', {
  data: RECOMMENDATION_CASES.map(example => ({ input: example.seed, expected: example })),
  task: async seed => {
    const { records } = await context();
    const result = recommendTracks(records, [{ trackId: seed, playedAt: '2026-02-01T11:00:00.000Z', playDurationMs: 120_000 }],
      { limit: 3, now: Date.parse('2026-02-01T12:00:00.000Z') });
    return { basis: result.basis, tracks: result.tracks.map(item => ({ id: item.track.trackId, cosine: item.score, reason: item.reason })) };
  },
  scorers: [{ name: 'Relevant alternative in top2; no seed replay or contradictory first pick', scorer: ({ output, expected }) => {
    const ranked = output.tracks.map(item => item.id);
    const metrics = { reciprocalRank: reciprocalRank(ranked, expected!.relevant), hasSeed: ranked.includes(expected!.seed),
      unrelatedFirst: expected!.forbidden.includes(ranked[0]!), unique: new Set(ranked).size === ranked.length };
    return { score: Number(output.basis === 'history' && metrics.reciprocalRank >= .5 && !metrics.hasSeed && !metrics.unrelatedFirst && metrics.unique), metadata: metrics };
  } }],
});
