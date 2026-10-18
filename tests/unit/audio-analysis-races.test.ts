import { afterEach, describe, expect, it, vi } from 'vitest';
import { effectScope, ref } from 'vue';
import { useAudioAnalysis } from '../../composables/useAudioAnalysis';
import { AudioAnalysisError, type AudioAnalysis, type AudioAnalysisOptions } from '../../utils/audio/track-analysis';

const scopes: ReturnType<typeof effectScope>[] = [];
afterEach(() => scopes.splice(0).forEach(scope => scope.stop()));
const decoded = (trackId: string): AudioAnalysis => ({ trackId, source: 'mediabunny', codec: 'mp3', sampleRate: 44100, channels: 2, analyzedDurationSeconds: 1, previewLimitSeconds: 30, truncated: false, bins: [{ startSeconds: 0, endSeconds: .25, peak: .25, rms: .125 }], peak: .25, rms: .125, decodedFrames: 44100, receivedBytes: 8000 });
const progress = (seconds: number) => ({ phase: 'decoding' as const, decodedSeconds: seconds, limitSeconds: 30, receivedBytes: 1024 });

function setup() {
  // This deliberately hostile decoder can resolve/reject/report progress after
  // abort, proving UI request ownership independently of cooperative cancellation.
  const pending: { id: string; options: AudioAnalysisOptions; resolve: (value: AudioAnalysis) => void; reject: (error: unknown) => void }[] = [];
  const decode = vi.fn((id: string, options: AudioAnalysisOptions = {}) => new Promise<AudioAnalysis>((resolve, reject) => pending.push({ id, options, resolve, reject })));
  const track = ref<string | null>('a');
  const scope = effectScope(); scopes.push(scope);
  const analysis = scope.run(() => useAudioAnalysis(track, decode))!;
  return { track, scope, decode, pending, analysis };
}

describe('audio analysis UI request ownership', () => {
  it('starts only on explicit request and suppresses duplicate clicks while running', async () => {
    const context = setup();
    expect(context.decode).not.toHaveBeenCalled();
    const request = context.analysis.start();
    await context.analysis.start();
    expect(context.decode).toHaveBeenCalledOnce();
    context.pending[0]!.resolve(decoded('a')); await request;
    expect(context.analysis.state.value).toBe('complete');
    expect(context.analysis.result.value?.trackId).toBe('a');
    context.track.value = null;
    await context.analysis.start();
    expect(context.analysis.result.value).toBeNull();
    expect(context.decode).toHaveBeenCalledOnce();
  });

  it.each(['success', 'error'] as const)('ignores old %s and progress after track replacement without clearing the new request', async outcome => {
    const context = setup();
    const first = context.analysis.start();
    context.pending[0]!.options.onProgress!(progress(2));
    context.track.value = 'b';
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    expect(context.analysis.progress.value).toBeNull();
    const second = context.analysis.start();
    context.pending[1]!.options.onProgress!(progress(3));
    context.pending[0]!.options.onProgress!(progress(25));
    if (outcome === 'success') context.pending[0]!.resolve(decoded('a'));
    else context.pending[0]!.reject(new AudioAnalysisError('invalid-audio', 'Obsolete failure'));
    await first;
    expect(context.analysis.state.value).toBe('running');
    expect(context.analysis.progress.value?.decodedSeconds).toBe(3);
    expect(context.analysis.error.value).toBe('');
    expect(context.analysis.result.value).toBeNull();
    context.pending[1]!.resolve(decoded('b')); await second;
    expect(context.analysis.result.value?.trackId).toBe('b');
    expect(context.analysis.progress.value).toBeNull();
  });

  it.each(['success', 'error'] as const)('preserves cancellation despite late %s and progress, and permits same-track retry', async outcome => {
    const context = setup();
    const first = context.analysis.start();
    context.analysis.cancel();
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    context.pending[0]!.options.onProgress!(progress(20));
    if (outcome === 'success') context.pending[0]!.resolve(decoded('a'));
    else context.pending[0]!.reject(new Error('Late codec failure'));
    await first;
    expect(context.analysis.state.value).toBe('cancelled');
    expect(context.analysis.result.value).toBeNull();
    expect(context.analysis.error.value).toBe('');
    expect(context.analysis.progress.value).toBeNull();
    const retry = context.analysis.start();
    context.pending[1]!.resolve(decoded('a')); await retry;
    expect(context.analysis.state.value).toBe('complete');
    expect(context.analysis.result.value?.trackId).toBe('a');
  });

  it.each(['success', 'error'] as const)('ignores %s and progress after disposal and refuses further work', async outcome => {
    const context = setup();
    const request = context.analysis.start();
    context.scope.stop();
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    context.pending[0]!.options.onProgress!(progress(10));
    if (outcome === 'success') context.pending[0]!.resolve(decoded('a'));
    else context.pending[0]!.reject(new Error('Late failure'));
    await request;
    await context.analysis.start();
    expect(context.decode).toHaveBeenCalledOnce();
    expect(context.analysis.state.value).toBe('idle');
    expect(context.analysis.progress.value).toBeNull();
    expect(context.analysis.error.value).toBe('');
    expect(context.analysis.result.value).toBeNull();
  });

  it('shows the current codec error and clears it on a successful retry', async () => {
    const context = setup();
    const first = context.analysis.start();
    context.pending[0]!.reject(new AudioAnalysisError('unsupported', 'This browser cannot decode this format.'));
    await first;
    expect(context.analysis.state.value).toBe('error');
    expect(context.analysis.error.value).toBe('This browser cannot decode this format.');
    const retry = context.analysis.start();
    expect(context.analysis.error.value).toBe('');
    context.pending[1]!.resolve(decoded('a')); await retry;
    expect(context.analysis.state.value).toBe('complete');
  });
});
