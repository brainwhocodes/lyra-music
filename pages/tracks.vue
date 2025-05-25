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
            <th class="w-16"></th>
          </tr>
        </thead>
        <tbody>
          <tr 
            v-for="track in tracks" 
            :key="track.trackId" 
            class="hover"
            >
            <td>{{ track.trackNumber || '-' }}</td>
            <td>{{ track.title }}</td>
            <td v-if="!albumId">{{ track.albumTitle || 'Unknown Album' }}</td>
            <td v-if="!artistId">{{ track.artistName || 'Unknown Artist' }}</td>
            <td class="text-right">{{ formatDuration(track.duration) }}</td>
            <td>
              <button 
                class="btn btn-ghost btn-xs btn-circle"
                @click.stop="playTrack(track)" 
                title="Play track"
              >
                 <Icon name="material-symbols:play-arrow-rounded" class="w-5 h-5" />
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { usePlayerStore } from '~/stores/player';
import { ref, onMounted, computed, watch } from '#imports';
import type { Track } from '~/types/track'; 
import type { QueueContext } from '~/stores/player'; 

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Interface for the raw API response
interface ApiTrack {
  id: string;
  title: string;
  trackNumber: number | null;
  duration: number | null;
  path: string;
  genre: string | null;
  albumId: string | null;
  albumTitle: string | null;
  albumArtPath: string | null;
  artistId: string | null;
  artistName: string | null;
}

// Interface for tracks used in this component, extending global Track for player compatibility
interface DisplayTrack extends Track {
  trackNumber: number | null;
  coverPath: string | null;
  // Add other ApiTrack fields if needed for display but not in global Track
}

const route = useRoute();
const playerStore = usePlayerStore();

// State
const tracks = ref<DisplayTrack[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const artistName = ref<string | null>(null); 
const albumTitle = ref<string | null>(null); 

// Computed property for API query parameters
const apiQuery = computed(() => {
  const query: { artistId?: string; albumId?: string } = {};
  if (route.query.artistId) {
    query.artistId = String(route.query.artistId);
  }
  if (route.query.albumId) {
    query.albumId = String(route.query.albumId);
  }
  return query;
});

// Computed properties for easy access
const artistId = computed(() => apiQuery.value.artistId);
const albumId = computed(() => apiQuery.value.albumId);

// Fetch tracks function
async function fetchTracks() {
  loading.value = true;
  error.value = null;
  artistName.value = null; 
  albumTitle.value = null;
  try {
    const data = await $fetch<ApiTrack[]>('/api/tracks', { query: apiQuery.value });
    
    // Map ApiTrack to DisplayTrack (which includes global Track properties)
    tracks.value = data.map((apiTrack: ApiTrack): DisplayTrack => ({
      trackId: String(apiTrack.id),
      title: apiTrack.title,
      artistName: apiTrack.artistName || undefined,
      albumId: apiTrack.albumId || '', // Provide empty string if null, to satisfy 'string' type
      albumTitle: apiTrack.albumTitle || undefined,
      duration: apiTrack.duration ? Number(apiTrack.duration) : 0,
      filePath: apiTrack.path,
      coverPath: apiTrack.albumArtPath || '',
      artistId: apiTrack.artistId, // apiTrack.artistId is string | null, target Track.artistId is string | null
      // DisplayTrack specific fields
      trackNumber: apiTrack.trackNumber,
    }));

    if (tracks.value.length > 0) {
        if (albumId.value) {
            albumTitle.value = tracks.value[0].albumTitle || null; 
            artistName.value = tracks.value[0].artistName || null; 
        } else if (artistId.value) {
            artistName.value = tracks.value[0].artistName || null;
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
  // Watcher with immediate: true will call fetchTracks on mount
});

watch(() => route.query, () => {
    fetchTracks();
}, { immediate: true, deep: true });


// Play track using the Pinia store
function playTrack(track: DisplayTrack) {
  let context: QueueContext;
  const currentTrackId = String(track.trackId); 

  if (albumId.value) {
    context = { type: 'album', id: String(albumId.value), name: albumTitle.value || 'Album' };
  } else if (artistId.value) {
    context = { type: 'artist', id: String(artistId.value), name: artistName.value || 'Artist' };
  } else {
    context = { type: 'all_tracks', id: 'filtered_view', name: 'Current Tracks' };
  }
  
  const trackIndexInQueue = tracks.value.findIndex((t: DisplayTrack) => t.trackId === track.trackId);

  if (trackIndexInQueue !== -1) {
    // The 'tracks.value' (DisplayTrack[]) needs to be compatible with the PlayerStore's Track[]
    // Assuming the mapping done in fetchTracks ensures compatibility.
    playerStore.loadQueue(tracks.value as unknown as import('~/stores/player').Track[], context);
    playerStore.playFromQueue(trackIndexInQueue);
  } else {
    console.error('Track not found in current list for playback:', track);
  }
}

</script>

<style scoped>
/* Add any page-specific styles here if needed */
</style>
