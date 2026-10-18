import { createBoundedAudioFetch } from './bounded-fetch';
import { AmplitudeAccumulator } from './waveform';
import { AUDIO_ANALYSIS_LIMITS, AudioAnalysisError, type AudioAnalysis, type AudioAnalysisOptions } from './types';

export { AUDIO_ANALYSIS_LIMITS, AudioAnalysisError } from './types';
export type { AudioAnalysis, AudioAnalysisOptions, AudioAnalysisProgress, AudioAmplitudeBin } from './types';

type Bunny = typeof import('mediabunny');
let active = false;

function normalizeError(error: unknown): AudioAnalysisError {
  if (error instanceof AudioAnalysisError) return error;
  return new AudioAnalysisError('invalid-audio', 'This audio could not be decoded for analysis. Playback may still be available.');
}

/** Only called by an explicit user action. Does not touch the native playback element. */
export function analyzeTrackAudio(trackId: string, options: AudioAnalysisOptions = {}): Promise<AudioAnalysis> {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(trackId)) return Promise.reject(new AudioAnalysisError('invalid-audio', 'Choose a library track to analyze.'));
  if (typeof window === 'undefined') return Promise.reject(new AudioAnalysisError('unsupported', 'Audio analysis is available in the browser.'));
  const url = new URL(`/api/tracks/${encodeURIComponent(trackId)}/stream`, window.location.origin).href;
  return analyze(trackId, options, (bunny, signal, fail) => {
    const download = createBoundedAudioFetch(url, signal, fail);
    return {
      source: new bunny.UrlSource(url, {
        fetchFn: download.fetchFn,
        requestInit: { credentials: 'same-origin', redirect: 'error' },
        getRetryDelay: () => null,
        maxCacheSize: AUDIO_ANALYSIS_LIMITS.cacheBytes,
        parallelism: 1,
        handleUnhandledError: error => fail(normalizeError(error)),
      }),
      bytes: () => download.receivedBytes,
    };
  });
}

/** The same decoder for local files and deterministic real-codec integration checks. */
export function analyzeAudioBlob(blob: Blob, options: AudioAnalysisOptions = {}): Promise<AudioAnalysis> {
  if (blob.size > AUDIO_ANALYSIS_LIMITS.networkBytes) return Promise.reject(new AudioAnalysisError('limit', 'The local audio exceeds the 16 MiB analysis limit.'));
  return analyze('local-file', options, bunny => ({ source: new bunny.BlobSource(blob), bytes: () => 0 }));
}

