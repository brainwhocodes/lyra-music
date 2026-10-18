import { afterEach, describe, expect, it, vi } from 'vitest';
import { AudioSample, AudioSampleSink, Input, InputAudioTrack } from 'mediabunny';
import { decodeWaveformBlob, decodeTrackWaveform, TRACK_WAVEFORM_LIMITS } from '../../utils/audio/track-waveform';
import { pcmWave } from '../helpers/pcm-wave';

afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('complete waveform real Mediabunny decoding', () => {
  it('decodes a65second real PCM file with its only signal after60seconds', async () => {
    const result = await decodeWaveformBlob(pcmWave(65, 8000, 1, frame => frame >= 61 * 8000 && frame < 63 * 8000 ? .75 : 0));
    expect(result).toMatchObject({ complete: true, source: 'mediabunny', durationSeconds: 65, decodedFrames: 520000, sampleRate: 8000, channels: 1 });
    expect(result.bins.length).toBeLessThanOrEqual(256);
    expect(result.bins.at(-1)!.endSeconds).toBe(65);
    const audible = result.bins.filter(bin => bin.peak > .1);
    expect(audible.length).toBeGreaterThan(0);
    expect(audible[0]!.startSeconds).toBe(61);
    expect(audible.at(-1)!.endSeconds).toBe(63);
    expect(result.bins.filter(bin => bin.endSeconds <= 30).every(bin => bin.peak === 0)).toBe(true);
    expect(result.rms).toBeCloseTo(.75 * Math.sqrt(2 / 65), 4);
  });
  it('completes a real ten-minute PCM timeline within the fixed bin budget', async () => {
    const result = await decodeWaveformBlob(pcmWave(600, 1000, 1, frame => frame >= 599000 ? .25 : 0));
    expect(result.durationSeconds).toBe(600);
    expect(result.decodedFrames).toBe(600000);
    expect(result.bins.length).toBeLessThanOrEqual(256);
    expect(result.bins.at(-1)).toMatchObject({ endSeconds: 600 });
    expect(result.bins.at(-1)!.peak).toBeCloseTo(.25, 4);
    expect(result.rms).toBeCloseTo(.25 * Math.sqrt(1 / 600), 5);
  });
  it('rejects known long files before codec decoding and unknown long files at the actual limit', async () => {
    const canDecode = vi.spyOn(InputAudioTrack.prototype, 'canDecode');
    const blob = pcmWave(601, 100);
    await expect(decodeWaveformBlob(blob)).rejects.toMatchObject({ code: 'limit' });
    expect(canDecode).not.toHaveBeenCalled();
    vi.spyOn(InputAudioTrack.prototype, 'getDurationFromMetadata').mockResolvedValue(null);
    await expect(decodeWaveformBlob(blob)).rejects.toMatchObject({ code: 'limit' });
    expect(canDecode).toHaveBeenCalled();
  });
  it.each([60, .1])('refuses a materially incorrect declared timeline of%sseconds instead of claiming complete', async estimate => {
    vi.spyOn(InputAudioTrack.prototype, 'getDurationFromMetadata').mockResolvedValue(estimate);
    await expect(decodeWaveformBlob(pcmWave(1))).rejects.toMatchObject({ code: 'invalid-audio' });
  });
  it.each(['riff-and-data', 'data-only'])('rejects a real truncated WAVE header (%s), before the decoder can normalize its duration', async declaration => {
    const bytes = await pcmWave(1).arrayBuffer();
    const header = new DataView(bytes);
    if (declaration === 'riff-and-data') header.setUint32(4, 36 + 60 * 16000 * 2, true);
    header.setUint32(40, 60 * 16000 * 2, true);
    const canDecode = vi.spyOn(InputAudioTrack.prototype, 'canDecode');
    await expect(decodeWaveformBlob(new Blob([bytes]))).rejects.toMatchObject({ code: 'invalid-audio' });
    expect(canDecode).not.toHaveBeenCalled();
  });
  it('charges negative-timestamp native samples to the decoded-sample budget before trimming priming', async () => {
    const block = new Float32Array(1_000_000);
    vi.spyOn(AudioSampleSink.prototype, 'samples').mockImplementation(async function* () {
      for (let index = 0; index < 61; index++) {
        yield new AudioSample({ format: 'f32', data: block, sampleRate: 16000, numberOfChannels: 1, timestamp: -10000 + index * 62.5 });
      }
      yield new AudioSample({ format: 'f32', data: new Float32Array(16000), sampleRate: 16000, numberOfChannels: 1, timestamp: 0 });
    });
    await expect(decodeWaveformBlob(pcmWave(1))).rejects.toMatchObject({ code: 'limit' });
  });
  it('preserves silent and antiphase stereo audio and releases native resources', async () => {
    const close = vi.spyOn(AudioSample.prototype, 'close');
    const dispose = vi.spyOn(Input.prototype, 'dispose');
    const silent = await decodeWaveformBlob(pcmWave(1));
    expect(silent.bins.every(bin => bin.peak === 0 && bin.rms === 0)).toBe(true);
    const stereo = await decodeWaveformBlob(pcmWave(1, 16000, 2, (_, channel) => channel ? -.25 : .25));
    expect(stereo.rms).toBeCloseTo(.25, 4);
    expect(close).toHaveBeenCalled();
    expect(dispose).toHaveBeenCalledTimes(2);
  });
  it('rejects actual malformed bytes and oversized local files, then supports retry', async () => {
    await expect(decodeWaveformBlob(new Blob(['invalid audio']))).rejects.toMatchObject({ code: 'invalid-audio' });
    await expect(decodeWaveformBlob(new Blob([new Uint8Array(TRACK_WAVEFORM_LIMITS.networkBytes + 1)]))).rejects.toMatchObject({ code: 'limit' });
    await expect(decodeTrackWaveform('https://podcast.example/episode.mp3')).rejects.toMatchObject({ code: 'invalid-audio' });
    expect((await decodeWaveformBlob(pcmWave(.25))).complete).toBe(true);
  });
  it('falls back on unavailable codec capability without publishing partial bins', async () => {
    vi.spyOn(InputAudioTrack.prototype, 'canDecode').mockResolvedValue(false);
    await expect(decodeWaveformBlob(pcmWave(.25))).rejects.toMatchObject({ code: 'unsupported' });
  });
  it('cancels during genuine decoding and never resolves with a partial waveform', async () => {
    const controller = new AbortController();
    await expect(decodeWaveformBlob(pcmWave(65, 8000), { signal: controller.signal, onProgress(value) { if (value.phase === 'decoding') controller.abort(); } })).rejects.toMatchObject({ code: 'cancelled' });
    expect((await decodeWaveformBlob(pcmWave(.25))).durationSeconds).toBe(.25);
  });
  it('allows immediate replacement after abort and a late old codec promise cannot clear its lock or report progress', async () => {
    let releaseOld!: (value: boolean) => void, releaseNew!: (value: boolean) => void;
    let oldReady!: () => void, newReady!: () => void;
    const oldStarted = new Promise<void>(resolve => { oldReady = resolve; });
    const newStarted = new Promise<void>(resolve => { newReady = resolve; });
    vi.spyOn(InputAudioTrack.prototype, 'canDecode')
      .mockImplementationOnce(() => { oldReady(); return new Promise(resolve => { releaseOld = resolve; }); })
      .mockImplementationOnce(() => { newReady(); return new Promise(resolve => { releaseNew = resolve; }); });
    const controller = new AbortController();
    const progress = vi.fn();
    const old = decodeWaveformBlob(pcmWave(1), { signal: controller.signal, onProgress: progress });
    const oldAssertion = expect(old).rejects.toMatchObject({ code: 'cancelled' });
    await oldStarted;
    controller.abort();
    const replacement = decodeWaveformBlob(pcmWave(2));
    await newStarted;
    releaseOld(true); await oldAssertion;
    await expect(decodeWaveformBlob(pcmWave(.25))).rejects.toMatchObject({ code: 'busy' });
    releaseNew(true);
    expect((await replacement).durationSeconds).toBe(2);
    expect(progress.mock.calls.every(([value]) => value.phase === 'opening')).toBe(true);
    expect((await decodeWaveformBlob(pcmWave(.25))).complete).toBe(true);
  });
  it('disposes a stalled decoder on the wall-time budget and releases the next request', async () => {
    vi.useFakeTimers();
    let ready!: () => void;
    const started = new Promise<void>(resolve => { ready = resolve; });
    const capability = vi.spyOn(InputAudioTrack.prototype, 'canDecode').mockImplementationOnce(() => { ready(); return new Promise(() => {}); });
    const dispose = vi.spyOn(Input.prototype, 'dispose');
    const pending = decodeWaveformBlob(pcmWave(.25));
    const assertion = expect(pending).rejects.toMatchObject({ code: 'timeout' });
    await started;
    await vi.advanceTimersByTimeAsync(TRACK_WAVEFORM_LIMITS.timeoutMs);
    await assertion;
    expect(dispose).toHaveBeenCalled();
    capability.mockRestore(); vi.useRealTimers();
    expect((await decodeWaveformBlob(pcmWave(.25))).complete).toBe(true);
  });
});
