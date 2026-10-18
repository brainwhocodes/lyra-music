/** Lexical WER: Unicode lowercase, punctuation removed, whitespace tokenization.
 * No homophone/name correction is applied after seeing a model's output.
 */
export function words(text: string): string[] {
  return text.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}\s]/gu, '').trim().split(/\s+/).filter(Boolean);
}

export function wordErrors(reference: string, hypothesis: string) {
  const expected = words(reference), actual = words(hypothesis);
  let previous = Array.from({ length: actual.length + 1 }, (_, i) => i);
  for (let i = 1; i <= expected.length; i++) {
    const current = [i];
    for (let j = 1; j <= actual.length; j++) current[j] = Math.min(
      current[j - 1]! + 1, previous[j]! + 1,
      previous[j - 1]! + Number(expected[i - 1] !== actual[j - 1]),
    );
    previous = current;
  }
  const errors = previous[actual.length]!;
  return { errors, referenceWords: expected.length, hypothesisWords: actual.length,
    wer: expected.length ? errors / expected.length : null };
}

export function reciprocalRank(ranked: string[], relevant: string[]): number {
  const index = ranked.findIndex(id => relevant.includes(id));
  return index < 0 ? 0 : 1 / (index + 1);
}

export function recallAt(ranked: string[], relevant: string[], k: number): number {
  return relevant.length ? new Set(ranked.slice(0, k).filter(id => relevant.includes(id))).size / relevant.length : 0;
}

export function ndcgAt(ranked: string[], relevance: Record<string, number>, k: number): number {
  const dcg = (grades: number[]) => grades.reduce((total, grade, i) => total + (2 ** grade - 1) / Math.log2(i + 2), 0);
  const ideal = dcg(Object.values(relevance).sort((a, b) => b - a).slice(0, k));
  return ideal ? dcg(ranked.slice(0, k).map(id => relevance[id] ?? 0)) / ideal : 0;
}
