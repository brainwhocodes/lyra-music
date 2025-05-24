<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album';
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import type { MessageType } from '~/types/message-type';
import type { NotificationMessage } from '~/types/notification-message';
import TrackItem from '~/components/track/track-item.vue';
const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => route.params.id as string);

// State for "Add to Playlist" functionality
const playlists = ref<Playlist[]>([]);
const selectedTrackForPlaylist = ref<Track | null>(null);
const isAddToPlaylistModalOpen = ref(false);
const openMenuForTrackId = ref<string | null>(null);
const showAlbumMenu = ref(false);
const notification = ref<NotificationMessage>({ message: '', type: 'info', visible: false });

// Simple notification system
const showNotification = (message: string, type: MessageType = 'info') => {
  notification.value = { message, type, visible: true };
  // Auto-hide after 3 seconds
  setTimeout(() => {
    notification.value.visible = false;
  }, 3000);
};

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Fetch album details
const { data: album, pending, error } = await useLazyFetch<Album>(`/api/albums/${albumId.value}`, {
  server: false,
});

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

// Call fetchPlaylists when the component is mounted
onMounted(() => {
  fetchPlaylists();
});

// Function to open the "Add to Playlist" modal
const openAddToPlaylistModal = (track: Track): void => {
  selectedTrackForPlaylist.value = track;
  isAddToPlaylistModalOpen.value = true;
  fetchPlaylists(); 
};

// Function to add the selected track to a chosen playlist
const addTrackToPlaylist = async (playlistId: string): Promise<void> => {
  if (!selectedTrackForPlaylist.value) return;
  
  const trackId = selectedTrackForPlaylist.value.trackId;
  const trackTitle = selectedTrackForPlaylist.value.title;
  await addTracksToPlaylist(playlistId, [trackId], `Track "${trackTitle}" added to playlist.`);
  
  isAddToPlaylistModalOpen.value = false;
  selectedTrackForPlaylist.value = null;
};

// Toggle the track menu
const toggleTrackMenu = (trackId: string, event?: Event): void => {
  if (event) {
    event.stopPropagation();
  }
  
  if (openMenuForTrackId.value === trackId) {
    openMenuForTrackId.value = null;
  } else {
    openMenuForTrackId.value = trackId;
    showAlbumMenu.value = false; // Close album menu when opening track menu
  }
};

// Toggle the album menu
const toggleAlbumMenu = (event?: Event): void => {
  if (event) {
    event.stopPropagation();
  }
  
  showAlbumMenu.value = !showAlbumMenu.value;
  if (showAlbumMenu.value) {
    openMenuForTrackId.value = null; // Close track menu when opening album menu
  }
};

// Function to add all album tracks to a playlist
const addAlbumToPlaylist = (playlistId: string): void => {
  if (!album.value?.tracks || album.value.tracks.length === 0) return;
  
  const trackIds = album.value.tracks.map((track: Track) => track.trackId);
  addTracksToPlaylist(playlistId, trackIds, `Album "${album.value.title}" added to playlist.`);
  showAlbumMenu.value = false;
};

// Generic function to add tracks to a playlist
const addTracksToPlaylist = async (playlistId: string, trackIds: string[], successMessage: string): Promise<void> => {
  if (!trackIds.length) return;

  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: {
        action: 'add',
        trackIds,
      },
    });
    showNotification(successMessage, 'success');
  } catch (e: unknown) {
    console.error('Error adding tracks to playlist:', e);
    const errorMessage = e && typeof e === 'object' && 'data' in e && e.data && typeof e.data === 'object' && 'message' in e.data ? 
      String(e.data.message) : 'Failed to add to playlist.';
    showNotification(errorMessage, 'error');
  }
};

// Close all menus when clicking elsewhere
onMounted(() => {
  document.addEventListener('click', () => {
    openMenuForTrackId.value = null;
    showAlbumMenu.value = false;
  });
});

// Handle track options from TrackItem component
const handleTrackOptions = (options: { action: string; track: Track }): void => {
  const { action, track } = options;
  
  switch (action) {
    case 'add-to-playlist':
      openAddToPlaylistModal(track);
      break;
    case 'edit-track':
      // Placeholder for edit track functionality
      console.log('Attempting to edit track:', track);
      showNotification(`Edit functionality for "${track.title}" is not yet implemented.`, 'info');
      break;
  }
  
  // Close any open menus
  openMenuForTrackId.value = null;
  showAlbumMenu.value = false;
};



// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value?.tracks) return [];
  const albumArtist = album.value.artistName || 'Unknown Artist'; 
  const albumCover = album.value.coverPath; // Get album's cover path
  const currentAlbumTitle = album.value.title; // Get album's title

  return album.value.tracks.map((track: Track) => ({
    ...track,
    artistName: track.artistName || albumArtist,
    albumTitle: track.albumTitle || currentAlbumTitle, // Ensure albumTitle is set
    coverPath: track.coverPath || albumCover,        // Ensure coverPath is set
  }));
});

// Function to get cover art URL (adjust path as needed)
function getCoverArtUrl(artPath: string | null): string {
  if (artPath) {
    return artPath.replace('\\', '/').replace('/public', ''); // Placeholder
  }
  return '/images/covers/default-album-art.webp';
}

// --- Check if this album is currently loaded ---
const isCurrentAlbumLoaded = computed(() => {
  return playerStore.currentQueueContext.type === 'album' && 
         playerStore.currentQueueContext.id === album.value?.albumId;
});

