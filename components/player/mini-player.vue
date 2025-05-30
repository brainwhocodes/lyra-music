<template>
  <div
    v-if="playerStore.currentTrack"
    class="fixed bottom-0 left-0 right-0 bg-base-200 text-base-content p-3 shadow-lg z-50 cursor-pointer hover:bg-base-300 transition-colors"
    @click="handleMiniPlayerClick"
  >
    <div class="flex items-center gap-3">
      <!-- Album Cover -->
      <div class="flex-shrink-0 w-12 h-12 rounded overflow-hidden bg-base-100">
        <img
          v-if="playerStore.currentTrack.coverPath"
          :src="resolveCoverArtUrl(playerStore.currentTrack.coverPath)"
          :alt="`${playerStore.currentTrack.title} cover`"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full flex items-center justify-center bg-base-100">
          <Icon name="material-symbols:music-note" class="w-6 h-6 text-base-content/50" />
        </div>
      </div>

      <!-- Track Info -->
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate text-sm" :title="playerStore.currentTrack.title">
          {{ playerStore.currentTrack.title || 'Unknown Track' }}
        </div>
        <div class="text-xs text-base-content/70 truncate" :title="playerStore.currentTrack.artistName || ''">
          {{ playerStore.currentTrack.artistName || 'Unknown Artist' }}
        </div>
      </div>

      <!-- Play/Pause Button -->
      <button
        class="btn btn-ghost btn-circle btn-sm"
        @click.stop="playerStore.togglePlayPause()"
        :disabled="playerStore.isLoading || !playerStore.currentTrack.url"
        title="Play/Pause"
      >
        <Icon
          v-if="playerStore.isLoading"
          name="svg-spinners:180-ring-with-bg"
          class="w-5 h-5"
        />
        <Icon
          v-else-if="playerStore.isPlaying"
          name="material-symbols:pause-rounded"
          class="w-5 h-5"
        />
        <Icon
          v-else
          name="material-symbols:play-arrow-rounded"
          class="w-5 h-5"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';

const playerStore = usePlayerStore();

// Assuming resolveCoverArtUrl is globally available or will be made so.
// If not, it needs to be imported or defined here.
// For TypeScript to not complain, we can declare it if we are sure it will be available globally.
// Otherwise, a more robust solution is to import it from its definition source.
declare function resolveCoverArtUrl(path: string | undefined): string;

const handleMiniPlayerClick = (): void => {
  playerStore.toggleFullScreenPlayer();
};
</script>

<style scoped>
/* Add any specific styles if needed */
</style>
