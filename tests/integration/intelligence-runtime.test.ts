import { afterAll, describe, expect, it } from 'vitest';
import { closeEmbeddingWorker, embedTexts } from '../../server/services/intelligence/embedding-service';
import { cosineSimilarity } from '../../server/services/intelligence/math';

const enabled = process.env.EMBEDDING_REAL_TESTS === '1';
const options = { embeddingPython: process.env.EMBEDDING_PYTHON || process.env.NUXT_EMBEDDING_PYTHON };
afterAll(closeEmbeddingWorker);

describe.skipIf(!enabled)('actual offline EmbeddingGemma 2 CPU inference', () => {
  it('returns finite normalized vectors and retrieves a paraphrased music description', async () => {
    const [query, calm, energetic] = await embedTexts([
      { task: 'query', text: 'Quiet music to unwind and fall asleep' },
      { task: 'document', text: 'title: Gentle Rain | text: Soft peaceful ambient music for relaxation and sleep.' },
      { task: 'document', text: 'title: Stadium Riot | text: Aggressive heavy metal with fast drums and screaming guitars.' },
    ], options);
    expect(query).toHaveLength(256);
    expect(query!.every(Number.isFinite)).toBe(true);
    expect(Math.hypot(...query!)).toBeCloseTo(1, 5);
    expect(cosineSimilarity(query!, calm!)).toBeGreaterThan(cosineSimilarity(query!, energetic!));
  }, 300_000);
  it('reuses the model for a new batch without changing deterministic embeddings', async () => {
    const input = { task: 'similarity' as const, text: 'A peaceful piano melody by the ocean.' };
    const first = (await embedTexts([input], options))[0]!;
    const second = (await embedTexts([input], options))[0]!;
    expect(cosineSimilarity(first, second)).toBeGreaterThan(0.99999);
  }, 300_000);
  it('preserves Unicode metadata across consecutive real worker requests', async () => {
    await embedTexts([{ task: 'document', text: 'title: Opening song | text: Original acoustic music.' }], options);
    const inputs = [
      { task: 'document' as const, text: 'title: 静かな夜の音楽 | text: ピアノと雨の音。' },
      { task: 'document' as const, text: 'title: Chanson à l’aube | text: Une mélodie douce et légère.' },
      { task: 'document' as const, text: 'title: Ночная музыка | text: Спокойная мелодия.' },
      { task: 'similarity' as const, text: 'A quiet evening melody 🎵' },
    ];
    const first = await embedTexts(inputs, options);
    const repeated = await embedTexts(inputs, options);
    expect(first).toHaveLength(inputs.length);
    for (let index = 0; index < inputs.length; index++) {
      expect(first[index]).toHaveLength(256);
      expect(first[index]!.every(Number.isFinite)).toBe(true);
      expect(Math.hypot(...first[index]!)).toBeCloseTo(1, 5);
      expect(cosineSimilarity(first[index]!, repeated[index]!)).toBeGreaterThan(0.99999);
    }
  }, 300_000);
});
