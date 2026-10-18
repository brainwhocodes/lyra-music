import { describe, expect, it } from 'vitest';
import { FullWaveformAccumulator } from '../../utils/audio/full-waveform';
import { createBoundedAudioFetch } from '../../utils/audio/bounded-fetch';
import { validateWaveExtent, WAVE_PREFIX_BYTES } from '../../utils/audio/wave-extent';
import { pcmWave } from '../helpers/pcm-wave';

describe('adaptive full-timeline amplitude bins', () => {
  it('merges adjacent bins with sample-weighted RMS and preserves actual time intervals', () => {
    const waveform = new FullWaveformAccumulator(10, 2);
    const samples = Float32Array.from({ length: 402 }, (_, index) => (index % 2 ? -1 : 1) * ((Math.floor(index / 2) % 7) / 8));
    waveform.add(samples, 0);
    const result = waveform.finish();
    expect(result.durationSeconds).toBe(20.1);
    expect(result.bins.length).toBeLessThanOrEqual(256);
    expect(result.bins[0]!.startSeconds).toBe(0);
    expect(result.bins.at(-1)!.endSeconds).toBe(20.1);
    for (const [index, bin] of result.bins.entries()) {
      if (index) expect(bin.startSeconds).toBe(result.bins[index - 1]!.endSeconds);
      const included = [...samples].filter((_, sample) => Math.floor(sample / 2) / 10 >= bin.startSeconds && Math.floor(sample / 2) / 10 < bin.endSeconds);
      const peak = included.length ? Math.max(...included.map(Math.abs)) : 0;
      const rms = included.length ? Math.sqrt(included.reduce((sum, value) => sum + value * value, 0) / included.length) : 0;
      expect(bin.peak).toBe(peak);
      expect(bin.rms).toBeCloseTo(rms, 12);
    }
  });
  it('retains a late transient at its late timestamp instead of spreading a prefix', () => {
    const waveform = new FullWaveformAccumulator(10, 1);
    const samples = new Float32Array(650); samples[620] = .75;
    waveform.add(samples, 0);
    const result = waveform.finish();
    const peaks = result.bins.filter(bin => bin.peak > 0);
    expect(peaks).toHaveLength(1);
    expect(peaks[0]!.startSeconds).toBeLessThanOrEqual(62);
    expect(peaks[0]!.endSeconds).toBeGreaterThan(62);
    expect(peaks[0]!.startSeconds / result.durationSeconds).toBeGreaterThan(.9);
    expect(result.bins.filter(bin => bin.endSeconds <= 30).every(bin => bin.peak === 0)).toBe(true);
  });
  it('refuses to turn a partial over-limit decode into a complete waveform', () => {
    const waveform = new FullWaveformAccumulator(10, 1);
    waveform.add(new Float32Array(3000), 0);
    expect(() => waveform.add(new Float32Array(3001), 300)).toThrow(/resource limits/);
    expect(() => new FullWaveformAccumulator(96001, 1)).toThrow(/resource limits/);
    expect(() => new FullWaveformAccumulator(48000, 9)).toThrow(/resource limits/);
  });
  it('rejects malformed timing and amplitudes rather than drawing invented data', () => {
    expect(() => new FullWaveformAccumulator(10, 1).add(new Float32Array([Infinity]), 0)).toThrow(/invalid amplitudes/);
    expect(() => new FullWaveformAccumulator(10, 1).add(new Float32Array([1]), NaN)).toThrow(/invalid sample timing/);
    const waveform = new FullWaveformAccumulator(10, 1);
    waveform.add(new Float32Array(20), 0);
    expect(() => waveform.add(new Float32Array(1), 0)).toThrow(/invalid sample timing/);
  });
  it('validates the actual HTTP WAVE extent before passing malformed header bytes to the decoder', async () => {
    const bytes = await pcmWave(1).arrayBuffer();
    const header = new DataView(bytes); header.setUint32(4, 36 + 60 * 16000 * 2, true);
    const url = 'https://library.test/api/tracks/local/stream';
    const source = createBoundedAudioFetch(url, new AbortController().signal, () => {}, async () => new Response(bytes, { status: 206, headers: { 'Content-Range': `bytes 0-${bytes.byteLength - 1}/${bytes.byteLength}` } }), { prefixBytes: WAVE_PREFIX_BYTES, validate: validateWaveExtent });
    await expect((await source.fetchFn(url)).arrayBuffer()).rejects.toMatchObject({ code: 'invalid-audio' });
  });
});
