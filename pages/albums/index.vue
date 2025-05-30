<template>
  <div class="w-full h-full p-4 bg-base-200">
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
        :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId"
        :is-loading-this-album="albumIdLoading === album_item.albumId && currentAlbumLoading"
        @card-click="goToAlbum(album_item.albumId)"
        @add-to-playlist="openAddToPlaylistModal"
        @edit-album="handleEditAlbum"
        @play="handleAlbumCardPlayEvent(album_item)" 
      />
    </div>

  </div>

  <!-- Add to Playlist Modal -->
  <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        Add "{{ selectedAlbumForPlaylist?.title }}" to playlist:
      </h3>
      <button 
        @click="isAddToPlaylistModalOpen = false" 
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
      >✕</button>
      
      <div v-if="!playlists.length" class="text-center text-neutral-content italic py-4">
        <p>No playlists found. <NuxtLink to="/playlists" class="link link-primary">Create one?</NuxtLink></p>
      </div>
      <ul v-else class="menu bg-base-100 rounded-box max-h-60 overflow-y-auto">
        <li v-for="playlist in playlists" :key="playlist.playlistId">
          <a @click="addAlbumToPlaylist(playlist.playlistId)">
            {{ playlist.name }}
          </a>
        </li>
      </ul>
      <div class="modal-action">
        <button class="btn btn-ghost" @click="isAddToPlaylistModalOpen = false">Cancel</button>
      </div>
    </div>
    <!-- Click outside to close -->
    <div class="modal-backdrop" @click="isAddToPlaylistModalOpen = false"></div>
  </div>
  
  <!-- Simple Notification Component -->
  <div v-if="notification.visible" 
       class="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md"
       :class="{
         'bg-success text-success-content': notification.type === 'success',
         'bg-error text-error-content': notification.type === 'error',
         'bg-info text-info-content': notification.type === 'info'
       }">
    <div class="flex items-center">
      <Icon 
        :name="notification.type === 'success' ? 'material-symbols:check-circle-outline' : 
              notification.type === 'error' ? 'material-symbols:error-outline' : 
              'material-symbols:info-outline'" 
        class="w-6 h-6 mr-2" />
      <span>{{ notification.message }}</span>
      <button @click="notification.visible = false" class="ml-2 p-1">
        <Icon name="material-symbols:close" class="w-4 h-4" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from '#imports';
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album'; 
import AlbumCard from '~/components/album/album-card.vue'; 
import type { Track } from '~/types/track'; 
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

// --- State for Album Operations ---
const selectedAlbumForPlaylist = ref<Album | null>(null);
const isAddToPlaylistModalOpen = ref<boolean>(false);
const playlists = ref<any[]>([]);
const notification = ref<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({ message: '', type: 'info', visible: false }); 

// --- State for Albums List Display ---
const albums = ref<Album[]>([]);
const loading = ref(true); 
const error = ref<string | null>(null); 
const artistName = ref<string | null>(null); 
const route = useRoute();
const userToken = document ? ref(localStorage.getItem('auth_token')) : useCookie('auth_token').value;

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
    const data = await $fetch<Album[]>('/api/albums', { query: apiQuery.value, headers: { 'Authorization': `Bearer ${userToken.value}` } });
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
  console.log(`[AlbumsIndex] fetchAlbumDetailsById: Fetching details for album ID: ${id}`);
  currentAlbumLoading.value = true;
  albumIdLoading.value = id;
  let fetchedAlbum: Album | null = null;

  try {
    const apiResponse = await $fetch<any>(`/api/albums/${id}`, { headers: { 'Authorization': `Bearer ${userToken.value}` } }); 
    console.log(`[AlbumsIndex] fetchAlbumDetailsById: API response for ${id}:`, apiResponse);
    // await new Promise(resolve => setTimeout(resolve, 1000));
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
      console.warn(`[AlbumsIndex] fetchAlbumDetailsById: No tracks found or invalid response for album ID: ${id}`, apiResponse);
    }
  } catch (err) {
    console.error(`[AlbumsIndex] fetchAlbumDetailsById: Error fetching album ${id}:`, err);
    fetchedAlbum = null; // Ensure it's null on error
  } finally {
    currentAlbumLoading.value = false;
    // albumIdLoading.value = null; // Resetting here might be too soon if multiple clicks happen
  }
  console.log(`[AlbumsIndex] fetchAlbumDetailsById: Returning for ${id}:`, fetchedAlbum);
  return fetchedAlbum;
}

