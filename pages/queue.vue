<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/stores/player'; // Assuming Track type is exported

const playerStore = usePlayerStore();

const queue = computed(() => playerStore.queue);
const currentIndex = computed(() => playerStore.currentQueueIndex);

// Function to play a specific track from the queue display
const playTrackFromQueue = (index: number): void => {
  playerStore.playFromQueue(index);
};

// Format duration helper (consider moving to a utils file)
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

useHead({ title: 'Current Queue' });

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Current Queue</h1>

    <div v-if="queue.length > 0" class="overflow-x-auto">
      <table class="table w-full table-zebra">
        <thead>
          <tr>
            <th class="w-12 text-center">#</th>
            <th class="w-12"></th> <!-- Play button -->
            <th>Title</th>
            <th>Artist</th>
            <th>Album</th>
            <th class="text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="(track, index) in queue" 
            :key="`${track.id}-${index}`" 
            class="hover"
            :class="{'text-primary font-semibold bg-base-300': index === currentIndex}"
          >
            <td class="text-center text-sm text-neutral-content">{{ index + 1 }}</td>
            <td class="text-center">
              <button 
                v-if="index !== currentIndex"
                class="btn btn-ghost btn-sm btn-circle"
                @click="playTrackFromQueue(index)"
                title="Play this track"
              >
                <Icon name="material-symbols:play-arrow-rounded" class="w-5 h-5" />
              </button>
               <Icon v-else name="material-symbols:volume-up-rounded" class="w-5 h-5 text-primary" title="Currently Playing"/>
            </td>
            <td class="font-medium">{{ track.title }}</td>
            <td class="text-sm">{{ track.artistName }}</td>
            <td class="text-sm">{{ track.albumTitle }}</td>
            <td class="text-right text-sm text-neutral-content">{{ formatDuration(track.duration) }}</td>
          </tr>
        </tbody>
      </table>
    </div>
    <div v-else>
      <p class="text-center text-neutral-content italic">The queue is currently empty.</p>
    </div>

  </div>
</template>
