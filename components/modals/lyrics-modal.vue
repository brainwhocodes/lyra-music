<template>
  <dialog :open="playerStore.isLyricsModalVisible" class="modal modal-bottom sm:modal-middle">
    <div class="modal-box max-w-2xl">
      <h3 class="font-bold text-lg">{{ modalTitle }}</h3>
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2" @click="close">✕</button>
      <div class="flex flex-col h-full mt-4">
        <!-- Loading state -->
        <div v-if="isLoading" class="flex-grow flex items-center justify-center p-6">
          <Icon name="svg-spinners:blocks-wave" class="w-12 h-12 text-primary" />
        </div>

        <!-- Error state -->
        <div v-else-if="error" class="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <div class="text-red-500 mb-4">
            <Icon name="material-symbols:error-outline-rounded" class="w-10 h-10" />
          </div>
          <h3 class="text-xl font-semibold mb-2">{{ error }}</h3>
          <p class="text-gray-400 mb-4">Unable to load lyrics for this track.</p>
          <button 
            @click="generateLyrics" 
            class="btn btn-primary"
            :disabled="isGenerating"
          >
            <Icon v-if="isGenerating" name="svg-spinners:blocks-wave" class="w-5 h-5 mr-2" />
            {{ isGenerating ? 'Generating...' : 'Generate Lyrics' }}
          </button>
        </div>

        <!-- No lyrics state -->
        <div v-else-if="!lyrics || lyrics.length === 0" class="flex-grow flex flex-col items-center justify-center p-6 text-center">
          <div class="text-gray-400 mb-4">
            <Icon name="material-symbols:music-note-outline-rounded" class="w-10 h-10" />
          </div>
          <h3 class="text-xl font-semibold mb-2">No lyrics found</h3>
          <p class="text-gray-400 mb-4">This track doesn't have any lyrics yet.</p>
          <button 
            @click="generateLyrics" 
            class="btn btn-primary"
            :disabled="isGenerating"
          >
            <Icon v-if="isGenerating" name="svg-spinners:blocks-wave" class="w-5 h-5 mr-2" />
            {{ isGenerating ? 'Generating...' : 'Generate Lyrics' }}
          </button>
        </div>

        <!-- Lyrics display -->
        <div v-else class="flex-grow overflow-y-auto p-4">
          <div class="lyrics-container">
            <div 
              v-for="(line, index) in lyrics" 
              :key="index"
              :class="{ 
                'lyrics-line': true,
                'active': isActiveLine(line),
                'past': isPastLine(line),
                'cursor-pointer': playerStore.currentTrack // Add pointer cursor if clickable
              }"
              :ref="el => { if (isActiveLine(line)) activeLineRef = el }"
              @click="seekToLyricTime(line)"
              title="Click to jump to this line"
            >
              <span class="lyrics-time">{{ formatTime(line.time) }}</span>
              <span class="lyrics-text">{{ line.text }}</span>
            </div>
          </div>
        </div>

        <!-- Controls -->
        <div class="flex justify-between items-center p-4 border-t border-gray-700">
          <div class="flex items-center">
            <button 
              @click="toggleAutoScroll" 
              class="btn btn-sm"
              :class="{ 'btn-primary': autoScroll, 'btn-outline': !autoScroll }"
              title="Auto-scroll to active lyrics"
            >
              <Icon name="material-symbols:height-rounded" class="w-5 h-5 mr-1" /> Auto-scroll
            </button>
          </div>
          <div>
            <button 
              v-if="lyrics && lyrics.length > 0"
              @click="generateLyrics" 
              class="btn btn-sm btn-outline"
              :disabled="isGenerating"
              title="Regenerate lyrics"
            >
              <Icon name="material-symbols:sync-rounded" class="w-5 h-5 mr-1" /> 
              <span v-if="!isGenerating">Regenerate</span>
              <Icon v-else name="svg-spinners:blocks-wave" class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <form method="dialog" class="modal-backdrop">
      <button @click="close">close</button>
    </form>
  </dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from '#imports'; // Removed onMounted, onUnmounted as modalStore listeners are removed
import { usePlayerStore } from '~/stores/player';
// import { useModalStore } from '~/stores/modal'; // Removed modalStore
import type { TimestampedLyric } from '~/server/utils/gemini-service';

const playerStore = usePlayerStore();
// const modalStore = useModalStore(); // Removed modalStore

// State
// const isOpen = ref(false); // Removed, using playerStore.isLyricsModalVisible
const isLoading = ref(false);
const isGenerating = ref(false);
const error = ref<string | null>(null);
const lyrics = ref<TimestampedLyric[]>([]);
const activeLineRef = ref<HTMLElement | null>(null);
const autoScroll = ref(true);

// Method to seek player to a specific time
function seekToLyricTime(line: TimestampedLyric): void {
  if (!playerStore.currentTrack) return;

  const timeInSeconds = parseTimeToSeconds(line.time);
  playerStore.seek(timeInSeconds);

  // Optional: if player is paused, maybe play it? Or let user control this.
  // if (!playerStore.isPlaying) {
  //   playerStore.togglePlayPause();
  // }
}

// Computed
const modalTitle = computed(() => {
  if (!playerStore.currentTrack) return 'Lyrics';
  return `Lyrics: ${playerStore.currentTrack.title}`;
});

const currentTrackId = computed(() => playerStore.currentTrack?.trackId);
const currentTime = computed(() => playerStore.currentTime);

// Methods
function close() {
  // isOpen.value = false; // Removed
  // modalStore.closeLyricsModal(); // Removed
  playerStore.hideLyricsModal();
}

