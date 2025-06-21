<template>
  <div class="w-full h-full p-4 bg-base-200">
    <!-- Top Bar: Search + Sort + User -->
    <div class="flex justify-between items-center mb-2 sticky top-0  backdrop-blur py-2 z-10">
       <div class="form-control">
         <input 
           type="text" 
           placeholder="Search Albums by Title..." 
           class="input input-bordered w-72 md:w-96" 
           v-model="searchQuery" 
         />
       </div>
      <div class="flex items-center gap-4">
        <select class="select select-bordered select-sm">
          <option disabled selected>Sorted By: A-Z</option>
          <option>Date Added</option>
          <option>Most Played</option>
          <option>Release Year</option>
        </select>
         <button class="btn btn-ghost btn-circle">
           <Icon name="material-symbols:settings-outline" class="w-6 h-6" />
         </button>
         <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
              <div class="w-10 rounded-full">
                <img alt="User Avatar" src="" />
              </div>
            </div>
            <ul tabindex="0" class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li><NuxtLink to="/settings">Settings</NuxtLink></li>
               <li><hr class="my-1" /></li>
              <li><a>Logout</a></li>
            </ul>
          </div>
      </div>
    </div>

    <!-- Genre Filter Tags -->
    <div class="mt-0 mb-4 flex flex-wrap gap-2 items-center sticky top-[68px] bg-base-200/80 backdrop-blur py-2 z-10">
      <span class="text-sm font-semibold mr-2">Genres:</span>
      <button 
        class="btn btn-xs"
        :class="{ 'btn-active btn-primary': selectedGenre === null }" 
        @click="selectedGenre = null"
      >
        All Genres
      </button>
      <div v-if="pendingGenres" class="text-sm">Loading genres...</div>
      <div v-else-if="genresError" class="text-error text-sm">Error loading genres</div>
      <button 
        v-else 
        v-for="genre in genres" 
        :key="genre"
        class="btn btn-xs btn-ghost"
        :class="{ 'btn-active btn-primary': selectedGenre === genre }" 
        @click="selectedGenre = genre"
      >
        {{ genre.name }}
      </button>
    </div>

    <!-- Album Grid -->
    <div v-if="pendingAlbums" class="text-center py-10">
       <span class="loading loading-spinner loading-lg"></span>
    </div>
     <div v-else-if="albumsError" class="alert alert-error">
        <Icon name="mdi:alert-circle-outline" class="w-6 h-6" />
        <span>Error loading albums: {{ albumsError.message }}</span>
     </div>
     <div v-else-if="albums && albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
        <AlbumCard 
          v-for="album_item in albums" 
          :key="album_item.albumId" 
          :album="album_item"
          :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId"
          :is-loading-this-album="albumIdLoading === album_item.albumId && currentAlbumLoading"
          @card-click="navigateToAlbum(album_item.albumId)"
          @add-to-playlist="openAddToPlaylistModal"
          @edit-album="handleEditAlbum"
          @play="handleAlbumPlayEvent"
        />
     </div>
     <div v-else class="text-center text-gray-500 py-10">
        No albums found in the library. Add media folders in Settings.
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

   <!-- Global Audio Player Placeholder - To be implemented in layout -->
   <!-- <AudioPlayer /> -->
</template>

<script setup lang="ts">
import { ref, computed, watch } from '#imports'
import { usePlayerStore } from '~/stores/player';
import { useTrackArtists } from '~/composables/useTrackArtists';
import { useCoverArt } from '~/composables/use-cover-art';
import type { Track } from '~/types/track'; // Update import path for Track type
import AlbumCard from '~/components/album/album-card.vue'; 
import { useRouter } from 'vue-router'; 
import type { Album } from '~/types/album';
import type { TrackArtistDetail } from '~/types/track';
import type { Playlist } from '~/types/playlist';

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

const playerStore = usePlayerStore(); 
// Refs for play button loading state (similar to pages/albums/index.vue)
const currentAlbumLoading = ref<boolean>(false);
const albumIdLoading = ref<string | null>(null);

// State for Album Operations
const selectedAlbumForPlaylist = ref<Album | null>(null);
const isAddToPlaylistModalOpen = ref<boolean>(false);
const playlists = ref<Playlist[]>([]);
const notification = ref<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({ message: '', type: 'info', visible: false });

// Search State
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimer: NodeJS.Timeout | null = null;

// Genre Filter State
const selectedGenre = ref<string | null>(null);

