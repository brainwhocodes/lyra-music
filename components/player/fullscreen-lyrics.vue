<template>
  <div v-if="playerStore.isFullScreenLyricsVisible" class="fullscreen-lyrics-container">
    <div class="header">
      <div class="track-info">
        <p class="title">{{ playerStore.currentTrack?.title || 'Lyrics' }}</p>
        <p v-if="currentTrackArtistNames" class="artist">{{ currentTrackArtistNames }}</p>
      </div>
      <button @click="closeFullScreenLyrics" class="close-button">
        <i class="fas fa-times"></i> <!-- Or your preferred close icon -->
      </button>
    </div>

    <div class="lyrics-content" ref="lyricsContentRef">
      <div v-if="isLoading" class="loading-lyrics">
        <p>Loading lyrics...</p> <!-- Replace with a spinner component later -->
      </div>
      <div v-else-if="error" class="error-lyrics">
        <p>{{ error }}</p>
      </div>
      <div v-else-if="lyrics.length === 0 && !isLoading" class="no-lyrics">
        <p>No lyrics available for this track.</p>
        <button v-if="canGenerateLyrics && playerStore.currentTrack?.trackId" @click="handleGenerateLyrics" :disabled="isGenerating">
          {{ isGenerating ? 'Generating...' : 'Generate Lyrics' }}
        </button>
      </div>
      <div v-else class="lyrics-lines-container">
        <div 
          v-for="(line, index) in lyrics" 
          :key="index"
          :class="{ 
            'lyrics-line': true,
            'active': isActiveLine(line),
            'past': isPastLine(line),
            'cursor-pointer': playerStore.currentTrack
          }"
          :ref="(el: HTMLElement | null) => { if (isActiveLine(line)) activeLineRef = el }"
          @click="seekToLyricTime(line)"
          :title="`Jump to ${formatTime(line.time)}`"
        >
          <!-- Optional: Show timestamps if desired in fullscreen view -->
          <!-- <span class="lyrics-time">{{ formatTime(line.time) }}</span> -->
          <span class="lyrics-text">{{ line.text }}</span>
        </div>
      </div>
    </div>

    <div class="controls">
      <button @click="toggleAutoScroll" :class="{ 'active': autoScroll }">
        Auto-Scroll {{ autoScroll ? 'On' : 'Off' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">

import { usePlayerStore } from '~/stores/player';
import type { TimestampedLyric } from '~/types/lyrics';
import { useTrackArtists } from '~/composables/useTrackArtists';

const playerStore = usePlayerStore();
const { getTrackArtistNameString } = useTrackArtists();

const currentTrackArtistNames = computed(() => {
  if (playerStore.currentTrack) {
    return getTrackArtistNameString(playerStore.currentTrack);
  }
  return '';
});

const lyrics = ref<TimestampedLyric[]>([]);
const isLoading = ref<boolean>(false);
const error = ref<string | null>(null);
const activeLineRef = ref<HTMLElement | null>(null);
const lyricsContentRef = ref<HTMLElement | null>(null);
const autoScroll = ref<boolean>(true);

// States for generating lyrics (optional, can be moved to a composable)
const isGenerating = ref<boolean>(false);
const canGenerateLyrics = ref<boolean>(true); // Or determine based on some logic

// --- Core Lyrics Logic (adapted from LyricsModal) --- 

/**
 * Parses a time string (MM:SS.mmm or HH:MM:SS.mmm) into seconds.
 * @param timeStr The time string.
 * @returns The time in seconds.
 */
function parseTimeToSeconds(timeStr: string): number {
  const parts = timeStr.split(':');
  let seconds = 0;
  if (parts.length === 3) { // HH:MM:SS.mmm
    seconds += parseInt(parts[0], 10) * 3600; // hours
    seconds += parseInt(parts[1], 10) * 60;   // minutes
    seconds += parseFloat(parts[2]);          // seconds
  } else if (parts.length === 2) { // MM:SS.mmm
    seconds += parseInt(parts[0], 10) * 60;   // minutes
    seconds += parseFloat(parts[1]);          // seconds
  } else {
    console.warn(`[FullscreenLyrics] Invalid time format: ${timeStr}`);
    return 0;
  }
  return seconds;
}

/**
 * Formats a time string (MM:SS.mmm) to MM:SS for display.
 */
function formatTime(timeStr: string): string {
  if (!timeStr || !timeStr.includes(':')) return '00:00';
  const parts = timeStr.split(':');
  const ssParts = parts.at(-1)?.split('.'); // Handle seconds and milliseconds
  if (parts.length >= 2 && ssParts) {
    const minutes = parts.length === 3 ? parts[1] : parts[0];
    const seconds = ssParts[0];
    return `${minutes.padStart(2, '0')}:${seconds.padStart(2, '0')}`;
  }
  return timeStr; // Fallback
}

function isActiveLine(line: TimestampedLyric): boolean {
  if (!playerStore.currentTrack || lyrics.value.length === 0) return false;
  
  const currentTimeSeconds = playerStore.currentTime;
  const lineTimeSeconds = parseTimeToSeconds(line.time);
  
  const nextLineIndex = lyrics.value.indexOf(line) + 1;
  if (nextLineIndex < lyrics.value.length) {
    const nextLineTimeSeconds = parseTimeToSeconds(lyrics.value[nextLineIndex].time);
    return currentTimeSeconds >= lineTimeSeconds && currentTimeSeconds < nextLineTimeSeconds;
  }
  // Last line is active if current time is greater or equal
  return currentTimeSeconds >= lineTimeSeconds;
}

function isPastLine(line: TimestampedLyric): boolean {
  if (!playerStore.currentTrack || lyrics.value.length === 0) return false;
  
  const currentTimeSeconds = playerStore.currentTime;
  const lineTimeSeconds = parseTimeToSeconds(line.time);
  
  // A line is 'past' if it's not active and its time is less than current time
  return !isActiveLine(line) && lineTimeSeconds < currentTimeSeconds;
}

function scrollToActiveLine(): void {
  if (!autoScroll.value || !activeLineRef.value || !lyricsContentRef.value) return;
  
  // Scroll the main content area, not the individual line
  const lineTop = activeLineRef.value.offsetTop;
  const lineBottom = lineTop + activeLineRef.value.offsetHeight;
  
  const containerScrollTop = lyricsContentRef.value.scrollTop;
  const containerHeight = lyricsContentRef.value.clientHeight;
  
  // Calculate desired scroll position to center the line
  const desiredScrollTop = lineTop - (containerHeight / 2) + (activeLineRef.value.offsetHeight / 2);

  lyricsContentRef.value.scrollTo({
    top: desiredScrollTop,
    behavior: 'smooth',
  });
}

function toggleAutoScroll(): void {
  autoScroll.value = !autoScroll.value;
  if (autoScroll.value) {
    scrollToActiveLine();
  }
}

async function fetchLyrics(): Promise<void> {
  if (!playerStore.currentTrack?.trackId) {
    lyrics.value = [];
    return;
  }
  
  isLoading.value = true;
  error.value = null;
  
  try {
    console.log(`[FullscreenLyrics Debug] Fetching lyrics for trackId: ${playerStore.currentTrack.trackId}`);
    const response = await fetch(`/api/tracks/${playerStore.currentTrack.trackId}/lyrics`);
    console.log(`[FullscreenLyrics Debug] Response status: ${response.status}, ok: ${response.ok}`);
    
    if (!response.ok) {
      if (response.status === 404) {
        lyrics.value = []; // No lyrics found, not an error for display purposes
        console.log(`[FullscreenLyrics Debug] Lyrics not found (404) for trackId: ${playerStore.currentTrack.trackId}`);
      } else {
        throw new Error(`Failed to fetch lyrics: ${response.statusText} (status: ${response.status})`);
      }
    } else {
      const data = await response.json();
      console.log(`[FullscreenLyrics Debug] Data from response.json():`, data);
      if (data && Array.isArray(data.lyricsJson)) {
        lyrics.value = data.lyricsJson;
        console.log(`[FullscreenLyrics Debug] Lyrics assigned (length: ${lyrics.value.length})`);
      } else {
        console.warn('[FullscreenLyrics Debug] lyricsJson not found or not an array in response:', data);
        lyrics.value = [];
      }
    }
  } catch (err: any) {
    console.error('[FullscreenLyrics Debug] Error fetching lyrics:', err);
    error.value = err.message || 'Could not load lyrics.';
    lyrics.value = [];
  } finally {
    isLoading.value = false;
    await nextTick();
    scrollToActiveLine(); 
  }
}

function seekToLyricTime(line: TimestampedLyric): void {
  if (!playerStore.currentTrack) return;
  const timeInSeconds = parseTimeToSeconds(line.time);
  playerStore.seek(timeInSeconds);
  // Optional: Resume play if paused
  // if (!playerStore.isPlaying) {
  //   playerStore.togglePlayPause();
  // }
}

// --- Generate Lyrics (Example, adapt as needed) ---
async function handleGenerateLyrics(): Promise<void> {
  if (!playerStore.currentTrack?.trackId) return;
  isGenerating.value = true;
  error.value = null;
  try {
    const response = await fetch(`/api/tracks/${playerStore.currentTrack.trackId}/lyrics/generate`, {
      method: 'POST',
    });
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(errorData.message || `Failed to generate lyrics: ${response.statusText}`);
    }
    // Re-fetch lyrics after generation
    await fetchLyrics();
  } catch (err: any) {
    console.error('[FullscreenLyrics Debug] Error generating lyrics:', err);
    error.value = err.message || 'Could not generate lyrics.';
  } finally {
    isGenerating.value = false;
  }
}

// --- Visibility Control & Lifecycle --- 
function closeFullScreenLyrics(): void {
  playerStore.hideFullScreenLyrics(); // We will add this to playerStore
}

watch(() => playerStore.currentTrack?.trackId, (newTrackId: string | undefined | null, oldTrackId: string | undefined | null) => {
  if (newTrackId && newTrackId !== oldTrackId) {
    console.log(`[FullscreenLyrics Debug] Track changed. New ID: ${newTrackId}. Fetching lyrics.`);
    lyrics.value = []; // Clear old lyrics immediately
    error.value = null;
    fetchLyrics();
  } else if (!newTrackId) {
    lyrics.value = [];
    error.value = null;
  }
}, { immediate: true }); // immediate: true to fetch on component load if track already exists

watch(() => playerStore.currentTime, () => {
  if (playerStore.isFullScreenLyricsVisible) { // Only scroll if visible
    scrollToActiveLine();
  }
});

// Watch for visibility to fetch lyrics when component becomes visible
watch(() => playerStore.isFullScreenLyricsVisible, (isVisible: boolean) => {
  if (isVisible && playerStore.currentTrack?.trackId && lyrics.value.length === 0 && !isLoading.value) {
    console.log('[FullscreenLyrics Debug] Component became visible. Fetching lyrics.');
    fetchLyrics();
  }
  if(isVisible){
    nextTick(() => {
        scrollToActiveLine();
    });
  }
});


onMounted(() => {
  // Initial fetch if visible and track exists
  if (playerStore.isFullScreenLyricsVisible && playerStore.currentTrack?.trackId) {
    fetchLyrics();
  }
});

</script>

<style scoped>
.fullscreen-lyrics-container {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.95); /* Dark background */
  color: #fff;
  z-index: 2000; /* High z-index to cover everything */
  display: flex;
  flex-direction: column;
  overflow: hidden; /* Prevent body scroll */
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 15px 20px;
  background-color: rgba(0, 0, 0, 0.8);
  flex-shrink: 0;
}

