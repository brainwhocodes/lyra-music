<template>
  <div v-if="playerStore.currentTrack" class="fixed inset-0 bg-neutral-900 text-white z-[100] flex flex-col p-4 pt-8 sm:pt-4 select-none">
    <!-- Top Bar -->
    <div class="flex justify-between items-center mb-6">
      <button @click="playerStore.toggleFullScreenPlayer()" class="p-2 -ml-2">
        <Icon name="material-symbols:keyboard-arrow-down-rounded" class="w-8 h-8" />
      </button>
      <div class="text-center">
        <div class="text-xs uppercase text-neutral-400 tracking-wider">Playing from Album</div>
        <div class="text-base font-semibold truncate max-w-xs sm:max-w-sm md:max-w-md">{{ playerStore.currentTrack.albumTitle || 'Unknown Album' }}</div>
      </div>
      <button class="p-2 -mr-2">
        <Icon name="material-symbols:more-vert" class="w-7 h-7" />
      </button>
    </div>

    <!-- Album Art -->
    <div class="flex items-center justify-center my-2 px-2 sm:px-8">
      <img 
          v-if="playerStore.currentTrack.coverPath" 
          :src="resolveCoverArtUrl(playerStore.currentTrack.coverPath)" 
          :alt="`${playerStore.currentTrack.title} cover`"
          class="w-full max-w-md aspect-square rounded-lg shadow-xl object-cover"
        />
    </div>

    <!-- Track Info & Like Button -->
    <div class="flex justify-between items-center my-6 px-1">
      <div>
        <h2 class="text-2xl font-bold truncate max-w-xs sm:max-w-sm md:max-w-md">{{ playerStore.currentTrack.title }}</h2>
        <p class="text-neutral-400 truncate max-w-xs sm:max-w-sm md:max-w-md">{{ playerStore.currentTrack.artistName }}</p>
      </div>
      <button v-if="false" class="btn btn-ghost btn-circle btn-xl">
        <Icon name="material-symbols:favorite-outline-rounded" class="w-7 h-7" />
        <!-- TODO: Use material-symbols:favorite-rounded if liked -->
      </button>
    </div>
    <!-- Playback Controls -->
    <div class="flex justify-center items-center gap-x-6 mt-4 mb-8 px-2">
      <button 
        class="btn btn-xl btn-ghost btn-circle"
        :class="{'text-accent': playerStore.isShuffled}"
        @click="playerStore.toggleShuffle"
        title="Toggle Shuffle"
      >
        <Icon name="material-symbols:shuffle-rounded" class="w-7 h-7" />
      </button>
      <button 
        class="btn btn-xl btn-ghost btn-circle"
        @click="playerStore.playPrevious"
        :disabled="!playerStore.canPlayPrevious || playerStore.isLoading"
        title="Previous Track"
      >
        <Icon name="material-symbols:skip-previous-rounded" class="w-7 h-7" />
      </button>
      <button class="btn btn-xl btn-circle btn-primary" @click="playerStore.togglePlayPause">
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
        class="btn btn-xl btn-circle btn-ghost"
        @click="playerStore.playNext"
        :disabled="!playerStore.canPlayNext || playerStore.isLoading"
        title="Next Track"
      >
        <Icon name="material-symbols:skip-next-rounded" class="w-12 h-12" />
      </button>
      <button 
        class="btn btn-xl btn-circle btn-ghost"
        :class="{'text-accent': playerStore.repeatMode !== 'none'}"
        @click="playerStore.toggleRepeatMode"
        :title="`Repeat Mode: ${playerStore.repeatMode}`"
      >
        <Icon v-if="playerStore.repeatMode === 'one'" name="material-symbols:repeat-one-rounded" class="w-7 h-7" />
        <Icon v-else name="material-symbols:repeat-rounded" class="w-7 h-7" />
      </button>
    </div>

        <!-- Seek Bar -->
    <div class="my-6 px-1">
      <input 
        type="range" 
        min="0" 
        :max="playerStore.duration || 0"
        :value="playerStore.currentTime"
        class="range range-primary range-xs flex-1 w-full"
        :style="{ '--track-progress': (playerStore.duration ? (playerStore.currentTime / playerStore.duration) * 100 : 0) + '%' }"
        @mousedown="playerStore.startSeeking()"
        @touchstart="playerStore.startSeeking()"
        @input="handleContinuousSeekInput"
        @mouseup="playerStore.endSeeking()"
        @touchend="playerStore.endSeeking()"
        :disabled="!playerStore.duration || playerStore.isLoading"
      />
      <div class="flex justify-between text-xs text-neutral-400 mt-2 font-mono">
        <span>{{ formatTime(playerStore.currentTime) }}</span>
        <span>{{ formatTime(playerStore.duration) }}</span>
      </div>
    </div>


    <!-- Lyrics Toggle -->
    <div class="text-center mt-auto mb-2">
      <button class="text-xs uppercase text-neutral-500 hover:text-accent tracking-wider">
        Lyrics
        <Icon name="material-symbols:keyboard-arrow-up-rounded" class="w-5 h-5 inline-block ml-1" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';

const playerStore = usePlayerStore();

const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds === Infinity || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds < 10 ? '0' : ''}${remainingSeconds}`;
};

const handleContinuousSeekInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  if (playerStore.isSeeking) {
    playerStore.currentTime = parseFloat(target.value);
  }
};

</script>
