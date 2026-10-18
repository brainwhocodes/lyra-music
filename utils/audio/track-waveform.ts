import { createBoundedAudioFetch } from './bounded-fetch';
import { FullWaveformAccumulator, TRACK_WAVEFORM_LIMITS } from './full-waveform';
import { AudioAnalysisError, type AudioAmplitudeBin } from './types';
import { validateWaveExtent, WAVE_PREFIX_BYTES } from './wave-extent';

export { AudioAnalysisError } from './types';
export { TRACK_WAVEFORM_LIMITS } from './full-waveform';

export interface TrackWaveform {
  trackId: string;
  source: 'mediabunny';
  complete: true;
  /** Actual decoded timeline. Place every bin by its own timestamps. */
  durationSeconds: number;
  bins: AudioAmplitudeBin[];
  codec: string;
  sampleRate: number;
  channels: number;
  decodedFrames: number;
  receivedBytes: number;
  peak: number;
  rms: number;
}
export interface TrackWaveformProgress {
  phase: 'opening' | 'decoding';
  decodedSeconds: number;
  /** Container estimate only; null when unavailable. Never a complete waveform. */
  totalSeconds: number | null;
  receivedBytes: number;
}
export interface TrackWaveformOptions { signal?: AbortSignal; onProgress?: (progress: TrackWaveformProgress) => void }

type Bunny = typeof import('mediabunny');
let active: AbortController | undefined;
const normalize = (error: unknown) => error instanceof AudioAnalysisError ? error : new AudioAnalysisError('invalid-audio', 'A complete waveform is unavailable for this audio.');

/** Local library only. The caller must keep the ordinary seek bar on any failure. */
export function decodeTrackWaveform(trackId: string, options: TrackWaveformOptions = {}): Promise<TrackWaveform> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(trackId)) return Promise.reject(new AudioAnalysisError('invalid-audio', 'Choose a local library track.'));
  if (typeof window === 'undefined') return Promise.reject(new AudioAnalysisError('unsupported', 'Waveform decoding requires a browser.'));
  const url = new URL(`/api/tracks/${encodeURIComponent(trackId)}/stream`, window.location.origin).href;
  return decode(trackId, options, (bunny, signal, fail) => {
    const download = createBoundedAudioFetch(url, signal, fail, globalThis.fetch, { prefixBytes: WAVE_PREFIX_BYTES, validate: validateWaveExtent });
    return { source: new bunny.UrlSource(url, {
      fetchFn: download.fetchFn,
      requestInit: { credentials: 'same-origin', redirect: 'error' },
      getRetryDelay: () => null,
      maxCacheSize: TRACK_WAVEFORM_LIMITS.cacheBytes,
      parallelism: 1,
      handleUnhandledError: error => fail(normalize(error)),
    }), bytes: () => download.receivedBytes };
  });
}

/** Identical full-timeline decoder for offline files and actual-codec checks. */
export function decodeWaveformBlob(blob: Blob, options: TrackWaveformOptions = {}): Promise<TrackWaveform> {
  if (blob.size > TRACK_WAVEFORM_LIMITS.networkBytes) return Promise.reject(new AudioAnalysisError('limit', 'This audio exceeds the waveform download limit.'));
  return decode('local-file', options, bunny => ({ source: new bunny.BlobSource(blob), bytes: () => 0, blob }));
}

