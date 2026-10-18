import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSample, InputAudioTrack, Input } from 'mediabunny';
import { analyzeAudioBlob, analyzeTrackAudio } from '../../utils/audio/track-analysis';
import { pcmWave } from '../helpers/pcm-wave';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('real Mediabunny decoding', () => {
  it('decodes a known PCM sine wave and matches its independent analytic RMS', async () => {
    const result = await analyzeAudioBlob(pcmWave(1, 16000, 1, frame => .5 * Math.sin(2 * Math.PI * 1000 * frame / 16000)));
    expect(result).toMatchObject({ source: 'mediabunny', codec: 'pcm-s16', channels: 1, sampleRate: 16000, decodedFrames: 16000, analyzedDurationSeconds: 1, truncated: false, receivedBytes: 0 });
    expect(result.peak).toBeCloseTo(.5, 4);
    expect(result.rms).toBeCloseTo(.5 / Math.sqrt(2), 4);
    expect(result.bins).toHaveLength(4);
    for (const bin of result.bins) expect(bin.rms).toBeCloseTo(.5 / Math.sqrt(2), 4);
  });
  it('decodes silence honestly and closes every yielded sample and input', async () => {
    const close = vi.spyOn(AudioSample.prototype, 'close');
    const dispose = vi.spyOn(Input.prototype, 'dispose');
    const result = await analyzeAudioBlob(pcmWave(.5));
    expect(result.peak).toBe(0);
    expect(result.rms).toBe(0);
    expect(close).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledOnce();
  });
  it('decodes the real speech WAV fixture without an API key or AudioDecoder polyfill', async () => {
    const bytes = await readFile(new URL('../fixtures/music/audio/spoken-test.wav', import.meta.url));
    const result = await analyzeAudioBlob(new Blob([bytes]));
    expect(result.sampleRate).toBe(16000);
    expect(result.analyzedDurationSeconds).toBeGreaterThan(2);
    expect(result.peak).toBeGreaterThan(.01);
    expect(result.rms).toBeGreaterThan(.001);
    expect(result.rms).toBeLessThanOrEqual(result.peak);
  });
  it('decodes only the first30seconds and excludes a loud tail', async () => {
    const result = await analyzeAudioBlob(pcmWave(31, 8000, 1, frame => frame < 30 * 8000 ? .125 : 1));
    expect(result.truncated).toBe(true);
    expect(result.analyzedDurationSeconds).toBe(30);
    expect(result.decodedFrames).toBe(240000);
    expect(result.bins).toHaveLength(120);
    expect(result.peak).toBeCloseTo(.125, 4);
  });
  it('fails cleanly on genuine corrupt bytes, then accepts a valid retry', async () => {
    await expect(analyzeAudioBlob(new Blob(['not an audio file']))).rejects.toMatchObject({ code: 'invalid-audio' });
    expect((await analyzeAudioBlob(pcmWave(.25))).bins).toHaveLength(1);
  });
  it('reports codec capability failure without changing playback or masking it as corrupt audio', async () => {
    vi.spyOn(InputAudioTrack.prototype, 'canDecode').mockResolvedValue(false);
    await expect(analyzeAudioBlob(pcmWave(.25))).rejects.toMatchObject({ code: 'unsupported' });
  });
  it('supports cancellation during real sample reduction and can retry afterwards', async () => {
    const controller = new AbortController();
    await expect(analyzeAudioBlob(pcmWave(30), { signal: controller.signal, onProgress(progress) { if (progress.phase === 'decoding') controller.abort(); } })).rejects.toMatchObject({ code: 'cancelled' });
    expect((await analyzeAudioBlob(pcmWave(.25))).decodedFrames).toBe(4000);
  });
  it('rejects simultaneous work and immediately cancels pending initialization', async () => {
    const controller = new AbortController();
    const first = analyzeAudioBlob(pcmWave(1), { signal: controller.signal });
    const firstAssertion = expect(first).rejects.toMatchObject({ code: 'cancelled' });
    await expect(analyzeAudioBlob(pcmWave(1))).rejects.toMatchObject({ code: 'busy' });
    controller.abort();
    await firstAssertion;
  });
  it('times out stalled codec initialization and disposes its input', async () => {
    vi.useFakeTimers();
    let reached!: () => void;
    const ready = new Promise<void>(resolve => { reached = resolve; });
    vi.spyOn(InputAudioTrack.prototype, 'canDecode').mockImplementation(() => { reached(); return new Promise(() => {}); });
    const dispose = vi.spyOn(Input.prototype, 'dispose');
    const result = analyzeAudioBlob(pcmWave(.25));
    const assertion = expect(result).rejects.toMatchObject({ code: 'timeout' });
    await ready;
    await vi.advanceTimersByTimeAsync(20_000);
    await assertion;
    expect(dispose).toHaveBeenCalled();
  });
  it('rejects oversized local files and invalid track identities before importing/reading them', async () => {
    await expect(analyzeAudioBlob(new Blob([new Uint8Array(16 * 1024 * 1024 + 1)]))).rejects.toMatchObject({ code: 'limit' });
    await expect(analyzeTrackAudio('../other')).rejects.toMatchObject({ code: 'invalid-audio' });
    const controller = new AbortController(); controller.abort();
    await expect(analyzeAudioBlob(pcmWave(.25), { signal: controller.signal })).rejects.toMatchObject({ code: 'cancelled' });
  });
});
