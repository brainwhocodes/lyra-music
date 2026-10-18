import {
  computed,
  onScopeDispose,
  ref,
  shallowRef,
  watch,
  type Ref,
} from "vue";
import {
  analyzeTrackAudio,
  AudioAnalysisError,
  type AudioAnalysis,
  type AudioAnalysisProgress,
} from "../utils/audio/track-analysis";

/** Results belong to one explicit request and one track, never to the player queue. */
export function useAudioAnalysis(
  trackId: Ref<string | null>,
  decode = analyzeTrackAudio,
) {
  const result = shallowRef<AudioAnalysis | null>(null);
  const progress = shallowRef<AudioAnalysisProgress | null>(null);
  const state = ref<"idle" | "running" | "complete" | "error" | "cancelled">(
    "idle",
  );
  const error = ref("");
  let controller: AbortController | undefined;
  let generation = 0;
  let disposed = false;
  function cancel() {
    generation++;
    controller?.abort();
    controller = undefined;
    if (state.value === "running") state.value = "cancelled";
    progress.value = null;
  }
  function reset() {
    cancel();
    result.value = null;
    error.value = "";
    state.value = "idle";
  }
  async function start() {
    if (disposed || !trackId.value || state.value === "running") return;
    reset();
    const id = trackId.value;
    const request = new AbortController();
    controller = request;
    const current = ++generation;
    const ownsResult = () =>
      !disposed &&
      current === generation &&
      !request.signal.aborted &&
      id === trackId.value;
    state.value = "running";
    try {
      const decoded = await decode(id, {
        signal: request.signal,
        onProgress(value) {
          if (ownsResult()) progress.value = value;
        },
      });
      if (!ownsResult()) return;
      result.value = decoded;
      state.value = "complete";
    } catch (cause) {
      if (!ownsResult()) return;
      if (cause instanceof AudioAnalysisError && cause.code === "cancelled")
        state.value = "cancelled";
      else {
        error.value =
          cause instanceof AudioAnalysisError
            ? cause.message
            : "Could not analyze this track. Please try again.";
        state.value = "error";
      }
    } finally {
      if (current === generation) {
        controller = undefined;
        progress.value = null;
      }
    }
  }
  watch(trackId, reset, { flush: "sync" });
  onScopeDispose(() => {
    disposed = true;
    reset();
  });
  return {
    result,
    progress,
    state,
    error,
    running: computed(() => state.value === "running"),
    start,
    cancel,
  };
}