async function decode(
  trackId: string,
  options: TrackWaveformOptions,
  sourceFactory: (bunny: Bunny, signal: AbortSignal, fail: (error: AudioAnalysisError) => void) => { source: InstanceType<Bunny['Source']>; bytes: () => number; blob?: Blob },
): Promise<TrackWaveform> {
  if (options.signal?.aborted) throw new AudioAnalysisError('cancelled', 'Waveform decoding was cancelled.');
  if (active && !active.signal.aborted) throw new AudioAnalysisError('busy', 'A waveform is already being decoded.');
  const controller = new AbortController();
  active = controller;
  let input: InstanceType<Bunny['Input']> | undefined;
  let rejectAbort!: (reason: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const dispose = () => { try { input?.dispose(); } catch { /* Preserve the original failure. */ } };
  const abort = () => { dispose(); rejectAbort(controller.signal.reason); };
  controller.signal.addEventListener('abort', abort, { once: true });
  const fail = (error: AudioAnalysisError) => { if (!controller.signal.aborted) controller.abort(error); };
  const cancel = () => fail(new AudioAnalysisError('cancelled', 'Waveform decoding was cancelled.'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(() => fail(new AudioAnalysisError('timeout', 'Waveform decoding exceeded its time budget.')), TRACK_WAVEFORM_LIMITS.timeoutMs);
  const check = () => { if (controller.signal.aborted) throw controller.signal.reason; };
  const work = async (): Promise<TrackWaveform> => {
    options.onProgress?.({ phase: 'opening', decodedSeconds: 0, totalSeconds: null, receivedBytes: 0 });
    const bunny = await import('mediabunny'); check();
    const source = sourceFactory(bunny, controller.signal, fail);
    if (source.blob) {
      const blob = source.blob;
      const prefix = new Uint8Array(await blob.slice(0, WAVE_PREFIX_BYTES).arrayBuffer()); check();
      if (!validateWaveExtent(prefix, blob.size)) throw new AudioAnalysisError('invalid-audio', 'The audio header is incomplete.');
    }
    input = new bunny.Input({ source: source.source, formats: [bunny.MP3, bunny.WAVE, bunny.FLAC, bunny.OGG, bunny.MP4, bunny.ADTS, bunny.MATROSKA] });
    const track = await input.getPrimaryAudioTrack(); check();
    if (!track) throw new AudioAnalysisError('invalid-audio', 'This file contains no audio track.');
    const channels = await track.getNumberOfChannels(); check();
    const sampleRate = await track.getSampleRate(); check();
    const accumulator = new FullWaveformAccumulator(sampleRate, channels);
    const estimate = await track.getDurationFromMetadata(); check();
    if (estimate !== null && (!Number.isFinite(estimate) || estimate <= 0)) throw new AudioAnalysisError('invalid-audio', 'This file has an invalid audio duration.');
    if (estimate !== null && (estimate > TRACK_WAVEFORM_LIMITS.seconds || estimate * sampleRate * channels > TRACK_WAVEFORM_LIMITS.channelSamples)) {
      throw new AudioAnalysisError('limit', 'The complete track exceeds the waveform resource limits.');
    }
    const codec = await track.getCodec(); check();
    if (!codec || !await track.canDecode()) throw new AudioAnalysisError('unsupported', 'This browser cannot decode a waveform for this format.');
    check();
    const sink = new bunny.AudioSampleSink(track);
    let lastYield = performance.now(), lastProgress = -Infinity, sampleCount = 0, channelSamples = 0, lastDecodedEnd = -Infinity;
    // Deliberately no end timestamp: success requires the complete decoded stream.
    for await (const sample of sink.samples()) {
      try {
        check();
        if (++sampleCount > TRACK_WAVEFORM_LIMITS.samples || sample.numberOfFrames > TRACK_WAVEFORM_LIMITS.sampleFrames) throw new AudioAnalysisError('limit', 'This audio exceeds the waveform decoding limits.');
        if (!Number.isFinite(sample.timestamp) || !Number.isInteger(sample.numberOfFrames) || sample.numberOfFrames < 1 || sample.sampleRate !== sampleRate || sample.numberOfChannels !== channels) {
          throw new AudioAnalysisError('invalid-audio', 'The decoded audio contains inconsistent samples.');
        }
        channelSamples += sample.numberOfFrames * channels;
        if (channelSamples > TRACK_WAVEFORM_LIMITS.channelSamples) throw new AudioAnalysisError('limit', 'This audio exceeds the waveform sample budget.');
        if (sample.timestamp < lastDecodedEnd - 1 / sampleRate) throw new AudioAnalysisError('invalid-audio', 'The decoded audio timestamps moved backwards.');
        lastDecodedEnd = sample.timestamp + sample.numberOfFrames / sampleRate;
        const firstFrame = Math.max(0, Math.ceil(-sample.timestamp * sampleRate));
        for (let offset = firstFrame; offset < sample.numberOfFrames; offset += TRACK_WAVEFORM_LIMITS.copyFrames) {
          check();
          const frameCount = Math.min(TRACK_WAVEFORM_LIMITS.copyFrames, sample.numberOfFrames - offset);
          const pcm = new Float32Array(frameCount * channels);
          sample.copyTo(pcm, { format: 'f32', planeIndex: 0, frameOffset: offset, frameCount });
          accumulator.add(pcm, Math.max(0, sample.timestamp + offset / sampleRate));
          const decodedSeconds = sample.timestamp + (offset + frameCount) / sampleRate;
          if (performance.now() - lastProgress >= 100) {
            options.onProgress?.({ phase: 'decoding', decodedSeconds, totalSeconds: estimate, receivedBytes: source.bytes() });
            lastProgress = performance.now();
          }
          if (performance.now() - lastYield >= 8) {
            await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); lastYield = performance.now();
          }
        }
      } finally { sample.close(); }
      if (performance.now() - lastYield >= 8) {
        await new Promise<void>(resolve => setTimeout(resolve, 0)); check(); lastYield = performance.now();
      }
    }
    check();
    const reduced = accumulator.finish();
    // Small codec padding differences are normal. Larger disagreement in either
    // direction cannot safely represent the declared seek timeline.
    if (estimate !== null && Math.abs(estimate - reduced.durationSeconds) > .25) throw new AudioAnalysisError('invalid-audio', 'The decoded audio does not match the complete track timeline.');
    options.onProgress?.({ phase: 'decoding', decodedSeconds: reduced.durationSeconds, totalSeconds: reduced.durationSeconds, receivedBytes: source.bytes() });
    check();
    return { ...reduced, trackId, source: 'mediabunny', complete: true, codec, sampleRate, channels, receivedBytes: source.bytes() };
  };
  try { return await Promise.race([work(), aborted]); }
  catch (error) { throw controller.signal.aborted ? controller.signal.reason : normalize(error); }
  finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', abort);
    dispose();
    if (active === controller) active = undefined;
  }
}
