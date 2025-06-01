<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track';

const playerStore = usePlayerStore();

const queue = computed(() => playerStore.queue);
const currentIndex = computed(() => playerStore.currentQueueIndex);

// Function to handle click on a queue item
const handleClickOnQueueItem = (index: number): void => {
  if (index === playerStore.currentQueueIndex) {
    playerStore.togglePlayPause();
  } else {
    playerStore.playFromQueue(index);
  }
};


// No need for useHead in a component like this
// useHead({ title: 'Current Queue' });

const handleClearQueue = (): void => {
  playerStore.clearQueue();
};

// Helper function for resolving cover art (ensure it's defined or imported if used elsewhere)
const resolveCoverArtUrl = (coverPath: string | null): string => {
  if (!coverPath) return '/img/album-placeholder.png'; // Default placeholder
  return coverPath.startsWith('http') || coverPath.startsWith('/') ? coverPath : `/${coverPath}`;
};

// Helper function for truncating strings (ensure it's defined or imported if used elsewhere)
const truncateString = (str: string | undefined | null, maxLength: number): string => {
  if (!str) return '';
  if (str.length <= maxLength) return str;
  return str.substring(0, maxLength) + '...';
};

// Helper function for formatting duration (ensure it's defined or imported if used elsewhere)
const formatDuration = (seconds: number | null | undefined): string => {
  if (seconds === null || seconds === undefined) return '0:00';
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};
</script>

<template>
  <div class="w-96 bg-base-100 p-4 h-screen flex flex-col fixed right-0 top-0 pt-8 shadow-lg z-30 overflow-y-auto" style="padding-bottom: 5rem;"> <!-- Added padding-bottom for player -->
    <div class="flex justify-between items-center mb-4">
      <h2 class="text-xl font-semibold">Up Next</h2>
      <button 
        v-if="queue.length > 0"
        class="btn btn-ghost btn-sm text-error hover:bg-error/10"
        title="Clear queue"
        @click="handleClearQueue"
      >
        <Icon name="material-symbols:delete-sweep-outline-rounded" class="w-5 h-5" />
        <span class="ml-1">Clear</span>
      </button>
    </div>

    <div v-if="queue.length > 0" class="flex-grow overflow-y-auto space-y-1 pr-2">
      <div
        v-for="(track, index) in queue"
        :key="`${track.trackId}-${index}`"
        :title="track.title+ ' - ' + track.artistName"
        class="flex items-center p-2 rounded-md hover:bg-base-200 cursor-pointer group"
        :class="{'bg-base-300 text-base-content font-semibold': index === currentIndex}"
        @click="handleClickOnQueueItem(index)"
      >
        <div class="w-8 text-center text-xs text-base-content/70 mr-2">{{ index + 1 }}</div>
        <!-- Cover Art Image -->
        <div class="w-10 h-10 mr-3 flex-shrink-0" v-if="track.coverPath">
          <img 
            :src="resolveCoverArtUrl(track.coverPath)" 
            alt="Cover for {{ track.albumTitle ?? track.title }}" 
            class="w-full h-full object-cover rounded" 
          />
        </div>
        <div class="w-10 h-10 mr-3 flex-shrink-0 bg-base-300 rounded flex items-center justify-center" v-else>
          <Icon name="material-symbols:music-note" class="w-5 h-5 text-primary/50" />
        </div>
        <div class="flex-grow min-w-0">
          <div class="font-medium text-sm truncate w-full" :title="track.title" :class="index === currentIndex ? 'text-primary/90' : 'text-base-content/70'">{{ truncateString(track.title ?? 'Unknown Track', 50) }}</div>
          <div 
            class="text-xs truncate w-full text-base-content/70"
            :title="track.artistName || 'Unknown Artist'"
          >
            <template v-if="track.formattedArtists && track.formattedArtists.length > 0">
              <span v-for="(artist, artistIndex) in track.formattedArtists" :key="artist.artistId">
                <NuxtLink :to="artist.url" class="hover:underline" :class="{'font-semibold': artist.isPrimary}">
                  {{ artist.name }}
                </NuxtLink>
                <span v-if="artistIndex < track.formattedArtists.length - 2">, </span>
                <span v-else-if="artistIndex === track.formattedArtists.length - 2"> & </span>
              </span>
            </template>
            <template v-else>
              {{ truncateString(track.artistName ?? 'Unknown Artist', 50) }}
            </template>
          </div>
        </div>
        <div class="text-xs ml-2 shrink-0" :class="index === currentIndex ? 'text-base-content/90' : 'text-base-content/70'">
          {{ formatDuration(track.duration) }}
        </div>
      </div>
    </div>
    <div v-else class="flex-grow flex items-center justify-center">
      <p class="text-center text-neutral-content italic text-sm">Queue is empty.</p>
    </div>

  </div>
</template>


<style scoped>
/* Adjust sidebar height if you have a fixed header/navbar 
   Assuming a header height of 4rem (16 in Tailwind's default spacing units)
   And player height of 5rem (pb-20 on main content)
*/
.h-screen {
  height: 100vh; /* Full viewport height */
}

.pt-16 {
  padding-top: 4rem; /* Space for a potential fixed navbar */
}


/* Subtle scrollbar for webkit browsers */
.overflow-y-auto::-webkit-scrollbar {
  width: 6px;
}
.overflow-y-auto::-webkit-scrollbar-thumb {
  background-color: rgba(0,0,0,0.2);
  border-radius: 3px;
}
.overflow-y-auto::-webkit-scrollbar-track {
  background: transparent;
}
</style>