async function analyze(
  trackId: string,
  options: AudioAnalysisOptions,
  makeSource: (bunny: Bunny, signal: AbortSignal, fail: (error: AudioAnalysisError) => void) => { source: InstanceType<Bunny['Source']>; bytes: () => number },
): Promise<AudioAnalysis> {
  if (options.signal?.aborted) throw new AudioAnalysisError('cancelled', 'Audio analysis was cancelled.');
  if (active) throw new AudioAnalysisError('busy', 'Another audio preview is still being analyzed.');
  active = true;
  const controller = new AbortController();
  let input: InstanceType<Bunny['Input']> | undefined;
  let rejectAbort!: (error: unknown) => void;
  const aborted = new Promise<never>((_, reject) => { rejectAbort = reject; });
  const dispose = () => { try { input?.dispose(); } catch { /* Cleanup must not replace the useful error. */ } };
  const abort = () => { dispose(); rejectAbort(controller.signal.reason); };
  controller.signal.addEventListener('abort', abort, { once: true });
  const fail = (error: AudioAnalysisError) => { if (!controller.signal.aborted) controller.abort(error); };
  const cancel = () => fail(new AudioAnalysisError('cancelled', 'Audio analysis was cancelled.'));
  options.signal?.addEventListener('abort', cancel, { once: true });
  if (options.signal?.aborted) cancel();
  const timer = setTimeout(() => fail(new AudioAnalysisError('timeout', 'Audio analysis took too long. Try again or continue listening.')), AUDIO_ANALYSIS_LIMITS.timeoutMs);
  const check = () => { if (controller.signal.aborted) throw controller.signal.reason; };
  const work = async (): Promise<AudioAnalysis> => {
    options.onProgress?.({ phase: 'opening', decodedSeconds: 0, limitSeconds: AUDIO_ANALYSIS_LIMITS.seconds, receivedBytes: 0 });
    const bunny = await import('mediabunny');
    check();
    const source = makeSource(bunny, controller.signal, fail);
    input = new bunny.Input({ source: source.source, formats: [bunny.MP3, bunny.WAVE, bunny.FLAC, bunny.OGG, bunny.MP4, bunny.ADTS, bunny.MATROSKA] });
    const track = await input.getPrimaryAudioTrack();
    check();
    if (!track) throw new AudioAnalysisError('invalid-audio', 'This file does not contain an audio track.');
    const channels = await track.getNumberOfChannels(); check();
    const sampleRate = await track.getSampleRate(); check();
    const accumulator = new AmplitudeAccumulator(sampleRate, channels);
    const codec = await track.getCodec(); check();
    if (!codec || !await track.canDecode()) throw new AudioAnalysisError('unsupported', 'This browser cannot decode this audio format for analysis. Playback may still be available.');
    check();
    const duration = await track.getDurationFromMetadata(); check();
    const sink = new bunny.AudioSampleSink(track);
    let lastYield = performance.now();
    let lastProgress = -Infinity;
    let decodedUntil = 0;
    let sampleCount = 0;
    for await (const sample of sink.samples(0, AUDIO_ANALYSIS_LIMITS.seconds)) {
      try {
        check();
        if (++sampleCount > 100_000) throw new AudioAnalysisError('limit', 'This file contains too many audio samples for a short preview.');
        if (sample.sampleRate !== sampleRate || sample.numberOfChannels !== channels || !Number.isFinite(sample.timestamp) || !Number.isInteger(sample.numberOfFrames) || sample.numberOfFrames < 1) {
          throw new AudioAnalysisError('invalid-audio', 'The decoded audio has inconsistent sample data.');
        }
        if (sample.numberOfFrames > AUDIO_ANALYSIS_LIMITS.sampleFrames) throw new AudioAnalysisError('limit', 'An audio sample exceeds the analysis memory limit.');
        const firstFrame = Math.max(0, Math.ceil(-sample.timestamp * sampleRate));
        const lastFrame = Math.min(sample.numberOfFrames, Math.ceil((AUDIO_ANALYSIS_LIMITS.seconds - sample.timestamp) * sampleRate));
        for (let offset = firstFrame; offset < lastFrame; offset += AUDIO_ANALYSIS_LIMITS.copyFrames) {
          check();
          const frameCount = Math.min(AUDIO_ANALYSIS_LIMITS.copyFrames, lastFrame - offset);
          const pcm = new Float32Array(frameCount * channels);
          sample.copyTo(pcm, { format: 'f32', planeIndex: 0, frameOffset: offset, frameCount });
          accumulator.add(pcm, Math.max(0, sample.timestamp + offset / sampleRate));
          decodedUntil = Math.min(AUDIO_ANALYSIS_LIMITS.seconds, sample.timestamp + (offset + frameCount) / sampleRate);
          if (performance.now() - lastProgress >= 100) {
            options.onProgress?.({ phase: 'decoding', decodedSeconds: decodedUntil, limitSeconds: AUDIO_ANALYSIS_LIMITS.seconds, receivedBytes: source.bytes() });
            lastProgress = performance.now();
          }
          if (performance.now() - lastYield >= 8) {
            await new Promise<void>(resolve => setTimeout(resolve, 0));
            check();
            lastYield = performance.now();
          }
        }
      } finally { sample.close(); }
      // Also yield for samples trimmed entirely outside the preview window.
      if (performance.now() - lastYield >= 8) {
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        check();
        lastYield = performance.now();
      }
    }
    check();
    const result = accumulator.finish();
    options.onProgress?.({ phase: 'decoding', decodedSeconds: result.analyzedDurationSeconds, limitSeconds: AUDIO_ANALYSIS_LIMITS.seconds, receivedBytes: source.bytes() });
    return { ...result, trackId, source: 'mediabunny', codec, sampleRate, channels, previewLimitSeconds: AUDIO_ANALYSIS_LIMITS.seconds, truncated: duration !== null ? duration > AUDIO_ANALYSIS_LIMITS.seconds : decodedUntil >= AUDIO_ANALYSIS_LIMITS.seconds, receivedBytes: source.bytes() };
  };
  try { return await Promise.race([work(), aborted]); }
  catch (error) { throw controller.signal.aborted ? controller.signal.reason : normalizeError(error); }
  finally {
    clearTimeout(timer);
    options.signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', abort);
    dispose();
    active = false;
  }
}
