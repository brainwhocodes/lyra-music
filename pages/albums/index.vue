<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Albums {{ artistName ? `by ${artistName}` : '' }}</h1>

    <div v-if="loading" class="text-center">
      <span class="loading loading-lg loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Error loading albums: {{ error }}</span>
    </div>

    <div v-else-if="albums.length === 0" class="text-center text-gray-500">
      No albums found{{ artistName ? ` for ${artistName}` : '' }}.
    </div>

    <!-- Album List/Grid -->
    <div v-else class="relative grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 h-[calc(350px)] gap-4">
      <AlbumCard
        v-for="album_item in albums"
        :key="album_item.albumId"
        :album="{
          albumId: album_item.albumId,
          title: album_item.title,
          artistName: album_item.artistName,
          coverPath: album_item.coverPath,
          year: album_item.year,
          artistId: album_item.artistId,
          tracks: album_item.tracks
        }"
        @card-click="goToAlbum(album_item.albumId)"
      >
        <template #image-overlay>
          <button 
            @click.stop="playAlbum(album_item.albumId)" 
            :title="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId ? 'Pause Album' : 'Play Album'" 
            class="album-play-button w-12 h-12 flex items-center justify-center rounded-full hover:brightness-90 focus:outline-none pointer-events-auto" 
            style="background-color: #FF6347; position: absolute; bottom: 0.5rem; right: 0.5rem; z-index: 10;" 
          >
            <Icon name="material-symbols:progress-activity" class="w-8! h-8! animate-spin text-white" v-if="albumIdLoading === album_item.albumId && currentAlbumLoading" />
            <Icon name="material-symbols:play-arrow-rounded" 
              v-else-if="!playerStore.isPlaying || playerStore.currentTrack?.albumId !== album_item.albumId" 
              class="w-8! h-8! text-white" />
            <Icon name="material-symbols:pause-rounded" v-else class="w-8! h-8! text-white" />
          </button>
        </template>
        <template #artist>
          <p class="text-xs truncate" :title="album_item.artistName || 'Unknown Artist'">{{ album_item.artistName || 'Unknown Artist' }}</p>
        </template>
        <template #actions>
          <p class="text-xs text-gray-500 w-full text-left">{{ album_item.year || '' }}</p>
        </template>
      </AlbumCard>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore, type Track } from '~/stores/player';
import type { Album } from '~/types/album'; 
import AlbumCard from '~/components/album/album-card.vue'; 
import { useCoverArt } from '~/composables/use-cover-art'; 

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

const playerStore = usePlayerStore();
const { getCoverArtUrl } = useCoverArt(); 

// --- State for Album Details and Playback ---
const currentAlbum = ref<Album | null>(null); 
const currentAlbumLoading = ref<boolean>(false);
const albumIdLoading = ref<string | null>(null); 

// --- State for Albums List Display ---
const albums = ref<Album[]>([]);
const loading = ref(true); 
const error = ref<string | null>(null); 
const artistName = ref<string | null>(null); 
const route = useRoute();

// Computed property for API query parameters for fetching the albums list
const apiQuery = computed(() => {
  const query: { artistId?: string } = {};
  if (route.query.artistId) {
    query.artistId = route.query.artistId as string;
  }
  return query;
});

// Fetch albums list function
async function fetchAlbums() {
  loading.value = true;
  error.value = null;
  artistName.value = null; 
  try {
    const data = await $fetch<Album[]>('/api/albums', { query: apiQuery.value });
    albums.value = data;
    if (apiQuery.value.artistId && data.length > 0 && data[0].artistName) {
        artistName.value = data[0].artistName;
    }
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to load albums.';
  } finally {
    loading.value = false;
  }
}

// New function to fetch and map album details for playback
async function fetchAlbumDetailsById(id: string): Promise<Album | null> {
  currentAlbumLoading.value = true;
  albumIdLoading.value = id;
  let fetchedAlbum: Album | null = null;

  try {
    const apiResponse = await $fetch<any>(`/api/albums/${id}`); 

    if (apiResponse && Array.isArray(apiResponse.tracks) && apiResponse.tracks.length > 0) {
      const tracksForPlayer: Track[] = apiResponse.tracks.map((t: any) => ({
        trackId: t.trackId, 
        title: t.title ?? 'Unknown Track',
        artistName: t.artistName ?? apiResponse.artistName ?? 'Unknown Artist',
        albumTitle: t.albumTitle ?? apiResponse.title ?? 'Unknown Album',
        filePath: t.filePath,
        duration: t.duration ?? 0,
        coverPath: apiResponse.coverPath, 
        albumId: apiResponse.albumId, 
        artistId: apiResponse.artistId ?? '', 
        trackNumber: t.trackNumber ?? null,
      }));
      fetchedAlbum = {
        albumId: apiResponse.albumId, 
        title: apiResponse.title,
        year: apiResponse.year,
        coverPath: apiResponse.coverPath,
        artistId: apiResponse.artistId ?? '',
        artistName: apiResponse.artistName ?? 'Unknown Artist',
        tracks: tracksForPlayer,
      };
    } else {
      // Potentially handle case where no tracks are found more explicitly if needed
    }
  } catch (err) {
    fetchedAlbum = null; // Ensure it's null on error
  } finally {
    currentAlbumLoading.value = false;
  }
  return fetchedAlbum;
}

// Function to play a specific album from the list
const playAlbum = async (albumId: string): Promise<void> => {
  let albumDataForPlayback: Album | null = null;

  // Check if the clicked album is already the one stored in currentAlbum
  if (currentAlbum.value && currentAlbum.value.albumId === albumId) {
    albumDataForPlayback = currentAlbum.value;
  } else {
    if (playerStore.isPlaying && playerStore.currentTrack?.albumId !== albumId) {
      playerStore.togglePlayPause(); // Pause if a *different* album is playing
    }
    const newlyFetchedAlbum = await fetchAlbumDetailsById(albumId);
    currentAlbum.value = newlyFetchedAlbum; // Cache the newly fetched album details
    albumDataForPlayback = newlyFetchedAlbum;
  }

  if (!albumDataForPlayback || !albumDataForPlayback.tracks || albumDataForPlayback.tracks.length === 0) {
    return; 
  }

  const trackIndex = 0; // Play from the first track
  const trackToPlay = albumDataForPlayback.tracks[trackIndex];

  // If the exact same track is already current and playing, toggle pause. If paused, play.
  if (playerStore.currentTrack?.trackId === trackToPlay.trackId) {
    playerStore.togglePlayPause();
    return;
  }

  // Check if the queue needs to be reloaded (i.e., different album)
  const playerQueueAlbumId = playerStore.queue.length > 0 ? playerStore.queue[0].albumId : null;
  if (playerQueueAlbumId !== albumDataForPlayback.albumId) {
    playerStore.loadQueue(albumDataForPlayback.tracks);
  }
  
  playerStore.playFromQueue(trackIndex);
};

// Navigation function
const goToAlbum = (albumId: string): void => {
  navigateTo(`/albums/${albumId}`);
};

// Fetch albums on component mount and when query (e.g., artistId) changes
onMounted(() => {
  fetchAlbums();
});

watch(() => route.query.artistId, () => {
    fetchAlbums();
}, { immediate: false }); 

</script>

<style scoped>
.card-title {
    white-space: normal; 
    overflow-wrap: break-word;
}
.album-play-button {
    cursor: pointer;  
}
</style>