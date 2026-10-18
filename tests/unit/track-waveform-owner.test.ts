import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRenderer, defineComponent, nextTick, ref } from 'vue';
import { useTrackWaveform } from '../../composables/useTrackWaveform';
import type { TrackWaveform, TrackWaveformOptions } from '../../utils/audio/track-waveform';

type Node = { children: Node[]; parent: Node | null; text: string };
const node = (text = ''): Node => ({ children: [], parent: null, text });
// A minimal Vue host exercises real mounted/disposal hooks without a browser or
// mocked lifecycle. The owner has no DOM behavior; its consumer tests cover that.
const renderer = createRenderer<Node, Node>({
  createElement: () => node(), createText: node, createComment: node,
  setText: (element, text) => { element.text = text; },
  setElementText: (element, text) => { element.text = text; },
  parentNode: element => element.parent,
  nextSibling: () => null,
  insert(element, parent) { parent.children.push(element); element.parent = parent; },
  remove(element) { if (element.parent) element.parent.children = element.parent.children.filter(child => child !== element); },
  patchProp() {},
});
const dispose: (() => void)[] = [];
afterEach(() => { dispose.splice(0).forEach(stop => stop()); });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); await nextTick(); };
const waveform = (trackId: string): TrackWaveform => ({ trackId, complete: true, source: 'mediabunny', durationSeconds: 12, bins: [{ startSeconds: 0, endSeconds: 12, peak: .5, rms: .25 }], codec: 'mp3', sampleRate: 44100, channels: 2, decodedFrames: 529200, receivedBytes: 12000, peak: .5, rms: .25 });

function setup(id: string | null = 'a', allowed = true) {
  const trackId = ref(id), eligible = ref(allowed);
  const pending: { id: string; options: TrackWaveformOptions; resolve: (value: TrackWaveform) => void; reject: (error: unknown) => void }[] = [];
  // Intentionally ignores abort, so stale-result protection cannot rely on a
  // cooperative decoder to make these assertions pass.
  const decode = vi.fn((id: string, options: TrackWaveformOptions = {}) => new Promise<TrackWaveform>((resolve, reject) => pending.push({ id, options, resolve, reject })));
  let model!: ReturnType<typeof useTrackWaveform>;
  const app = renderer.createApp(defineComponent({ setup() { model = useTrackWaveform(trackId, eligible, decode); return () => null; } }));
  app.mount(node());
  const unmount = vi.fn(() => app.unmount()); dispose.push(unmount);
  return { model, trackId, eligible, decode, pending, unmount };
}

describe('shared current-track waveform owner', () => {
  it('coalesces immediate track changes and starts only the final eligible identity', async () => {
    const context = setup();
    expect(context.decode).not.toHaveBeenCalled();
    context.trackId.value = 'b'; context.trackId.value = 'c';
    await flush();
    expect(context.pending.map(request => request.id)).toEqual(['c']);
    context.pending[0]!.resolve(waveform('c')); await flush();
    expect(context.model.state.value).toBe('ready');
    expect(context.model.result.value?.trackId).toBe('c');
    context.trackId.value = 'c'; await flush();
    expect(context.decode).toHaveBeenCalledOnce();
  });

  it.each(['resolve', 'reject'] as const)('ignores a stale %s without cancelling or caching over its replacement', async outcome => {
    const context = setup(); await flush();
    context.trackId.value = 'b';
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    expect(context.model.result.value).toBeNull();
    await flush();
    if (outcome === 'resolve') context.pending[0]!.resolve(waveform('a'));
    else context.pending[0]!.reject(new Error('Stale codec failure'));
    await flush();
    expect(context.model.state.value).toBe('loading');
    expect(context.pending[1]!.options.signal!.aborted).toBe(false);
    expect(context.model.result.value).toBeNull();
    context.pending[1]!.resolve(waveform('b')); await flush();
    expect(context.model.result.value?.trackId).toBe('b');
    context.trackId.value = 'a'; await flush();
    expect(context.pending.map(request => request.id)).toEqual(['a', 'b', 'a']);
    context.pending[2]!.resolve(waveform('a')); await flush();
    expect(context.model.result.value?.trackId).toBe('a');
  });

  it('aborts eligibility loss and queue clearing, and never decodes an external or empty identity', async () => {
    const context = setup('a', false); await flush();
    expect(context.model.state.value).toBe('idle');
    expect(context.decode).not.toHaveBeenCalled();
    context.eligible.value = true; await flush();
    context.eligible.value = false;
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    context.pending[0]!.resolve(waveform('a')); await flush();
    expect(context.model.state.value).toBe('idle');
    expect(context.model.result.value).toBeNull();
    context.eligible.value = true; await flush();
    context.trackId.value = null;
    expect(context.pending[1]!.options.signal!.aborted).toBe(true);
    context.pending[1]!.resolve(waveform('a')); await flush();
    expect(context.model.state.value).toBe('idle');
    expect(context.model.result.value).toBeNull();
    expect(context.decode).toHaveBeenCalledTimes(2);
  });

  it.each(['resolve', 'reject'] as const)('disposal aborts pending work and ignores a late %s or later track changes', async outcome => {
    const context = setup(); await flush();
    context.unmount();
    expect(context.pending[0]!.options.signal!.aborted).toBe(true);
    const disposedState = context.model.state.value;
    if (outcome === 'resolve') context.pending[0]!.resolve(waveform('a'));
    else context.pending[0]!.reject(new Error('Disposed codec failure'));
    context.trackId.value = 'b'; await flush();
    expect(context.decode).toHaveBeenCalledOnce();
    expect(context.model.result.value).toBeNull();
    expect(context.model.state.value).toBe(disposedState);
    dispose.splice(dispose.indexOf(context.unmount), 1);
  });

  it('does not poison the cache with failures and retries on selecting that track again', async () => {
    const context = setup(); await flush();
    context.pending[0]!.reject(new Error('Malformed audio')); await flush();
    expect(context.model.state.value).toBe('unavailable');
    context.trackId.value = 'b'; await flush();
    context.pending[1]!.resolve(waveform('b')); await flush();
    context.trackId.value = 'a'; await flush();
    expect(context.pending.map(request => request.id)).toEqual(['a', 'b', 'a']);
    context.pending[2]!.resolve(waveform('a')); await flush();
    expect(context.model.state.value).toBe('ready');
    expect(context.model.result.value?.trackId).toBe('a');
  });

  it('shares successful results and evicts the least recently used entry after eight tracks', async () => {
    const context = setup(null);
    const complete = async (id: string) => {
      context.trackId.value = id; await flush();
      const request = context.pending.at(-1)!;
      expect(request.id).toBe(id);
      request.resolve(waveform(id)); await flush();
    };
    for (const id of 'abcdefgh') await complete(id);
    const before = context.decode.mock.calls.length;
    context.trackId.value = 'a'; await flush();
    expect(context.decode).toHaveBeenCalledTimes(before);
    expect(context.model.result.value?.trackId).toBe('a');
    await complete('i'); // a was touched; b, not a, must be evicted.
    context.trackId.value = 'a'; await flush();
    expect(context.decode).toHaveBeenCalledTimes(before + 1);
    context.trackId.value = 'b'; await flush();
    expect(context.pending.at(-1)!.id).toBe('b');
    expect(context.decode).toHaveBeenCalledTimes(before + 2);
    context.pending.at(-1)!.resolve(waveform('b')); await flush();
    expect(context.model.result.value?.trackId).toBe('b');
  });
});
