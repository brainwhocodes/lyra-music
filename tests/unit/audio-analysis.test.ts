import { describe, expect, it, vi } from 'vitest';
import { AmplitudeAccumulator } from '../../utils/audio/waveform';
import { AUDIO_ANALYSIS_LIMITS } from '../../utils/audio/types';
import { createBoundedAudioFetch } from '../../utils/audio/bounded-fetch';

describe('streamed PCM amplitude reduction', () => {
  it('measures both stereo channels without phase cancellation, in quarter-second bins', () => {
    const waveform = new AmplitudeAccumulator(8, 2);
    waveform.add(new Float32Array([.5, -.5, .5, -.5, 1, -1, 1, -1]), 0);
    expect(waveform.finish()).toEqual({
      bins: [{ startSeconds: 0, endSeconds: .25, peak: .5, rms: .5 }, { startSeconds: .25, endSeconds: .5, peak: 1, rms: 1 }],
      peak: 1, rms: Math.sqrt(.625), decodedFrames: 4, analyzedDurationSeconds: .5,
    });
  });
  it('does not normalize silence or quiet levels into a fabricated loud waveform', () => {
    const waveform = new AmplitudeAccumulator(8, 1);
    waveform.add(new Float32Array([0, 0, .125, -.125]), 0);
    expect(waveform.finish().bins.map(bin => bin.peak)).toEqual([0, .125]);
  });
  it('preserves float headroom without pretending values above1 are clipped', () => {
    const waveform = new AmplitudeAccumulator(4, 1);
    waveform.add(new Float32Array([1.25]), 0);
    expect(waveform.finish().peak).toBe(1.25);
  });
  it('rejects corrupt timing and amplitudes', () => {
    expect(() => new AmplitudeAccumulator(8, 1).add(new Float32Array([NaN]), 0)).toThrow(/invalid amplitudes/);
    expect(() => new AmplitudeAccumulator(8, 1).add(new Float32Array([0]), Infinity)).toThrow(/invalid sample timing/);
    const waveform = new AmplitudeAccumulator(8, 1);
    waveform.add(new Float32Array([0, 0, 0, 0]), 0);
    expect(() => waveform.add(new Float32Array([0]), 0)).toThrow(/invalid sample timing/);
  });
  it('bounds formats, copy blocks, and total decoded frames', () => {
    expect(() => new AmplitudeAccumulator(192001, 1)).toThrow(/192 kHz/);
    expect(() => new AmplitudeAccumulator(48000, 9)).toThrow(/8 channels/);
    expect(() => new AmplitudeAccumulator(48000, 1).add(new Float32Array(16385), 0)).toThrow(/limit/);
    expect(() => new AmplitudeAccumulator(4, 1).add(new Float32Array(122), 0)).toThrow(/limit/);
  });
});

describe('bounded audio range fetching', () => {
  const url = 'https://library.test/api/tracks/song/stream';
  it('keeps credentials local, rejects redirects, and preserves range-response metadata', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(new Uint8Array([1,2,3]), { status: 206, headers: { 'Content-Range': 'bytes 0-2/3' } }));
    const reader = createBoundedAudioFetch(url, new AbortController().signal, vi.fn(), fetchImpl);
    const response = await reader.fetchFn(url, { headers: { Range: 'bytes=0-' }, credentials: 'include', redirect: 'follow' });
    expect(response.status).toBe(206);
    expect(response.headers.get('Content-Range')).toBe('bytes 0-2/3');
    expect([...new Uint8Array(await response.arrayBuffer())]).toEqual([1,2,3]);
    expect(reader.receivedBytes).toBe(3);
    expect(fetchImpl.mock.calls[0]![1]).toMatchObject({ credentials: 'same-origin', redirect: 'error', headers: { Range: 'bytes=0-' } });
  });
  it('counts across requests and cancels the stream when the byte budget is exceeded', async () => {
    const cancel = vi.fn();
    const fatal = vi.fn();
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(new Uint8Array(AUDIO_ANALYSIS_LIMITS.networkBytes)))
      .mockResolvedValueOnce(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1)); }, cancel })));
    const reader = createBoundedAudioFetch(url, new AbortController().signal, fatal, fetchImpl);
    await (await reader.fetchFn(url)).arrayBuffer();
    await expect((await reader.fetchFn(url)).arrayBuffer()).rejects.toMatchObject({ code: 'limit' });
    expect(cancel).toHaveBeenCalledOnce();
    expect(fatal).toHaveBeenCalledWith(expect.objectContaining({ code: 'limit' }));
  });
  it('cancels a pending body read when the operation is aborted', async () => {
    const controller = new AbortController();
    const cancel = vi.fn();
    const reader = createBoundedAudioFetch(url, controller.signal, vi.fn(), vi.fn<typeof fetch>().mockResolvedValue(new Response(new ReadableStream({ cancel }))));
    const pending = (await reader.fetchFn(url)).arrayBuffer();
    const assertion = expect(pending).rejects.toThrow('stop');
    controller.abort(new Error('stop'));
    await assertion;
    expect(cancel).toHaveBeenCalledOnce();
  });
  it('rejects cross-track URLs and HTTP failures without decoding their bodies', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('not authorized', { status: 401 }));
    const reader = createBoundedAudioFetch(url, new AbortController().signal, vi.fn(), fetchImpl);
    await expect(reader.fetchFn('https://elsewhere.test/audio')).rejects.toMatchObject({ code: 'network' });
    expect(fetchImpl).not.toHaveBeenCalled();
    await expect(reader.fetchFn(url)).rejects.toMatchObject({ code: 'network' });
  });
});
