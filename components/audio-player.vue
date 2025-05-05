<template>
  <div v-if="currentTrack" class="fixed bottom-0 left-0 right-0 bg-base-300 text-base-content p-3 shadow-inner z-50">
    <div class="container mx-auto flex items-center gap-4">
      <!-- Album Art / Track Info -->
      <div class="flex items-center gap-3 flex-shrink-0 w-1/4">
        <img 
          :src="currentTrack.albumArtPath || '/placeholder-cover.png'" 
          alt="Album Art" 
          class="w-12 h-12 rounded object-cover bg-base-100"
          @error="onImageError"
          />
        <div>
          <p class="text-sm font-semibold truncate" :title="currentTrack.title">{{ currentTrack.title }}</p>
          <p class="text-xs text-gray-400 truncate" :title="currentTrack.artistName || 'Unknown Artist'">{{ currentTrack.artistName || 'Unknown Artist' }}</p>
        </div>
      </div>

      <!-- Playback Controls & Seek -->
      <div class="flex flex-col items-center flex-grow">
         <!-- Play/Pause Button -->
         <button @click="togglePlay" class="btn btn-ghost btn-circle">
             <svg v-if="!isPlaying" xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
             <svg v-else xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
         </button>
        <!-- Seek Bar -->
        <div class="flex items-center gap-2 w-full max-w-md">
          <span class="text-xs w-10 text-right">{{ formatTime(currentTime) }}</span>
           <input 
             type="range" 
             min="0" 
             :max="duration || 1" 
             :value="currentTime" 
             class="range range-primary range-xs flex-grow" 
             @input="onSeekInput" 
             @change="onSeekChange"
             />
          <span class="text-xs w-10">{{ formatTime(duration) }}</span>
        </div>
      </div>

      <!-- Volume Control -->
      <div class="flex items-center gap-2 w-1/4 justify-end">
         <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
         <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            :value="volume" 
            @input="onVolumeChange" 
            class="range range-secondary range-xs w-24"
            />
      </div>
    </div>

    <!-- Hidden Audio Element -->
    <audio 
      ref="audioElement" 
      :src="audioSource" 
      @loadedmetadata="handleMetadataLoaded"
      @timeupdate="handleTimeUpdate"
      @play="handlePlay"
      @pause="handlePause"
      @ended="handleEnded"
      @error="handleAudioError"
      preload="metadata"
      ></audio>

  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
import { usePlayerState } from '~/composables/usePlayerState';

const { 
  currentTrack, 
  isPlaying, 
  currentTime, 
  duration, 
  volume,
  togglePlay, 
  setCurrentTime, 
  setDuration,
  setVolume
} = usePlayerState();

const audioElement = ref<HTMLAudioElement | null>(null);
const isSeeking = ref(false); // Flag to prevent timeupdate during manual seek

// Computed property for the audio source URL
const audioSource = computed(() => {
    // Important: This uses the placeholder streamUrl from the state.
    // This MUST be updated once the actual streaming endpoint is implemented.
    return currentTrack.value?.streamUrl || '';
});

// Watch for changes in the current track's source URL
watch(audioSource, (newSource) => {
  if (audioElement.value && newSource) {
    console.log('AudioPlayer: Source changed, loading new track -', newSource);
    audioElement.value.load(); // Load the new source
  } else if (audioElement.value && !newSource) {
    audioElement.value.pause(); // Stop playback if source becomes null
  }
});

// Watch for changes in the isPlaying state
watch(isPlaying, (playing) => {
  if (!audioElement.value) return;
  if (playing) {
     console.log('AudioPlayer: Play command received');
     // Attempt to play, handle potential errors (e.g., requires user interaction first)
     audioElement.value.play().catch(error => {
         console.error('AudioPlayer: Error attempting to play:', error);
         // Optionally reset state if play fails
         // isPlaying.value = false; 
     });
  } else {
    console.log('AudioPlayer: Pause command received');
    audioElement.value.pause();
  }
});

// Watch for external changes to currentTime (e.g., user seeking)
watch(currentTime, (newTime) => {
    // Only update audio element's time if we are NOT currently dragging the seek bar
    // AND the new time differs significantly from the audio's current time
    if (audioElement.value && !isSeeking.value && Math.abs(audioElement.value.currentTime - newTime) > 1) {
        console.log(`AudioPlayer: Setting audio currentTime to ${newTime}`);
        audioElement.value.currentTime = newTime;
    }
});

// Watch for volume changes
watch(volume, (newVolume) => {
    if(audioElement.value) {
        audioElement.value.volume = newVolume;
    }
});

// --- Audio Element Event Handlers ---

function handleMetadataLoaded() {
  if (!audioElement.value) return;
  console.log('AudioPlayer: Metadata loaded, duration -', audioElement.value.duration);
  // Update duration state if it's valid and different from metadata estimate
  setDuration(audioElement.value.duration); 
   // Autoplay if isPlaying is true when metadata loads (covers track changes)
   if (isPlaying.value) {
       audioElement.value.play().catch(error => console.error('AudioPlayer: Autoplay error:', error));
   }
}

function handleTimeUpdate() {
  if (audioElement.value && !isSeeking.value) {
      // Update state only if not currently seeking
      setCurrentTime(audioElement.value.currentTime);
  }
}

function handlePlay() {
    console.log('AudioPlayer: Play event fired');
    // Ensure state reflects reality (e.g., if play started automatically)
    if (!isPlaying.value) {
        isPlaying.value = true;
    }
}

function handlePause() {
    console.log('AudioPlayer: Pause event fired');
    // Ensure state reflects reality (e.g., if paused externally)
    if (isPlaying.value) {
        isPlaying.value = false;
    }
}

function handleEnded() {
  console.log('AudioPlayer: Track ended');
  // TODO: Implement next track logic here
  isPlaying.value = false;
  setCurrentTime(0); // Reset time
  // Potentially call playerStore.playNext();
}

function handleAudioError(event: Event) {
    console.error('AudioPlayer: Error event fired', event);
    if(audioElement.value) {
        console.error('Audio error details:', audioElement.value.error);
    }
    // Handle error: stop playback, show message?
    isPlaying.value = false;
    // Maybe try to play next track or clear player?
}

// --- UI Interaction Handlers ---

// When user starts dragging the seek bar
function onSeekInput(event: Event) {
    isSeeking.value = true;
    // Optional: Update currentTime immediately for visual feedback while dragging
    // setCurrentTime(Number((event.target as HTMLInputElement).value)); 
}

// When user finishes dragging/clicking the seek bar
function onSeekChange(event: Event) {
    if (audioElement.value) {
        const newTime = Number((event.target as HTMLInputElement).value);
        console.log('AudioPlayer: Seek change to -', newTime);
        audioElement.value.currentTime = newTime;
        setCurrentTime(newTime); // Update state immediately
    }
    // Short delay before resetting isSeeking to allow audio element time update
    setTimeout(() => { isSeeking.value = false; }, 50);
}

// When user changes the volume slider
function onVolumeChange(event: Event) {
    const newVolume = Number((event.target as HTMLInputElement).value);
    setVolume(newVolume);
}

// Helper to format time (seconds to MM:SS)
function formatTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Handle image loading errors
function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = '/placeholder-cover.png'; // Path to your placeholder image
}

// Set initial volume on mount
onMounted(() => {
    if(audioElement.value) {
        audioElement.value.volume = volume.value;
    }
});

</script>

<style scoped>
/* Add component-specific styles if needed */
input[type='range']::-webkit-slider-thumb {
  cursor: pointer;
}
input[type='range']::-moz-range-thumb {
   cursor: pointer;
}
</style>