.track-info .title {
  font-size: 1.2em;
  font-weight: bold;
  margin: 0 0 2px 0;
  color: #fff;
}

.track-info .artist {
  font-size: 0.9em;
  color: #ccc;
  margin: 0;
}

.close-button {
  background: none;
  border: none;
  color: #fff;
  font-size: 1.5em;
  cursor: pointer;
}

.lyrics-content {
  flex-grow: 1;
  overflow-y: auto;
  padding: 20px;
  text-align: center;
}

.lyrics-lines-container {
  display: flex;
  flex-direction: column;
  gap: 12px; /* Space between lyric lines */
}

.lyrics-line {
  padding: 8px 12px;
  border-radius: 6px;
  transition: background-color 0.3s, color 0.3s;
  font-size: 1.1em; /* Slightly larger for mobile */
  line-height: 1.6;
  color: #aaa; /* Default color for non-active lines */
}

.lyrics-line.cursor-pointer {
  cursor: pointer;
}

.lyrics-line.active {
  background-color: rgba(255, 255, 255, 0.2);
  color: #fff; /* Highlight active line */
  font-weight: bold;
}

.lyrics-line.past {
  color: #666; /* Dim past lines */
}

.lyrics-time {
  margin-right: 10px;
  font-size: 0.8em;
  color: #888;
}

.loading-lyrics,
.error-lyrics,
.no-lyrics {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  height: 100%;
  font-size: 1.1em;
}

.no-lyrics button {
  margin-top: 15px;
  padding: 10px 15px;
  background-color: #555;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}
.no-lyrics button:disabled {
  background-color: #333;
  cursor: not-allowed;
}

.controls {
  padding: 10px 20px;
  background-color: rgba(0, 0, 0, 0.8);
  text-align: center;
  flex-shrink: 0;
}

.controls button {
  padding: 8px 15px;
  background-color: #444;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
}

.controls button.active {
  background-color: #666;
}

/* Responsive adjustments if needed */
@media (max-width: 600px) {
  .track-info .title {
    font-size: 1em;
  }
  .track-info .artist {
    font-size: 0.8em;
  }
  .lyrics-line {
    font-size: 1em;
    padding: 6px 10px;
  }
  .header, .lyrics-content, .controls {
    padding: 10px;
  }
}
</style>
