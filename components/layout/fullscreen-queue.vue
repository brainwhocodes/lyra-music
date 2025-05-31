<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track'; // Ensure this path is correct for your global Track type
import { resolveCoverArtUrl, formatDuration } from '~/utils/formatters'; // Ensure formatDuration is exported from here

const playerStore = usePlayerStore();

const queue = computed(() => playerStore.queue);
const currentTrack = computed(() => playerStore.currentTrack);

const playTrackFromQueue = (index: number): void => {
  playerStore.playFromQueue(index);
  // Optional: playerStore.hideFullScreenQueue(); // Uncomment to close queue after selection
};

const closeQueueView = (): void => {
  playerStore.hideFullScreenQueue();
};

// Creates a more unique key if trackIds can be duplicated in a queue
const getTrackKey = (track: Track, index: number): string => {
  return `${track.trackId}-${index}`;
};
</script>

<template>
  <div
    v-if="playerStore.isFullScreenQueueVisible"
    class="fixed inset-0 bg-base-300/95 backdrop-blur-md z-[100] flex flex-col p-4 pt-safe-top text-base-content overscroll-contain"
  >
    <!-- Header -->
    <div class="flex items-center justify-between mb-4 flex-shrink-0">
      <h2 class="text-xl font-semibold">Up Next</h2>
      <button @click="closeQueueView" class="btn btn-ghost btn-sm btn-circle">
        <Icon name="material-symbols:close-rounded" class="w-7 h-7" />
      </button>
    </div>

    <!-- Queue List -->
    <div class="flex-grow overflow-y-auto" v-if="queue.length > 0">
      <ul class="space-y-1">
        <li
          v-for="(track, index) in queue"
          :key="getTrackKey(track, index)"
          @click="playTrackFromQueue(index)"
          class="p-2.5 rounded-lg flex items-center gap-3 cursor-pointer hover:bg-base-content/10 active:bg-base-content/20 transition-colors"
          :class="{
            'bg-primary/30 hover:bg-primary/40 text-primary-content font-semibold': track.trackId === currentTrack?.trackId && playerStore.currentQueueIndex === index,
            'opacity-60': track.trackId !== currentTrack?.trackId && playerStore.currentQueueIndex !== undefined && index < playerStore.currentQueueIndex,
          }"
        >
          <img
            :src="resolveCoverArtUrl(track.coverPath, 'thumbnail')"
            alt="Track cover"
            class="w-11 h-11 rounded object-cover flex-shrink-0"
            :class="{ 'ring-2 ring-primary ring-offset-2 ring-offset-base-300': track.trackId === currentTrack?.trackId && playerStore.currentQueueIndex === index }"
          />
          <div class="flex-grow min-w-0">
            <p
              class="truncate text-sm"
              :class="{ 'text-primary-focus dark:text-primary-content': track.trackId === currentTrack?.trackId && playerStore.currentQueueIndex === index }"
            >
              {{ track.title }}
            </p>
            <p class="text-xs text-base-content/70 truncate">
              {{ track.artistName }}
            </p>
          </div>
          <span class="text-xs text-base-content/70 font-mono flex-shrink-0">
            {{ formatDuration(track.duration || 0) }}
          </span>
        </li>
      </ul>
    </div>
    <div v-else class="flex-grow flex flex-col items-center justify-center text-center text-base-content/70">
      <Icon name="material-symbols:queue-music-outline-rounded" class="w-16 h-16 mb-4 opacity-50" />
      <p class="text-lg font-medium">The Queue is Empty</p>
      <p class="text-sm">Add some tracks to get started!</p>
    </div>
  </div>
</template>

<style scoped>
/* Apply safe area padding to the top for notches/status bars */
.pt-safe-top {
  padding-top: env(safe-area-inset-top, 1rem); /* 1rem fallback */
}
</style>