<template>
  <div 
    v-if="playerStore.currentTrack"
    class="fixed bottom-0 left-0 right-0 bg-base-300 text-base-content p-3 shadow-inner z-50 flex items-center gap-4 h-25"
  >
    <!-- Track Info -->
    <div class="flex-1 min-w-0">
      <div class="font-semibold truncate" :title="playerStore.currentTrack.title">
        {{ playerStore.currentTrack.title || 'Unknown Track' }}
      </div>
      <div class="text-xs text-base-content/70 truncate" :title="playerStore.currentTrack.artistName || ''">
        {{ playerStore.currentTrack.artistName || 'Unknown Artist' }}
      </div>
    </div>

    <!-- Playback Controls -->
    <div class="flex items-center gap-2">
      <button 
        class="btn btn-ghost btn-xl btn-circle"
        @click="playerStore.playPrevious"
        :disabled="!playerStore.canPlayPrevious || playerStore.isLoading"
        title="Previous Track"
      >
        <Icon name="material-symbols:skip-previous-rounded" class="w-6 h-6" />
      </button>
      <button 
        class="btn btn-ghost btn-xl btn-circle"
        :class="{'text-primary': playerStore.isShuffled}" 
        @click="playerStore.toggleShuffle"
        title="Toggle Shuffle"
      >
        <Icon name="material-symbols:shuffle-rounded" class="w-5 h-5" />
      </button>
      <button class="btn btn-ghost btn-xl btn-circle" @click="playerStore.togglePlayPause">
        <Icon 
          v-if="playerStore.isLoading"
          name="svg-spinners:180-ring-with-bg"
          class="w-6 h-6"
        />
        <Icon 
          v-else-if="playerStore.isPlaying" 
          name="material-symbols:pause-rounded" 
          class="w-6 h-6" 
        />
        <Icon 
          v-else 
          name="material-symbols:play-arrow-rounded" 
          class="w-6 h-6" 
        />
      </button>
      <button 
        class="btn btn-ghost btn-xl btn-circle"
        @click="playerStore.playNext"
        :disabled="!playerStore.canPlayNext || playerStore.isLoading"
        title="Next Track"
      >
        <Icon name="material-symbols:skip-next-rounded" class="w-6 h-6" />
      </button>
      <button 
        class="btn btn-ghost btn-xl btn-circle"
        :class="{'text-primary': playerStore.repeatMode !== 'none'}" 
        @click="playerStore.toggleRepeatMode"
        :title="`Repeat Mode: ${playerStore.repeatMode}`"
      >
        <Icon v-if="playerStore.repeatMode === 'one'" name="material-symbols:repeat-one-rounded" class="w-5 h-5" />
        <Icon v-else name="material-symbols:repeat-rounded" class="w-5 h-5" />
      </button>
      <NuxtLink
        to="/queue"
        class="btn btn-ghost btn-xl btn-circle"
        title="Show Current Queue"
      >
        <Icon name="material-symbols:queue-music-rounded" class="w-5 h-5" />
      </NuxtLink>
    </div>

    <!-- Seek Bar -->
    <div class="flex items-center gap-2 flex-grow max-w-md">
       <span class="text-xs font-mono">{{ formatTime(playerStore.currentTime) }}</span>
       <input 
         type="range" 
         min="0" 
         :max="playerStore.duration || 0"
         :value="playerStore.currentTime"
         class="range range-primary flex-1"
         :disabled="!playerStore.duration || playerStore.isLoading"
         @input="handleSeek"
       />
       <span class="text-xs font-mono">{{ formatTime(playerStore.duration) }}</span>
    </div>
    
    <!-- Volume Control -->
    <div class="flex items-center gap-2">
      <Icon 
        name="material-symbols:volume-up-rounded" 
        class="w-5 h-5 text-base-content/70" 
        v-if="playerStore.volume > 0.5" 
      />
       <Icon 
        name="material-symbols:volume-down-rounded" 
        class="w-5 h-5 text-base-content/70" 
        v-else-if="playerStore.volume > 0"
      />
       <Icon 
        name="material-symbols:volume-mute-rounded" 
        class="w-5 h-5 text-base-content/70" 
        v-else
      />
      <input 
        type="range" 
        min="0" 
        max="1" 
        step="0.01" 
        :value="playerStore.volume"
        class="range w-50"
        @input="handleVolumeChange"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import { computed } from 'vue';

const playerStore = usePlayerStore();

// Helper to format time (e.g., 1:05)
const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Handle seek bar input
const handleSeek = (event: Event) => {
  const target = event.target as HTMLInputElement;
  playerStore.seek(parseFloat(target.value));
};

// Handle volume slider input
const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  playerStore.setVolume(parseFloat(target.value));
};

</script>

<style scoped>
/* Add any specific styles if needed */
.range-md {
  height: 0.rem; /* Adjust size for daisyUI range */
}
</style>