// Fetch Genres
const { data: genres, pending: pendingGenres, error: genresError } = useLazyFetch<string[]>('/api/genres');

watch(genres, (newGenres: string[]) => {
  if (newGenres) {
    useSeoMeta({
      title: usePageTitle('Genres')
    });
    genres.value = newGenres;
  }
});

if (genres.value) {
  useSeoMeta({
    title: usePageTitle('Genres')
  });
  genres.value = genres.value;
}

watch(searchQuery, (newValue: string) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newValue.trim();
  }, 300); // 300ms debounce
});

// Fetch Albums - Now using the computed apiUrl
const { 
  data: albums, 
  pending: pendingAlbums,
  error: albumsError, 
} = useLazyFetch<Album[]>('/api/albums');

watch(albums, (newAlbums: Album[]) => {
  if (newAlbums) {
    useSeoMeta({
      title: usePageTitle('Library')
    });

    albums.value = newAlbums;
  }
});

if (albums.value) {
  useSeoMeta({
    title: usePageTitle('Library')
  });
}
// --- Event Handler for AlbumCard's @play event ---
const handleAlbumPlayEvent = async (album: Album): Promise<void> => {
  console.log(`[LibraryPage] handleAlbumPlayEvent: Received play event for album:`, album);
  if (!album || !album.albumId) {
    console.warn('[LibraryPage] handleAlbumPlayEvent: Invalid album data received.');
    showNotification('Cannot play album: invalid data.', 'error');
    return;
  }

  // Call the existing playAlbum logic, now with the full album object or just its ID
  // If playAlbum is adapted to take an Album object, that's cleaner.
  // For now, let's assume playAlbum still primarily works off albumId and fetches details if needed.
  await playAlbum(album.albumId); 
};

// --- Play Album Functionality ---
const playAlbum = async (albumId: string): Promise<void> => {
  console.log(`[LibraryPage] playAlbum: Attempting to play album ID: ${albumId}`);
  if (!albumId) {
    console.warn('[LibraryPage] playAlbum: albumId is null or undefined.');
  }
  // Case 1: The clicked album is already the current one in the player.
  // This means its tracks are in the queue, and one of them is currentTrack.
  if (playerStore.currentTrack?.albumId === albumId) {
    playerStore.togglePlayPause(); // Just toggle play/pause for the current track.
    return;
  }

  // Case 2: The clicked album's tracks are already loaded in the queue,
  // but it's not the currentTrack's album.
  // We want to play the *first* track of this album from the existing queue.
  if (playerStore.queue.length > 0 && playerStore.queue[0].albumId === albumId) {
    // If the currentTrack is null or from a different album, but the queue is for this album,
    // play the first track from the queue.
    if (!playerStore.currentTrack || playerStore.currentTrack.albumId !== albumId) {
        playerStore.playFromQueue(0); 
    } else {
        // This case implies currentTrack.albumId IS albumId, which should be caught by Case 1.
        // However, as a fallback or if logic gets more complex, explicitly toggle.
        playerStore.togglePlayPause();
    }
    return;
  }

  // Case 3: The album is not loaded in the player (neither currentTrack nor queue matches).
  // Proceed to fetch, load queue, and play.
  albumIdLoading.value = albumId;
  currentAlbumLoading.value = true;

  // Add a 2-second delay before fetching
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find the album from the main list (used for quick display, not for player data if fetching)
  const albumListItem = albums.value?.find((album: Album) => album.albumId === albumId);
  if (!albumListItem) {
    console.error(`Album with ID ${albumId} not found in the current list.`);
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
    return;
  }

  try {
    // Fetch full album details including tracks directly from the album API endpoint
    const albumDetails = await $fetch<any>(`/api/albums/${albumId}`);

    if (!albumDetails || !albumDetails.tracks || albumDetails.tracks.length === 0) {
      console.warn(`No tracks found for album ${albumId}`);
      playerStore.loadQueue([]); // Clear queue or handle as appropriate
      albumIdLoading.value = null;
      currentAlbumLoading.value = false;
      return;
    }

    // Get the track artists formatter
    const { getFormattedTrackArtists } = useTrackArtists();
    
    // Map the tracks from the album details to the format expected by the player
    const tracksForQueue: Track[] = albumDetails.tracks.map((track: any) => {
      // Get primary artist name from track artists if available
      const artists = track.artists || [];
      const primaryArtistName = artists.length > 0
        ? artists.find((a: TrackArtistDetail) => a.isPrimaryArtist)?.name || artists[0].name
        : 'Unknown Artist';
        
      return {
        trackId: track.trackId,
        title: track.title ?? 'Unknown Track',
        artistName: primaryArtistName,
        albumTitle: track.albumTitle ?? albumDetails.title ?? 'Unknown Album',
        filePath: track.filePath,
        duration: track.duration ?? 0,
        albumId: albumDetails.albumId,
        trackNumber: track.trackNumber ?? null,
        coverPath: track.coverPath || albumDetails.coverPath,
        formattedArtists: getFormattedTrackArtists(artists),
      };
    });

    // New album data fetched, load it into the queue and play the first track.
    playerStore.loadQueue(tracksForQueue);
    playerStore.playFromQueue(0);

  } catch (err) {
    console.error(`Error fetching or playing album ${albumId}:`, err);
    // Optionally, show a user-facing error notification
  } finally {
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
  }
};