// --- Click handler for the main cover button ---
const playAlbum = (): void => {
  if (!album.value?.albumId || !playerReadyTracks.value.length) return;
  
  const firstTrack = playerReadyTracks.value[0];
  const thisAlbumContext = { type: 'album' as const, id: album.value.albumId };

  const isSameTrackAndContext = 
    playerStore.currentTrack?.trackId === firstTrack.trackId &&
    playerStore.currentQueueContext.type === thisAlbumContext.type &&
    playerStore.currentQueueContext.id === thisAlbumContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    playerStore.loadQueue(playerReadyTracks.value, thisAlbumContext);
    playerStore.playFromQueue(0);
  }
};

// --- Play a specific track (existing function) ---
const playTrack = (trackIndex: number): void => {
  if (!album.value?.albumId || !playerReadyTracks.value[trackIndex]) return;
  
  const clickedTrack = playerReadyTracks.value[trackIndex];
  const thisAlbumContext = { type: 'album' as const, id: album.value.albumId };

  const isMatchingTrackId = playerStore.currentTrack?.trackId === clickedTrack.trackId;
  const isMatchingContextType = playerStore.currentQueueContext.type === thisAlbumContext.type;
  const isMatchingContextId = playerStore.currentQueueContext.id === thisAlbumContext.id;

  const isSameTrackAndContext = isMatchingTrackId && isMatchingContextType && isMatchingContextId;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    playerStore.loadQueue(playerReadyTracks.value, thisAlbumContext);
    playerStore.playFromQueue(trackIndex);
  }
};

// Format duration helper
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Set page title
useHead(() => ({
  title: album.value ? `${album.value.title} by ${album.value.artistName}` : 'Album Details'
}));

</script>

<template>
  <div class="container mx-auto px-4 py-8 space-y-8">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Error loading album: {{ error.message }}</span>
    </div>
    <div v-else-if="album">
      <div class="flex flex-col md:flex-row gap-8 items-start">
        <!-- Album Cover & Play Button -->
        <div class="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 relative group">
          <img 
            :src="getCoverArtUrl(album.coverPath)" 
            :alt="album.title" 
            class="w-full h-full object-cover rounded-lg shadow-lg"
          />
        </div>

        <!-- Album Info -->
        <div class="flex-1">
          <h1 class="text-4xl font-bold mb-2">{{ album.title }}</h1>
          <p class="text-xl text-base-content/80 mb-4">{{ album.artistName }}</p>
          
          <div class="flex items-center gap-4 text-sm text-base-content/60 mb-6">
            <div class="flex items-center">
              <Icon name="material-symbols:music-note" class="w-4 h-4 mr-1" />
              <span>{{ album.tracks?.length || 0 }} tracks</span>
            </div>
            <div class="flex items-center">
              <Icon name="material-symbols:schedule" class="w-4 h-4 mr-1" />
              <span>{{ formatDuration(album.duration || 0) }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap gap-3">
            <button 
              @click="playAlbum" 
              class="btn btn-primary gap-2"
            >
              <Icon name="material-symbols:play-arrow" class="w-5 h-5" />
              Play
            </button>
            
            <div class="dropdown dropdown-end">
              <button 
                tabindex="0" 
                class="btn btn-ghost gap-2"
                @click.stop="toggleAlbumMenu"
              >
                <Icon name="material-symbols:more-vert" class="w-5 h-5" />
              </button>
              <div 
                v-if="showAlbumMenu" 
                class="dropdown-content z-[1] menu p-2 shadow bg-base-200 rounded-box w-52"
                @click.stop
              >
                <div class="flex flex-col">
                  <button 
                    v-for="playlist in playlists" 
                    :key="playlist.playlistId"
                    class="px-4 py-2 text-left hover:bg-base-300 rounded flex items-center"
                    @click="addAlbumToPlaylist(playlist.playlistId)"
                  >
                    <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
                    Add to {{ playlist.name }}
                  </button>
                </div>
              </div>
            </div>

            <!-- Edit Album Button (for admins) -->
            <button 
              @click="openEditAlbumModal" 
              class="btn btn-ghost gap-2"
            >
              <Icon name="material-symbols:edit" class="w-5 h-5" />
              Edit Album
            </button>
          </div>
        </div>
      </div>

      <!-- Track List -->
      <div>
        <h2 class="text-2xl font-semibold my-4">Tracks</h2>
        <div v-if="!album.tracks || album.tracks.length === 0" class="mt-4">
          <p class="text-neutral-content italic">No tracks found for this album.</p>
        </div>
        <div v-else class="overflow-x-auto">
          <table class="table w-full">
            <tbody>
              <TrackItem
                v-for="(track, index) in album.tracks"
                :key="track.trackId"
                :track="{
                  ...track,
                  coverPath: album.coverPath,
                  artistName: track.artistName || album.artistName
                }"
                :track-number="index + 1"
                @play-track="() => playTrack(index)"
                @track-options="handleTrackOptions"
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>

  <!-- Add to Playlist Modal -->
  <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        <template v-if="selectedTrackForPlaylist">
          Add "{{ selectedTrackForPlaylist.title }}" to playlist:
        </template>
        <template v-else>
          Add "{{ album?.title }}" to playlist:
        </template>
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
          <a @click="selectedTrackForPlaylist ? addTrackToPlaylist(playlist.playlistId) : addAlbumToPlaylist(playlist.playlistId)">
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
