<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album';
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import type { MessageType } from '~/types/message-type';
import type { NotificationMessage } from '~/types/notification-message';
import type { QueueContext } from '~/stores/player';
import TrackItem from '~/components/track/track-item.vue';
import OptionsMenu from '~/components/options-menu.vue'; // Import OptionsMenu
import { resolveCoverArtUrl } from '~/utils/formatters';
const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => route.params.id as string);

// State for "Add to Playlist" functionality
const playlists = ref<Playlist[]>([]);
const selectedTrackForPlaylist = ref<Track | null>(null);
const isAddToPlaylistModalOpen = ref(false);
const openMenuForTrackId = ref<string | null>(null);
const notification = ref<NotificationMessage>({ message: '', type: 'info', visible: false });
const isAddAlbumToPlaylistModalOpen = ref(false);

// Template ref for OptionsMenu
const albumOptionsMenuRef = ref<InstanceType<typeof OptionsMenu> | null>(null);

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
  }
};

// Function to add all album tracks to a playlist
const addAlbumToPlaylist = (playlistId: string): void => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0) return;
  
  const trackIds = album.value.tracks.map((track: Track) => track.trackId);
  addTracksToPlaylist(playlistId, trackIds, `Album "${album.value.title}" added to playlist.`);
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
      showNotification(`Edit functionality for "${track.title}" is not yet implemented.`, 'info');
      break;
  }
  
  // Close any open menus
  openMenuForTrackId.value = null;
};

// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value) return []; // Add this primary guard for the album object itself
  if (!album.value.tracks || album.value.tracks.length === 0) return []; // Guard for tracks array

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

// --- Check if this album is currently loaded ---
const isCurrentAlbumLoaded = computed(() => {
  return playerStore.currentQueueContext.type === 'album' && 
         playerStore.currentQueueContext.id === album.value?.albumId;
});

// --- Album Options Menu ---
const albumOptions = computed(() => [
  { id: 'add-to-queue', label: 'Add to Queue', icon: 'mdi:playlist-plus' },
  { id: 'add-album-to-playlist', label: 'Add Album to Playlist', icon: 'mdi:playlist-music' },
  { id: 'edit-album', label: 'Edit Album', icon: 'mdi:pencil' },
  // Add more options as needed
]);

const handleAlbumOption = (optionId: string): void => {
  albumOptionsMenuRef.value?.closeMenu(); // Close menu after selection
  switch (optionId) {
    case 'add-to-queue':
      handleAddAlbumToQueue();
      break;
    case 'add-album-to-playlist':
      openAddAlbumToPlaylistModal();
      break;
    case 'edit-album':
      openEditAlbumModal();
      break;
    default:
      console.warn('Unknown album option:', optionId);
  }
};

// New function to handle adding album to queue
const handleAddAlbumToQueue = (): void => {
  if (!album.value || !playerReadyTracks.value || playerReadyTracks.value.length === 0) {
    showNotification('No tracks in this album to add to queue.', 'info');
    return;
  }

  const albumContext: QueueContext = {
    type: 'album',
    id: album.value.albumId,
    name: album.value.title,
  };

  playerStore.addAlbumToQueue(playerReadyTracks.value as Track[], albumContext);
  showNotification(`Album "${album.value.title}" added to queue.`, 'success');
  playerStore.showQueueSidebar(); // Optionally show the queue
};

const openAddAlbumToPlaylistModal = (): void => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0) {
    showNotification('No tracks in this album to add to a playlist.', 'info');
    return;
  }
  fetchPlaylists(); // Ensure playlists are up-to-date
  isAddAlbumToPlaylistModalOpen.value = true;
};

// --- Click handler for the main cover button ---
const playAlbum = (): void => {
  if (!album.value?.albumId || !playerReadyTracks.value.length) return;
  
  const firstTrack = playerReadyTracks.value[0];
  // Ensure thisAlbumContext matches the QueueContext from the store
  const thisAlbumContext: QueueContext = { type: 'album', id: album.value.albumId, name: album.value.title };

  const isSameTrackAndContext = 
    playerStore.currentTrack?.trackId === firstTrack.trackId &&
    playerStore.currentQueueContext.type === thisAlbumContext.type &&
    playerStore.currentQueueContext.id === thisAlbumContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    // playerReadyTracks should be compatible with the store's Track[] type
    playerStore.loadQueue(playerReadyTracks.value as Track[], thisAlbumContext);
    playerStore.playFromQueue(0);
  }
};

