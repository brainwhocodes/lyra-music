<template>
  <div
    class="seek-timeline"
    :class="{ 'seek-compact': compact }"
    :data-waveform-state="waveform ? 'ready' : model?.state.value || 'idle'"
  >
    <div class="seek-surface" :class="{ 'has-waveform': waveform }">
      <svg
        v-if="waveform"
        aria-label="Track waveform"
        aria-hidden="true"
        viewBox="0 0 1000 64"
        preserveAspectRatio="none"
      >
        <defs>
          <clipPath :id="clipId">
            <rect x="0" y="0" :width="progress * 1000" height="64" />
          </clipPath>
        </defs>
        <g class="waveform-unplayed">
          <rect
            v-for="(bar, i) in bars"
            :key="i"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
          />
        </g>
        <g class="waveform-played" :clip-path="'url(#' + clipId + ')'">
          <rect
            v-for="(bar, i) in bars"
            :key="i"
            :x="bar.x"
            :y="bar.y"
            :width="bar.width"
            :height="bar.height"
          />
        </g>
      </svg>
      <div v-else class="seek-fallback" aria-hidden="true">
        <span :style="{ width: progress * 100 + '%' }" />
      </div>
      <input
        type="range"
        aria-label="Playback position"
        :aria-valuetext="timeText"
        min="0"
        :max="duration || 1"
        step="0.1"
        :value="displayTime"
        :disabled="!canSeek"
        @pointerdown="beginPointer"
        @pointerup="settlePointer"
        @pointercancel="cancelPointer"
        @keydown="beginKeyboard"
        @keyup="settleKeyboard"
        @blur="settleKeyboard"
        @input="preview"
        @change="commitPointer"
      />
    </div>
    <div class="seek-times" aria-hidden="true">
      <span>{{ formatTime(displayTime) }}</span
      ><span>{{ formatTime(duration) }}</span>
    </div>
    <p class="sr-only" role="status">
      {{
        waveform
          ? "Waveform ready"
          : model?.state.value === "loading"
            ? "Loading waveform"
            : "Waveform unavailable. Seeking is still available."
      }}
    </p>
  </div>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import { trackWaveformKey } from "~/composables/useTrackWaveform";
defineProps<{ compact?: boolean }>();
const player = usePlayerStore();
const model = inject(trackWaveformKey, null);
const clipId = "waveform-" + useId().replaceAll(":", "");
const draft = ref<number | null>(null);
const duration = computed(() =>
  Number.isFinite(player.duration) ? Math.max(0, player.duration) : 0,
);
const canSeek = computed(() => duration.value > 0);
const displayTime = computed(() =>
  Math.min(duration.value, Math.max(0, draft.value ?? player.currentTime)),
);
const progress = computed(() =>
  duration.value ? displayTime.value / duration.value : 0,
);
const waveform = computed(() => {
  const value = model?.result.value;
  // Never stretch a preview or mismatched original across the native timeline.
  return value &&
    value.trackId === player.currentTrack?.trackId &&
    duration.value > 0 &&
    Math.abs(value.durationSeconds - duration.value) <=
      Math.max(0.25, duration.value * 0.005)
    ? value
    : null;
});
const bars = computed(
  () =>
    waveform.value?.bins.flatMap((bin) => {
      const start = Math.max(0, bin.startSeconds);
      const end = Math.min(duration.value, bin.endSeconds);
      if (end <= start) return [];
      const height = waveform.value!.peak
        ? Math.max(1, (bin.peak / waveform.value!.peak) * 56)
        : 1;
      const x = (start / duration.value) * 1000;
      const width = ((end - start) / duration.value) * 1000;
      return [
        {
          x,
          y: (64 - height) / 2,
          width: Math.min(width, Math.max(0.5, width - 1)),
          height,
        },
      ];
    }) || [],
);
function formatTime(seconds: number) {
  const value = Math.floor(Math.max(0, seconds));
  return Math.floor(value / 60) + ":" + String(value % 60).padStart(2, "0");
}
const timeText = computed(
  () => formatTime(displayTime.value) + " of " + formatTime(duration.value),
);
let pointer = false;
let owner: number | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
function beginPointer() {
  clearTimeout(timer);
  pointer = true;
  owner = player.playbackRevision;
}
function beginKeyboard() {
  if (!pointer && owner === null) owner = player.playbackRevision;
}
function valid() {
  return canSeek.value && (owner === null || owner === player.playbackRevision);
}
function preview(event: Event) {
  if (!valid()) return;
  const value = (event.target as HTMLInputElement).valueAsNumber;
  if (!Number.isFinite(value)) return;
  if (pointer) draft.value = value;
  else player.seek(value);
}
function commitPointer(event: Event) {
  if (pointer && valid())
    player.seek((event.target as HTMLInputElement).valueAsNumber);
  draft.value = null;
}
function settlePointer() {
  timer = setTimeout(() => {
    pointer = false;
    owner = null;
    draft.value = null;
  }, 0);
}
function cancelPointer() {
  draft.value = null;
  owner = -1;
  settlePointer();
}
function settleKeyboard() {
  if (!pointer) owner = null;
}
watch(
  () => player.playbackRevision,
  () => {
    draft.value = null;
  },
  { flush: "sync" },
);
onBeforeUnmount(() => clearTimeout(timer));
</script>
<style scoped>
.seek-timeline {
  width: 100%;
  min-width: 0;
}
.seek-surface {
  position: relative;
  height: 72px;
  isolation: isolate;
}
.seek-surface svg {
  position: absolute;
  inset: 4px 9px;
  width: calc(100% - 18px);
  height: 64px;
  overflow: hidden;
}
.waveform-unplayed {
  fill: #7d8796;
}
.waveform-played {
  fill: var(--blue);
}
.seek-fallback {
  position: absolute;
  left: 9px;
  right: 9px;
  top: 34px;
  height: 4px;
  background: #7d8796;
}
.seek-fallback span {
  display: block;
  height: 100%;
  background: var(--blue);
}
.seek-surface input {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  appearance: none;
  background: transparent;
  cursor: pointer;
  border: 0;
  border-radius: 2px;
  color: var(--blue);
}
.seek-surface input::-webkit-slider-runnable-track {
  height: 64px;
  background: transparent;
}
.seek-surface input::-moz-range-track {
  height: 64px;
  background: transparent;
}
.seek-surface input::-webkit-slider-thumb {
  appearance: none;
  width: 18px;
  height: 18px;
  margin-top: 23px;
  border: 3px solid var(--blue);
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--paper);
}
.seek-surface input::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: 3px solid var(--blue);
  background: white;
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--paper);
}
.seek-surface input:focus-visible {
  outline: 3px solid var(--blue);
  outline-offset: 3px;
}
.seek-surface input:disabled {
  cursor: default;
  opacity: 0.45;
}
.seek-times {
  margin-top: 0.5rem;
  display: flex;
  justify-content: space-between;
  gap: 1rem;
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
  color: var(--muted);
}
.seek-compact .seek-surface {
  height: 44px;
}
.seek-compact .seek-surface svg {
  inset-block: 2px;
  height: 40px;
}
.seek-compact .seek-fallback {
  top: 20px;
}
</style>
