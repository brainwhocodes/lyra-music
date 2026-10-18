<template>
  <div class="playback-controls" :class="{ 'playback-compact': compact }">
    <WaveformSeek :compact="compact" />
    <div class="transport-controls">
      <button
        type="button"
        class="btn btn-ghost control-icon"
        aria-label="Shuffle"
        title="Shuffle"
        :aria-pressed="player.isShuffled"
        @click="player.toggleShuffle"
      >
        <Icon
          name="material-symbols:shuffle-rounded"
          size="22"
          class="w-5 h-5"
        />
      </button>
      <button
        type="button"
        class="btn btn-ghost control-icon"
        aria-label="Previous track"
        title="Previous track"
        @click="player.playPrevious"
        :disabled="!player.canPlayPrevious || player.isLoading"
      >
        <Icon
          name="material-symbols:skip-previous-rounded"
          size="28"
          class="w-7 h-7"
        />
      </button>
      <button
        type="button"
        class="btn btn-primary main-play"
        :aria-label="player.isPlaying ? 'Pause playback' : 'Play playback'"
        @click="player.togglePlayPause"
        :disabled="player.isLoading && !player.isPlaying"
      >
        <span
          v-if="player.isLoading && !player.isPlaying"
          class="loading loading-spinner"
        />
        <Icon
          v-else
          :name="
            player.isPlaying
              ? 'material-symbols:pause-rounded'
              : 'material-symbols:play-arrow-rounded'
          "
          size="32"
          class="w-8 h-8"
        />
      </button>
      <button
        type="button"
        class="btn btn-ghost control-icon"
        aria-label="Next track"
        title="Next track"
        @click="player.playNext()"
        :disabled="!player.canPlayNext || player.isLoading"
      >
        <Icon
          name="material-symbols:skip-next-rounded"
          size="28"
          class="w-7 h-7"
        />
      </button>
      <button
        type="button"
        class="btn btn-ghost control-icon"
        :aria-label="`Repeat mode: ${player.repeatMode}`"
        :title="`Repeat mode: ${player.repeatMode}`"
        :aria-pressed="player.repeatMode !== 'none'"
        @click="player.toggleRepeatMode"
      >
        <Icon
          :name="
            player.repeatMode === 'one'
              ? 'material-symbols:repeat-one-rounded'
              : 'material-symbols:repeat-rounded'
          "
          size="22"
          class="w-5 h-5"
        />
      </button>
    </div>
  </div>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import WaveformSeek from "./waveform-seek.vue";
defineProps<{ compact?: boolean }>();
const player = usePlayerStore();
</script>
<style scoped>
.playback-controls {
  display: grid;
  gap: 1.5rem;
  width: 100%;
  min-width: 0;
}
.transport-controls {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: clamp(0.25rem, 2vw, 1.25rem);
}
.main-play {
  border-radius: 50%;
  width: 64px;
  height: 64px;
  min-height: 64px;
  min-width: 64px;
  padding: 0;
}
.transport-controls [aria-pressed="true"] {
  color: var(--blue);
  background: #e2e6fc;
  border-color: var(--blue);
}
.playback-compact {
  gap: 0;
}
.playback-compact .transport-controls {
  order: -1;
  gap: 0.5rem;
}
.playback-compact .main-play {
  min-width: 44px;
  width: 44px;
  height: 44px;
  min-height: 44px;
}
@media (max-width: 360px) {
  .transport-controls {
    gap: 0;
  }
  .main-play {
    width: 56px;
    height: 56px;
    min-height: 56px;
    min-width: 56px;
  }
}
</style>