// --- Play a specific track (existing function) ---
const playTrack = (trackIndex: number): void => {
  if (!album.value?.albumId || !playerReadyTracks.value.length || trackIndex < 0 || trackIndex >= playerReadyTracks.value.length) return;
  
  const trackToPlay = playerReadyTracks.value[trackIndex];
  // Ensure thisAlbumContext matches the QueueContext from the store
  const thisAlbumContext: QueueContext = { type: 'album', id: album.value.albumId, name: album.value.title };

  const isSameTrackAndContext = 
    playerStore.currentTrack?.trackId === trackToPlay.trackId &&
    playerStore.currentQueueContext.type === thisAlbumContext.type &&
    playerStore.currentQueueContext.id === thisAlbumContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    // playerReadyTracks should be compatible with the store's Track[] type
    playerStore.loadQueue(playerReadyTracks.value as Track[], thisAlbumContext);
    playerStore.playFromQueue(trackIndex);
  }
};

// Set page title
useHead(() => ({
  title: album.value ? `${album.value.title} by ${album.value.artistName || 'Unknown Artist'}` : 'Album Details'
}));

// --- Function to open the album edit modal (placeholder) ---
const openEditAlbumModal = (): void => {
  // Placeholder for edit album functionality
  showNotification(`Edit functionality for album "${album.value?.title}" is not yet implemented.`, 'info');
};
</script>

<template>
  <div class="container mx-auto px-4 py-8 space-y-8">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="text-center text-error">
      Error loading album: {{ error.message }}
    </div>
    <div v-else-if="album" class="flex flex-col md:flex-row gap-8 items-center">
      <!-- Album Cover -->
      <div class="md:w-1/3">
        <img 
          :src="resolveCoverArtUrl(album.coverPath)" 
          :alt="`${album.title} cover`"
          class="w-full aspect-square rounded-lg shadow-xl object-cover"
        />
      </div>

      <!-- Album Info -->
      <div class="flex-1">
        <h1 class="text-4xl font-bold mb-2">{{ album.title }}</h1>
        <p class="text-xl text-base-content/80 mb-4">{{ album.artistName }}</p>
        
        <div class="flex items-center gap-4 text-sm text-base-content/60 mb-6">
          <div class="flex items-center">
            <Icon name="material-symbols:music-note" class="w-4 h-4 mr-1" />
            <span>{{ playerReadyTracks.length || 0 }} tracks</span>
          </div>
          <div class="flex items-center">
            <Icon name="material-symbols:schedule" class="w-4 h-4 mr-1" />
            <span>{{ formatDuration(playerReadyTracks?.reduce((total: number, track: Track) => total + (track.duration || 0), 0)) }}</span>
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
          
          <OptionsMenu ref="albumOptionsMenuRef" :options="albumOptions" @option-selected="handleAlbumOption">
          </OptionsMenu>
        </div>
      </div>
    </div>
    <div v-else class="text-center text-warning">
      Album data not available or not found.
    </div>

    <!-- Track List -->
    <div v-if="album">
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
                artistName: track.artistName || album.artistName,
                albumTitle: album.title,
                coverPath: resolveCoverArtUrl(track.coverPath || album.coverPath) // Use resolveCoverArtUrl here too
              }"
              :track-number="index + 1"
              @play-track="playTrack(index)"
              @track-options="handleTrackOptions"
            />
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <!-- Add to Playlist Modal (for single tracks) -->
  <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Add "{{ selectedTrackForPlaylist?.title }}" to Playlist</h3>
      <ul v-if="playlists.length > 0" class="menu bg-base-100 w-full p-2 rounded-box">
        <li v-for="playlist in playlists" :key="playlist.playlistId">
          <a @click="addTrackToPlaylist(playlist.playlistId)">
            {{ playlist.name }}
          </a>
        </li>
      </ul>
      <p v-else-if="!playlists.length" class="py-4">You don't have any playlists yet. <NuxtLink to="/playlists" class="link">Create one?</NuxtLink></p>
      <p v-else class="py-4">Loading playlists...</p>
      <div class="modal-action">
        <button class="btn" @click="isAddToPlaylistModalOpen = false">Close</button>
      </div>
    </div>
  </div>

  <!-- Add Album to Playlist Modal -->
  <div v-if="isAddAlbumToPlaylistModalOpen" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Add album "{{ album?.title }}" to Playlist</h3>
      <ul v-if="playlists.length > 0" class="menu bg-base-100 w-full p-2 rounded-box">
        <li v-for="playlist in playlists" :key="playlist.playlistId">
          <!-- The existing addAlbumToPlaylist function will be called -->
          <a @click="addAlbumToPlaylist(playlist.playlistId); isAddAlbumToPlaylistModalOpen = false;">
            {{ playlist.name }}
          </a>
        </li>
      </ul>
      <p v-else-if="!playlists.length" class="py-4">You don't have any playlists yet. <NuxtLink to="/playlists" class="link">Create one?</NuxtLink></p>
      <p v-else class="py-4">Loading playlists...</p>
      <div class="modal-action">
        <button class="btn" @click="isAddAlbumToPlaylistModalOpen = false">Close</button>
      </div>
    </div>
  </div>

  <!-- Global Notification -->
  <div v-if="notification.visible" class="toast toast-top toast-center min-w-max">
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
