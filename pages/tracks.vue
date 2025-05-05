<template>
  <div class="container mx-auto p-4">
    <!-- Dynamic Title based on filtering -->
    <h1 class="text-3xl font-bold mb-2">Tracks</h1>
    <h2 v-if="albumTitle" class="text-xl text-gray-500 mb-4">From Album: {{ albumTitle }} {{ artistName ? `by ${artistName}` : '' }}</h2>
    <h2 v-else-if="artistName" class="text-xl text-gray-500 mb-4">By Artist: {{ artistName }}</h2>
    
    <div v-if="loading" class="text-center">
      <span class="loading loading-lg loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Error loading tracks: {{ error }}</span>
    </div>

    <div v-else-if="tracks.length === 0" class="text-center text-gray-500">
      No tracks found for this selection.
    </div>

    <!-- Tracks Table -->
    <div v-else class="overflow-x-auto">
      <table class="table w-full table-zebra">
        <thead>
          <tr>
            <th class="w-10">#</th>
            <th>Title</th>
            <th v-if="!albumId">Album</th> 
            <th v-if="!artistId">Artist</th>
            <th class="text-right">Duration</th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="track in tracks" 
            :key="track.id" 
            class="hover cursor-pointer"
            @click="playTrack(track)"
            >
            <td>{{ track.trackNumber || '-' }}</td>
            <td>{{ track.title }}</td>
            <td v-if="!albumId">{{ track.albumTitle || 'Unknown Album' }}</td>
            <td v-if="!artistId">{{ track.artistName || 'Unknown Artist' }}</td>
            <td class="text-right">{{ formatDuration(track.duration) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute } from 'vue-router';
import { usePlayerState } from '~/composables/usePlayerState';

// Define type for track data
interface Track {
  id: number;
  title: string;
  trackNumber: number | null;
  duration: number | null;
  path: string;
  genre: string | null;
  albumId: number | null;
  albumTitle: string | null;
  albumArtPath: string | null;
  artistId: number | null;
  artistName: string | null;
}

const route = useRoute();
const { setTrack } = usePlayerState();

// State
const tracks = ref<Track[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const artistName = ref<string | null>(null); // To display if filtering
const albumTitle = ref<string | null>(null); // To display if filtering

// Computed property for API query parameters
const apiQuery = computed(() => {
  const query: { artistId?: number; albumId?: number } = {};
  if (route.query.artistId) {
    query.artistId = Number(route.query.artistId);
  }
  if (route.query.albumId) {
    query.albumId = Number(route.query.albumId);
  }
  return query;
});

// Computed properties for easy access in template
const artistId = computed(() => apiQuery.value.artistId);
const albumId = computed(() => apiQuery.value.albumId);

// Fetch tracks function
async function fetchTracks() {
  loading.value = true;
  error.value = null;
  artistName.value = null; // Reset context titles
  albumTitle.value = null;
  try {
    const data = await $fetch<Track[]>('/api/tracks', { query: apiQuery.value });
    tracks.value = data;
    // If results exist, grab the context (artist/album name)
    if (data.length > 0) {
        if (albumId.value) {
            albumTitle.value = data[0].albumTitle;
            artistName.value = data[0].artistName; // Album view implies single artist
        } else if (artistId.value) {
            artistName.value = data[0].artistName;
        }
    }
  } catch (err: any) {
    console.error('Error fetching tracks:', err);
    error.value = err.data?.message || err.message || 'Failed to load tracks.';
  } finally {
    loading.value = false;
  }
}

// Fetch tracks on component mount and when query changes
onMounted(() => {
  fetchTracks();
});

watch(() => route.query, () => {
    fetchTracks();
}, { immediate: true, deep: true }); // Use deep: true for query objects

// Format duration (seconds to MM:SS)
function formatDuration(seconds: number | null): string {
  if (seconds === null || isNaN(seconds) || seconds < 0) {
    return '--:--';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

// Placeholder for playing a track (to be implemented with player state)
function playTrack(track: Track) {
  console.log('TracksPage: Calling setTrack for -', track.title);
  setTrack(track); // Use the composable function
}

</script>

<style scoped>
/* Add any page-specific styles here if needed */
</style>