// Function to play a specific album from the list
const playAlbum = async (albumId: string): Promise<void> => {
  console.log(`[AlbumsIndex] playAlbum: Attempting to play album ID: ${albumId}`);
  if (!albumId) {
    console.warn('[AlbumsIndex] playAlbum: albumId is null or undefined.');
    return;
  }

  let albumDataForPlayback: Album | null = null;

  // Check if the clicked album is already the one stored in currentAlbum
  if (currentAlbum.value && currentAlbum.value.albumId === albumId) {
    albumDataForPlayback = currentAlbum.value;
  } else {
    if (playerStore.isPlaying && playerStore.currentTrack?.albumId !== albumId) {
      playerStore.togglePlayPause(); // Pause if a *different* album is playing
    }
    // Add a 1-second delay before fetching
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

// New handler for the 'play' event from AlbumCard
const handleAlbumCardPlayEvent = (album: Album): void => {
  console.log(`[AlbumsIndex] handleAlbumCardPlayEvent: Received play event for album:`, album);
  if (album && album.albumId) {
    playAlbum(album.albumId);
  } else {
    console.error('[AlbumsIndex] handleAlbumCardPlayEvent: Album or albumId is missing.', album);
  }
};

// Navigation function
const goToAlbum = (albumId: string): void => {
  navigateTo(`/albums/${albumId}`);
};

// Simple notification system
const showNotification = (message: string, type: 'success' | 'error' | 'info' = 'info'): void => {
  notification.value = { message, type, visible: true };
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.value.visible = false;
  }, 3000);
};

// Fetch user's playlists
async function fetchPlaylists(): Promise<void> {
  try {
    const data = await $fetch<any[]>('/api/playlists', { headers: { 'Authorization': `Bearer ${userToken.value}` } });
    playlists.value = data;
  } catch (e: unknown) {
    console.error('Error fetching playlists:', e);
    showNotification('Could not load your playlists.', 'error');
    playlists.value = []; // Ensure it's an empty array on error
  }
}

// Open the Add to Playlist modal
const openAddToPlaylistModal = (album: Album): void => {
  selectedAlbumForPlaylist.value = album;
  isAddToPlaylistModalOpen.value = true;
  fetchPlaylists(); 
};

// Add all album tracks to a playlist
const addAlbumToPlaylist = async (playlistId: string): Promise<void> => {
  if (!selectedAlbumForPlaylist.value?.tracks || selectedAlbumForPlaylist.value.tracks.length === 0) {
    // If tracks aren't loaded in the album object, fetch them first
    const albumWithTracks = await fetchAlbumDetailsById(selectedAlbumForPlaylist.value!.albumId);
    if (!albumWithTracks?.tracks || albumWithTracks.tracks.length === 0) {
      showNotification('Could not load album tracks', 'error');
      isAddToPlaylistModalOpen.value = false;
      selectedAlbumForPlaylist.value = null;
      return;
    }
    selectedAlbumForPlaylist.value = albumWithTracks;
  }
  
  const trackIds = selectedAlbumForPlaylist.value.tracks.map((track: any) => track.trackId);
  await addTracksToPlaylist(playlistId, trackIds);
};

// Generic function to add tracks to a playlist
const addTracksToPlaylist = async (playlistId: string, trackIds: string[]): Promise<void> => {
  if (!trackIds.length) return;
  
  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      headers: { 'Authorization': `Bearer ${userToken.value}` },
      method: 'POST',
      body: {
        action: 'add',
        trackIds,
      },
    });
    showNotification(`Added to playlist successfully`, 'success');
    isAddToPlaylistModalOpen.value = false;
    selectedAlbumForPlaylist.value = null;
  } catch (e: unknown) {
    console.error('Error adding tracks to playlist:', e);
    const errorMessage = e && typeof e === 'object' && 'data' in e && e.data && typeof e.data === 'object' && 'message' in e.data ? 
      String(e.data.message) : 'Failed to add to playlist.';
    showNotification(errorMessage, 'error');
  }
};

// Placeholder function for editing an album
const handleEditAlbum = (album: Album): void => {
  showNotification(`Edit functionality for "${album.title}" is not yet implemented.`, 'info');
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
.album-play-button-hover-effect {
  opacity: 0;
  pointer-events: none;
  transition: opacity 200ms ease-in-out;
}

/* Targets the button when the AlbumCard (which has .group) is hovered */
:deep(.group:hover) .album-play-button-hover-effect {
  opacity: 1;
  pointer-events: auto;
}
</style>