function formatTime(timeStr: string): string {
  // Format MM:SS or MM:SS.mmm to MM:SS
  return timeStr.split('.')[0];
}

function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  const minutes = parseInt(parts[0], 10);
  const seconds = parseFloat(parts[1]);
  return minutes * 60 + seconds;
}

function isActiveLine(line: TimestampedLyric): boolean {
  if (!playerStore.isPlaying) return false;
  
  const lineTime = parseTimeToSeconds(line.time);
  const currentTimeSeconds = currentTime.value;
  const nextLineIndex = lyrics.value.findIndex(l => l.time === line.time) + 1;
  
  if (nextLineIndex < lyrics.value.length) {
    const nextLineTime = parseTimeToSeconds(lyrics.value[nextLineIndex].time);
    return currentTimeSeconds >= lineTime && currentTimeSeconds < nextLineTime;
  }
  
  // Last line
  return currentTimeSeconds >= lineTime;
}

function isPastLine(line: TimestampedLyric): boolean {
  if (!playerStore.isPlaying) return false;
  
  const lineTime = parseTimeToSeconds(line.time);
  const currentTimeSeconds = currentTime.value;
  const nextLineIndex = lyrics.value.findIndex(l => l.time === line.time) + 1;
  
  if (nextLineIndex < lyrics.value.length) {
    const nextLineTime = parseTimeToSeconds(lyrics.value[nextLineIndex].time);
    return currentTimeSeconds >= nextLineTime;
  }
  
  return false;
}

function scrollToActiveLine() {
  if (!autoScroll.value || !activeLineRef.value) return;
  
  activeLineRef.value.scrollIntoView({
    behavior: 'smooth',
    block: 'center'
  });
}

function toggleAutoScroll() {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToActiveLine();
  }
}

async function fetchLyrics() {
  console.log('[LyricsModal Debug] fetchLyrics called. currentTrackId:', currentTrackId.value);
  if (!currentTrackId.value) return;
  
  isLoading.value = true;
  error.value = null;
  
  try {
    const response = await fetch(`/api/tracks/${currentTrackId.value}/lyrics`);
    console.log('[LyricsModal Debug] fetchLyrics response status:', response.status, 'ok:', response.ok);
    
    if (!response.ok) {
      if (response.status === 404) {
        // No lyrics found, but not an error
        lyrics.value = [];
      } else {
        throw new Error(`Failed to fetch lyrics: ${response.statusText}`);
      }
    } else {
      const data = await response.json();
      console.log('[LyricsModal Debug] fetchLyrics data from response.json():', JSON.stringify(data, null, 2));
      console.log('[LyricsModal Debug] fetchLyrics data.lyricsJson (type:', typeof data.lyricsJson, 'is Array:', Array.isArray(data.lyricsJson), '):', JSON.stringify(data.lyricsJson, null, 2));
      lyrics.value = data.lyricsJson || [];
      console.log('[LyricsModal Debug] fetchLyrics lyrics.value after assignment (length:', lyrics.value?.length, '):', JSON.stringify(lyrics.value, null, 2));
    }
  } catch (err) {
    console.error('[LyricsModal Debug] fetchLyrics caught an error:', err);
    console.error('Error fetching lyrics:', err);
    error.value = err instanceof Error ? err.message : 'Failed to load lyrics';
  } finally {
    isLoading.value = false;
  }
}

async function generateLyrics() {
  if (!currentTrackId.value || isGenerating.value) return;
  
  isGenerating.value = true;
  error.value = null;
  
  try {
    const response = await fetch(`/api/tracks/${currentTrackId.value}/lyrics/generate`, {
      method: 'POST',
    });
    
    if (!response.ok) {
      throw new Error(`Failed to generate lyrics: ${response.statusText}`);
    }
    
    const data = await response.json();
    lyrics.value = data.lyricsJson || [];
  } catch (err) {
    console.error('Error generating lyrics:', err);
    error.value = err instanceof Error ? err.message : 'Failed to generate lyrics';
  } finally {
    isGenerating.value = false;
  }
}

// Watch for modal visibility changes from playerStore
watch(() => playerStore.isLyricsModalVisible, (isVisible: boolean) => {
  if (isVisible && currentTrackId.value) {
    fetchLyrics();
  } else if (!isVisible) {
    // Clear lyrics and error when modal is hidden
    lyrics.value = [];
    error.value = null;
  }
});

// Watch for current track changes while modal is open
watch(currentTrackId, (newTrackId) => {
  if (newTrackId && playerStore.isLyricsModalVisible) {
    fetchLyrics();
  } else if (!newTrackId && playerStore.isLyricsModalVisible) {
    // No track, but modal is open - clear lyrics and show message
    lyrics.value = [];
    error.value = 'No track selected to display lyrics.';
  }
});

// Watch for current time changes to scroll to active line
watch(currentTime, () => {
  if (playerStore.isPlaying) {
    scrollToActiveLine();
  }
});
</script>

<style scoped>
.lyrics-container {
  font-size: 1.1rem;
  line-height: 1.6;
}

.lyrics-line {
  display: flex;
  margin-bottom: 0.75rem;
  padding: 0.25rem 0.5rem;
  border-radius: 0.25rem;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.lyrics-time {
  color: #6b7280;
  min-width: 3.5rem;
  margin-right: 1rem;
  font-family: monospace;
}

.lyrics-line.active {
  background-color: rgba(59, 130, 246, 0.2);
  font-weight: 600;
}

.lyrics-line.active .lyrics-time {
  color: #93c5fd;
}

.lyrics-line.past {
  color: #9ca3af;
}
</style>
