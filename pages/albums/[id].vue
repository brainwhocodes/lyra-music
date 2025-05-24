<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album';
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import type { MessageType } from '~/types/message-type';
import type { NotificationMessage } from '~/types/notification-message';
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

// Placeholder function to open an "Edit Track" modal (not yet implemented)
const openEditTrackModal = (track: Track): void => {
  console.log('Attempting to edit track:', track);
  showNotification(`Edit functionality for "${track.title}" is not yet implemented.`, 'info');
  // Close the track menu
  openMenuForTrackId.value = null;
};



// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value?.tracks) return [];
  const albumArtist = album.value.artistName || 'Unknown Artist'; 
  return album.value.tracks.map((track: Track) => ({
    ...track,
    artistName: track.artistName || albumArtist,
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
  return album.value?.albumId === playerStore.currentTrack?.albumId;
});

// --- Click handler for the main cover button ---
const playAlbum = (): void => {
  const trackIndex = 0;
  if (!album.value?.tracks?.[trackIndex]) return;
  
  const track = album.value.tracks[trackIndex];
  
  if (playerStore.currentTrack?.trackId === track.trackId) {
    playerStore.togglePlayPause();
    return;
  }

  if (!isCurrentAlbumLoaded.value) {
    playerStore.loadQueue(playerReadyTracks.value);
  }
  
  playerStore.playFromQueue(trackIndex);
};

// --- Play a specific track (existing function) ---
const playTrack = (trackIndex: number): void => {
  if (!album.value?.tracks?.[trackIndex]) return;
  
  const track = album.value.tracks[trackIndex];
  
  if (playerStore.currentTrack?.trackId === track.trackId) {
    playerStore.togglePlayPause();
    return;
  }
  
  if (!isCurrentAlbumLoaded.value) {
    playerStore.loadQueue(playerReadyTracks.value);
  }
  
  playerStore.playFromQueue(trackIndex);
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
      <div>
        <Icon name="material-symbols:error-outline-rounded" class="w-6 h-6"/>
        <span>Error loading album details: {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="album">
      <div class="flex flex-col md:flex-row gap-8 items-start">
        <!-- Album Cover & Play Button -->
        <div class="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 relative group">
          <img 
            :src="getCoverArtUrl(album?.coverPath)" 
            alt="Album Cover" 
            class="w-full h-full object-cover rounded-lg shadow-lg"
          />
        </div>
        
        <!-- Album Info -->
        <div class="flex-grow text-center md:text-left">
          <h1 class="text-4xl font-bold mb-2">{{ album?.title }}</h1>
          <NuxtLink 
            v-if="album?.artistId"
            :to="`/artists/${album.artistId}`" 
            class="text-2xl text-neutral-content hover:text-primary transition-colors"
            title="View Artist"
          >
              {{ album?.artistName ?? 'Unknown Artist' }}
          </NuxtLink>
          <span v-else class="text-2xl text-neutral-content">
            {{ album?.artistName ?? 'Unknown Artist' }}
          </span>
          <p v-if="album?.year" class="text-lg text-gray-500 mt-1">{{ album.year }}</p>
          <p v-if="album?.tracks" class="text-sm text-gray-400 mt-2">{{ album.tracks.length }} track{{ album.tracks.length !== 1 ? 's' : '' }}</p>
          <!-- Album controls -->
          <div class="flex items-center gap-2 mt-4">
            <!-- Play/Pause button -->
            <button class="btn btn-primary" @click="playAlbum">
              <Icon name="material-symbols:play-arrow-rounded" class="w-5 h-5 mr-1" v-if="!playerStore.isPlaying" />
              <Icon name="material-symbols:pause-rounded" class="w-5 h-5 mr-1" v-else />
              {{  playerStore.isPlaying ? 'Pause Album' : 'Play Album' }}
            </button>
            
            <!-- Album options button -->
            <div class="relative" @click.stop>
              <button 
                class="btn btn-ghost btn-sm p-2"
                @click.stop="toggleAlbumMenu($event)"
                title="Album options"
              >
                <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
              </button>
              
              <!-- Album options dropdown -->
              <div 
                v-if="showAlbumMenu" 
                class="absolute right-0 top-full mt-1 w-52 bg-base-200 rounded-lg shadow-lg z-[10] py-2 border border-base-300"
                @click.stop
              >
                <div class="flex flex-col">
                  <button 
                    class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
                    @click.stop="selectedTrackForPlaylist = null; isAddToPlaylistModalOpen = true; fetchPlaylists()"
                  >
                    <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
                    Add Album to Playlist
                  </button>
                  <button 
                    class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
                    @click.stop="showNotification('Edit album functionality is not yet implemented.', 'info'); showAlbumMenu = false"
                  >
                    <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
                    Edit Album
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Track List -->
      <div>
        <h2 class="text-2xl font-semibold my-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full">
            <tbody>
              <tr 
                v-for="(track, index) in album.tracks" 
                :key="track.trackId"
                class="hover:bg-base-200 group cursor-pointer"
                :class="{'text-primary font-semibold bg-base-300': playerStore.currentTrack?.trackId === track.trackId }"
                @click="playTrack(index)" 
              >
                <td class="w-12 text-center text-sm text-neutral-content">{{ index + 1 }}</td>
                <td class="w-12 text-center">
                    <!-- Show pause icon if this track is playing -->
                    <Icon 
                        v-if="playerStore.currentTrack?.trackId === track.trackId && playerStore.isPlaying"
                        name="material-symbols:pause-rounded"
                        class="w-5 h-5 text-primary"
                    />
                    <!-- Show play icon on hover if not playing, or if it's a different track -->
                    <Icon 
                        v-else
                        name="material-symbols:play-arrow-rounded"
                        class="w-5 h-5 text-base-content opacity-0 group-hover:opacity-100"
                        :class="{'opacity-100': playerStore.currentTrack?.trackId === track.trackId }" 
                    />
                </td>
                <td>{{ track.title }}</td>
                <td class="text-right text-sm text-neutral-content">{{ formatDuration(track.duration) }}</td>
                <td class="w-16 text-center relative" @click.stop>
                  <button 
                    class="btn btn-ghost btn-sm p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                    @click.stop="toggleTrackMenu(track.trackId, $event)"
                  >
                    <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
                  </button>
                  
                  <!-- Custom dropdown menu -->
                  <div 
                    v-if="openMenuForTrackId === track.trackId" 
                    class="absolute right-0 top-full mt-1 w-52 bg-base-200 rounded-lg shadow-lg z-[10] py-2 border border-base-300"
                    @click.stop
                  >
                    <div class="flex flex-col">
                      <button 
                        class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
                        @click.stop="openAddToPlaylistModal(track)"
                      >
                        <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
                        Add to Playlist
                      </button>
                      <button 
                        class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
                        @click.stop="openEditTrackModal(track)"
                      >
                        <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
                        Edit Track
                      </button>
                    </div>
                  </div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Message if no tracks -->
        <div v-if="!album.tracks || album.tracks.length === 0" class="mt-4">
           <p class="text-neutral-content italic">No tracks found for this album.</p>
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