// --- Navigate to Album Detail Page ---
const navigateToAlbum = (albumId: string): void => {
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
    const data = await $fetch<Playlist[]>('/api/playlists');
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
  if (!selectedAlbumForPlaylist.value) return;
  
  // Check if tracks are already loaded
  let trackIds: string[] = [];
  if (selectedAlbumForPlaylist.value.tracks && selectedAlbumForPlaylist.value.tracks.length > 0) {
    trackIds = selectedAlbumForPlaylist.value.tracks.map((track: Track) => track.trackId);
  } else {
    // If tracks aren't loaded in the album object, we need to fetch them first
    // This would involve implementing a fetchAlbumWithTracks function similar to playAlbum
    showNotification('Loading album tracks...', 'info');
    // Call existing loadAlbum function that's already part of the playAlbum workflow
    const albumWithTracks = await loadAlbum(selectedAlbumForPlaylist.value.albumId);
    if (!albumWithTracks?.tracks || albumWithTracks.tracks.length === 0) {
      showNotification('Could not load album tracks', 'error');
      isAddToPlaylistModalOpen.value = false;
      selectedAlbumForPlaylist.value = null;
      return;
    }
    trackIds = albumWithTracks.tracks.map((track: Track) => track.trackId);
  }
  
  await addTracksToPlaylist(playlistId, trackIds);
};

// Generic function to add tracks to a playlist
const addTracksToPlaylist = async (playlistId: string, trackIds: string[]): Promise<void> => {
  if (!trackIds.length) return;
  
  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
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

// Helper function to load an album with its tracks (extracted from playAlbum logic)
async function loadAlbum(albumId: string): Promise<Album | null> {
  try {
    // Directly fetch from the API endpoint that returns a single album with tracks
    const apiResponse = await $fetch<Album>(`/api/albums/${albumId}`);
    
    // Process the album response
    if (apiResponse && apiResponse.tracks) {
      // Get the track artists formatter
      const { getFormattedTrackArtists } = useTrackArtists();
      
      // Process tracks to ensure they have the correct artist information
      apiResponse.tracks = apiResponse.tracks.map((track: Track) => {
        // Get primary artist name from track artists if available
        const artists = track.artists || [];
        const primaryArtistName = artists.length > 0
          ? artists.find((a: TrackArtistDetail) => a.isPrimaryArtist)?.name || artists[0].name
          : 'Unknown Artist';
          
        return {
          ...track,
          artistName: primaryArtistName,
          formattedArtists: getFormattedTrackArtists(artists),
        };
      });
      
      return apiResponse;
    }
    return null;
  } catch (error) {
    console.error(`[LibraryPage] loadAlbum: Error fetching album ${albumId}:`, error);
    return null;
  }
}

// Placeholder function for editing an album
const handleEditAlbum = (album: Album): void => {
  showNotification(`Edit functionality for "${album.title}" is not yet implemented.`, 'info');
};

// Define page meta if needed
// definePageMeta({ middleware: 'auth' }); // Uncomment if auth middleware is ready

</script>

<style scoped>
/* Add scrollbar styling if needed */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--b3)) transparent; /* Adjust colors as needed */
}
/* For Webkit browsers */
.scrollbar-thin::-webkit-scrollbar {
  width: 8px;
  height: 8px; /* For horizontal scroll */
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: oklch(var(--b3)); /* Adjust color */
  border-radius: 4px;
  border: 2px solid transparent; /* Creates padding around thumb */
  background-clip: content-box;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: oklch(var(--b1)); /* Adjust hover color */
}
</style>
