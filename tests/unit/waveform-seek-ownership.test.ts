import { readFileSync } from 'node:fs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { computed, effectScope, reactive, ref, watch } from 'vue';
import { parse } from 'vue/compiler-sfc';
import ts from 'typescript';
import type { TrackWaveform } from '../../utils/audio/track-waveform';

// Execute the actual SFC script; this tests handler ownership, not browser event
// order or pointer capture. Playwright exercises native range input separately.
const source = readFileSync(new URL('../../components/player/waveform-seek.vue', import.meta.url), 'utf8');
const script = parse(source).descriptor.scriptSetup!.content;
const compiled = ts.transpileModule(script, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText.replace(/^import .*;\r?$/gm, '');
const createHandlers = new Function('usePlayerStore', 'trackWaveformKey', 'defineProps', 'inject', 'useId', 'ref', 'computed', 'watch', 'onBeforeUnmount', compiled + '\nreturn { beginPointer, beginKeyboard, preview, commitPointer, settlePointer, cancelPointer, settleKeyboard, draft, waveform, bars };');
const dispose: (() => void)[] = [];
afterEach(() => { dispose.splice(0).forEach(stop => stop()); vi.useRealTimers(); });
const input = (value: number) => ({ target: { valueAsNumber: value } } as unknown as Event);

function setup(value?: TrackWaveform) {
  vi.useFakeTimers();
  const player = reactive({ playbackRevision: 1, duration: 12, currentTime: 3, currentTrack: { trackId: 'a' }, seek: vi.fn() });
  const scope = effectScope();
  const cleanup: (() => void)[] = [];
  const model = { result: ref(value ?? null), state: ref('ready') };
  const handlers = scope.run(() => createHandlers(() => player, Symbol('waveform'), () => {}, () => model, () => 'test', ref, computed, watch, (stop: () => void) => cleanup.push(stop)))!;
  dispose.push(() => { cleanup.forEach(stop => stop()); scope.stop(); });
  return { player, handlers };
}

describe('waveform native range handler ownership', () => {
  it('previews a pointer gesture locally and commits it without invoking playback actions', () => {
    const { player, handlers } = setup();
    handlers.beginPointer(); handlers.preview(input(7));
    expect(handlers.draft.value).toBe(7);
    expect(player.currentTime).toBe(3);
    expect(player.seek).not.toHaveBeenCalled();
    handlers.commitPointer(input(7)); handlers.settlePointer();
    expect(player.seek).toHaveBeenCalledExactlyOnceWith(7);
    vi.runAllTimers();
    expect(handlers.draft.value).toBeNull();
  });

  it('rejects the end of a pointer gesture after a same-track media reload', () => {
    const { player, handlers } = setup();
    handlers.beginPointer(); handlers.preview(input(7));
    player.playbackRevision++;
    expect(handlers.draft.value).toBeNull();
    handlers.preview(input(8)); handlers.commitPointer(input(8)); handlers.settlePointer();
    vi.runAllTimers();
    expect(player.seek).not.toHaveBeenCalled();
    handlers.beginPointer(); handlers.preview(input(4)); handlers.commitPointer(input(4));
    expect(player.seek).toHaveBeenCalledExactlyOnceWith(4);
  });

  it('cancels a pointer gesture without committing and permits a fresh keyboard gesture', () => {
    const { player, handlers } = setup();
    handlers.beginPointer(); handlers.preview(input(7)); handlers.cancelPointer(); handlers.commitPointer(input(7));
    expect(player.seek).not.toHaveBeenCalled();
    vi.runAllTimers();
    handlers.beginKeyboard({ key: 'ArrowRight', repeat: false }); handlers.preview(input(3.1)); handlers.settleKeyboard();
    expect(player.seek).toHaveBeenCalledExactlyOnceWith(3.1);
  });

  it('does not transfer a held keyboard gesture to replacement media on key repeat', () => {
    const { player, handlers } = setup();
    handlers.beginKeyboard({ key: 'ArrowRight', repeat: false }); handlers.preview(input(3.1));
    expect(player.seek).toHaveBeenCalledExactlyOnceWith(3.1);
    player.playbackRevision++;
    handlers.beginKeyboard({ key: 'ArrowRight', repeat: true }); handlers.preview(input(3.2));
    expect(player.seek).toHaveBeenCalledTimes(1);
    handlers.settleKeyboard();
    handlers.beginKeyboard({ key: 'ArrowRight', repeat: false }); handlers.preview(input(1));
    expect(player.seek).toHaveBeenLastCalledWith(1);
  });

  it('supports assistive-technology input with no preceding pointer or keyboard event', () => {
    const { player, handlers } = setup();
    handlers.preview(input(4));
    expect(player.seek).toHaveBeenCalledExactlyOnceWith(4);
    handlers.preview(input(NaN));
    expect(player.seek).toHaveBeenCalledTimes(1);
  });

  it('does not let an earlier pointer-up timer clear the next gesture ownership', () => {
    const { player, handlers } = setup();
    handlers.beginPointer(); handlers.settlePointer();
    handlers.beginPointer(); handlers.preview(input(6));
    vi.runAllTimers();
    player.playbackRevision++;
    handlers.commitPointer(input(6));
    expect(player.seek).not.toHaveBeenCalled();
  });
});

const decoded = (durationSeconds: number, bins: TrackWaveform['bins']): TrackWaveform => ({
  trackId: 'a', complete: true, source: 'mediabunny', durationSeconds, bins,
  codec: 'mp3', sampleRate: 44100, channels: 2, decodedFrames: 531072,
  receivedBytes: 12000, peak: .5, rms: .25,
});

describe('waveform geometry against the native playback timeline', () => {
  it('omits MP3 padding beyond the native duration instead of drawing an out-of-bounds tail', () => {
    const { handlers } = setup(decoded(12.0424, [
      { startSeconds: 0, endSeconds: 11.9375, peak: .5, rms: .25 },
      { startSeconds: 11.9375, endSeconds: 12, peak: .2, rms: .1 },
      { startSeconds: 12, endSeconds: 12.0424, peak: .1, rms: .05 },
    ]));
    expect(handlers.waveform.value).not.toBeNull();
    const bars = handlers.bars.value;
    expect(bars).toHaveLength(2);
    expect(bars.every((bar: { x: number; width: number }) => bar.x >= 0 && bar.width > 0 && bar.x + bar.width <= 1000)).toBe(true);
  });

  it('clips tiny partial endpoint bins without enlarging them past their actual intervals', () => {
    const { handlers } = setup(decoded(12.0424, [
      { startSeconds: -.001, endSeconds: .001, peak: .5, rms: .25 },
      { startSeconds: 11.999, endSeconds: 12.000125, peak: .2, rms: .1 },
    ]));
    const bars = handlers.bars.value;
    expect(bars).toHaveLength(2);
    expect(bars[0].x).toBe(0);
    for (const bar of bars) {
      expect(bar.width).toBeGreaterThan(0);
      expect(bar.width).toBeLessThan(.5);
      expect(bar.width).toBeCloseTo(.001 / 12 * 1000, 10);
      expect(bar.x + bar.width).toBeLessThanOrEqual(1000);
    }
    expect(bars[1].x + bars[1].width).toBeCloseTo(1000, 10);
  });

  it('keeps the ordinary seek fallback for material duration disagreement or missing native duration', () => {
    const { player, handlers } = setup(decoded(8, [{ startSeconds: 0, endSeconds: 8, peak: .5, rms: .25 }]));
    expect(handlers.waveform.value).toBeNull();
    expect(handlers.bars.value).toEqual([]);
    player.duration = 8;
    expect(handlers.waveform.value).not.toBeNull();
    player.duration = Infinity;
    expect(handlers.waveform.value).toBeNull();
    expect(handlers.bars.value).toEqual([]);
  });
});
