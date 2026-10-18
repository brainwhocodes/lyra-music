import { describe, expect, it } from 'vitest';
import { parseWhistleOutput } from '../../server/utils/whistle-service';

const word = (word: string, start: number, end = start + 0.2) => ({ word, start, end, probability: 0.8 });
const output = (words: unknown[], text = 'recognized speech') => JSON.stringify({ text, words });

describe('Whistle timestamped lyric conversion', () => {
  it('uses actual first-word times and groups by punctuation and pauses', () => {
    expect(parseWhistleOutput(output([
      word('Hello', 0.125), word('world.', 0.5), word('Another', 3), word('line', 3.4), word('after', 6), word('a pause.', 6.4),
    ]), 10)).toEqual([
      { time: '00:00.125', text: 'Hello world.' },
      { time: '00:03.000', text: 'Another line' },
      { time: '00:06.000', text: 'after a pause.' },
    ]);
  });

  it('formats rounding across minute/hour boundaries without time drift', () => {
    expect(parseWhistleOutput(output([word('First.', 59.9996), word('Later.', 3600.125)]), 3602))
      .toEqual([{ time: '01:00.000', text: 'First.' }, { time: '60:00.125', text: 'Later.' }]);
  });

  it('limits long unpunctuated lines and retains Unicode', () => {
    const words = Array.from({ length: 10 }, (_, index) => word(index === 0 ? 'Écoute' : 'la', index * 0.4));
    const lines = parseWhistleOutput(output(words), 5);
    expect(lines).toHaveLength(2);
    expect(lines[0].text.split(' ')).toHaveLength(8);
    expect(lines[0].text).toContain('Écoute');
    expect(lines[1].time).toBe('00:03.200');
  });

  it('returns no fabricated lyrics for silence', () => {
    expect(parseWhistleOutput(output([], ''), 1)).toEqual([]);
  });

  it.each([
    'not json', 'null', '[]', '{}', output([], 'speech without timestamps'),
    output([word('unexpected', 0)], ''), output([word('', 0)]),
    output([{ word: 'hello', start: '0', end: 1 }]),
    output([word('negative', -1)]), output([word('reversed', 1, 0)]),
    output([word('late', 20)]), output([word('first', 2), word('backwards', 1)]),
    output([{ ...word('bad probability', 0), probability: 2 }]),
    output([null]), output([word('x'.repeat(501), 0)]),
  ])('rejects malformed response: %s', (response) => {
    expect(() => parseWhistleOutput(response, 10)).toThrow('invalid timestamped speech');
  });
});
