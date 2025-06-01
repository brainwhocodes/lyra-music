<template>
  <div 
    v-if="playerStore.currentTrack"
    class="fixed bottom-0 left-0 right-0 bg-base-100 text-base-content p-3 shadow-inner z-50 flex items-center gap-4 h-32"
  >
    <!-- Column 1: Track Info & Cover -->
    <div class="flex items-center gap-3 min-w-0 flex-1">
      <!-- Album Cover -->
      <div class="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-base-200">
        <img 
          v-if="playerStore.currentTrack.coverPath" 
          :src="resolveCoverArtUrl(playerStore.currentTrack.coverPath)" 
          :alt="`${playerStore.currentTrack.title} cover`"
          class="w-full h-full object-cover"
        />
        <div v-else class="w-full h-full flex items-center justify-center bg-base-200">
          <Icon name="material-symbols:music-note" class="w-8 h-8 text-base-content/50" />
        </div>
      </div>

      <!-- Track Info -->
      <div class="flex-1 min-w-0">
        <div class="font-semibold truncate" :title="playerStore.currentTrack.title">
          {{ playerStore.currentTrack.title || 'Unknown Track' }}
        </div>
        <!-- Artist display with formatted artists if available -->
        <div class="text-sm text-base-content/70 truncate">
          <!-- Use formatted artists if available -->
          <template v-if="playerStore.currentTrack.formattedArtists && playerStore.currentTrack.formattedArtists.length">
            <span v-for="(artist, index) in playerStore.currentTrack.formattedArtists" :key="artist.artistId" class="mr-1">
              <NuxtLink :to="artist.url" class="hover:underline" :class="{'font-semibold': artist.isPrimary}">
                {{ artist.name }}
              </NuxtLink>
              <span v-if="index < playerStore.currentTrack.formattedArtists.length - 2"> &</span>
              <span v-else-if="index === playerStore.currentTrack.formattedArtists.length - 2"> &</span>
            </span>
          </template>
          <!-- Fallback to simple artist name if no formatted artists -->
          <span v-else>
            <NuxtLink class="hover:underline" :to="`/artists/${playerStore.currentTrack.artistId}`">
              {{ playerStore.currentTrack.artistName || 'Unknown Artist' }}
            </NuxtLink>
          </span>
        </div>
        <div v-if="playerStore.currentTrack.albumTitle" class="text-xs text-base-content/50 truncate">
          <NuxtLink class="hover:underline" :to="`/albums/${playerStore.currentTrack.albumId}`">
            {{ playerStore.currentTrack.albumTitle }}
          </NuxtLink>
        </div>
      </div>
    </div>

    <!-- Column 2: Playback Controls & Seek Bar -->
    <div class="flex flex-col items-center justify-center gap-2 flex-[1.5] min-w-0">
      <!-- Playback Controls -->
      <div class="flex items-center gap-1">
        <button 
          class="btn btn-ghost btn-xl btn-circle"
          @click="playerStore.playPrevious"
          :disabled="!playerStore.canPlayPrevious || playerStore.isLoading"
          title="Click once to restart track, double-click to play previous track"
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
        <button
          class="btn btn-ghost btn-xl btn-circle"
          :class="{'text-primary': playerStore.isQueueSidebarVisible}"
          @click="playerStore.toggleQueueSidebar"
          :title="playerStore.isQueueSidebarVisible ? 'Hide Queue' : 'Show Queue'"
        >
          <Icon name="material-symbols:queue-music-rounded" class="w-5 h-5" />
        </button>
      </div>

      <!-- Seek Bar -->
      <div class="flex items-center gap-2 w-full max-w-xl px-2">
         <span class="text-xs font-mono">{{ formatTime(playerStore.currentTime) }}</span>
         <input 
           type="range" 
           min="0" 
           :max="playerStore.duration || 0"
           :value="playerStore.currentTime"
           class="range range-primary range-xs flex-1"
           :disabled="!playerStore.duration || playerStore.isLoading"
           @mousedown="playerStore.startSeeking()"
           @touchstart="playerStore.startSeeking()"
           @input="handleContinuousSeekInput"
           @mouseup="playerStore.endSeeking()"
           @touchend="playerStore.endSeeking()"
         />
         <span class="text-xs font-mono">{{ formatTime(playerStore.duration) }}</span>
      </div>
    </div>
    
    <!-- Column 3: Volume Control -->
    <div class="flex items-center justify-end gap-2 flex-1 min-w-0">
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
        class="range range-xs w-50"
        @input="handleVolumeChange"
      />
    </div>

  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';

const playerStore = usePlayerStore();

// Handle seek bar input during drag
const handleContinuousSeekInput = (event: Event) => {
  const target = event.target as HTMLInputElement;
  playerStore.updateSeekPosition(parseFloat(target.value));
};

// Handle volume slider input
const handleVolumeChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  playerStore.setVolume(parseFloat(target.value));
};

</script>

<style scoped>
/* Add any specific styles if needed */

</style>
