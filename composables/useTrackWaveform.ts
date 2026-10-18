import {
  onMounted,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type InjectionKey,
  type Ref,
} from "vue";
import {
  decodeTrackWaveform,
  type TrackWaveform,
} from "../utils/audio/track-waveform";

/** One owner per player layout; compact and full-screen controls share its work. */
export function useTrackWaveform(
  trackId: Ref<string | null>,
  eligible: Ref<boolean>,
  decode = decodeTrackWaveform,
) {
  const result = shallowRef<TrackWaveform | null>(null);
  const state = ref<"idle" | "loading" | "ready" | "unavailable">("idle");
  const cache = new Map<string, TrackWaveform>();
  let request: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  let stop: (() => void) | undefined;
  function cancel() {
    generation++;
    request?.abort();
    request = undefined;
  }
  async function load() {
    cancel();
    result.value = null;
    state.value = "idle";
    const id = trackId.value;
    if (!id || !eligible.value || disposed) return;
    const cached = cache.get(id);
    if (cached) {
      cache.delete(id);
      cache.set(id, cached);
      result.value = cached;
      state.value = "ready";
      return;
    }
    const owner = generation;
    const controller = new AbortController();
    request = controller;
    const current = () =>
      !disposed &&
      owner === generation &&
      !controller.signal.aborted &&
      trackId.value === id &&
      eligible.value;
    state.value = "loading";
    try {
      // Let an aborted decoder release its resources before its replacement starts.
      await Promise.resolve();
      if (!current()) return;
      const waveform = await decode(id, { signal: controller.signal });
      if (!current()) return;
      cache.set(id, waveform);
      if (cache.size > 8) cache.delete(cache.keys().next().value!);
      result.value = waveform;
      state.value = "ready";
    } catch {
      if (current()) state.value = "unavailable";
    } finally {
      if (owner === generation) request = undefined;
    }
  }
  onMounted(() => {
    stop = watch([trackId, eligible], load, { immediate: true, flush: "sync" });
  });
  onScopeDispose(() => {
    disposed = true;
    stop?.();
    cancel();
    cache.clear();
  });
  return { result, state };
}
export type TrackWaveformModel = ReturnType<typeof useTrackWaveform>;
export const trackWaveformKey: InjectionKey<TrackWaveformModel> =
  Symbol("track-waveform");
