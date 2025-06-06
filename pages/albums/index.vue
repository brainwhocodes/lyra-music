<template>
  <div
    class="albums w-full h-full px-4 pt-4 pb-20 bg-base-200 overflow-y-auto">
    <h1 class="text-3xl font-bold mb-6">Albums {{ artistName ? `by ${artistName}` : '' }}</h1>

    <div v-if="loading" class="text-center">
      <span class="loading loading-lg loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <span>Error loading albums: {{ error }}</span>
    </div>

    <div v-else-if="!albums || albums.length === 0" class="text-center text-gray-500">
      No albums found{{ artistName ? ` for ${artistName}` : '' }}.
    </div>

    <!-- Album List/Grid -->
    <div v-else
      class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
      <AlbumCard v-for="album_item in (albums || [])" :key="album_item.albumId" :album="album_item"
        :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId"
        :is-loading-this-album="albumIdLoading === album_item.albumId && currentAlbumLoading"
        @card-click="goToAlbum(album_item.albumId)" @add-to-playlist="openAddToPlaylistModal"
        @edit-album="handleEditAlbum" @play="handleAlbumCardPlayEvent(album_item)" />
    </div>

  </div>

  <!-- Add to Playlist Modal -->
  <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">
        Add "{{ selectedAlbumForPlaylist?.title }}" to playlist:
      </h3>
      <button @click="isAddToPlaylistModalOpen = false"
        class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2">✕</button>

      <div v-if="!playlists.length" class="text-center text-neutral-content italic py-4">
        <p>No playlists found. <NuxtLink to="/playlists" class="link link-primary">Create one?</NuxtLink>
        </p>
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

  <!-- Edit Album Modal -->
  <EditAlbumModal v-if="selectedAlbumForEdit" :album="selectedAlbumForEdit" :open="isEditAlbumModalOpen"
    @close="closeEditAlbumModal" @albumUpdated="handleAlbumUpdated" @updateError="handleUpdateError" />

  <!-- Simple Notification Component -->
  <div v-if="notification.visible" class="fixed bottom-4 right-4 p-4 rounded-lg shadow-lg z-50 max-w-md" :class="{
    'bg-success text-success-content': notification.type === 'success',
    'bg-error text-error-content': notification.type === 'error',
    'bg-info text-info-content': notification.type === 'info'
  }">
    <div class="flex items-center">
      <Icon :name="notification.type === 'success' ? 'material-symbols:check-circle-outline' :
        notification.type === 'error' ? 'material-symbols:error-outline' :
          'material-symbols:info-outline'" class="w-6 h-6 mr-2" />
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
import type { Album, AlbumArtistDetail } from '~/types/album';
import AlbumCard from '~/components/album/album-card.vue';
import EditAlbumModal from '~/components/modals/edit-album-modal.vue';
import type { Track, TrackArtistDetail } from '~/types/track';
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
const selectedAlbumForEdit = ref<Album | null>(null);
const isEditAlbumModalOpen = ref<boolean>(false);
const playlists = ref<any[]>([]);
const notification = ref<{ message: string; type: 'success' | 'error' | 'info'; visible: boolean }>({ message: '', type: 'info', visible: false });

// --- State for Albums List Display ---
const route = useRoute();
const artistName = ref<string | null>(null);

// Computed property for API query parameters for fetching the albums list
const apiQuery = computed(() => {
  const query: { artistId?: string } = {};
  if (route.query.artistId) {
    query.artistId = route.query.artistId as string;
  }
  return query;
});

const { data: albums, pending: loading, error } = await useLazyFetch<Album[]>('/api/albums', {
  query: apiQuery,
  watch: [apiQuery], // Automatically re-fetch when apiQuery changes
  immediate: true // Fetch immediately on component setup
});

// Watch the fetched albums data to derive artistName
watch(albums, (newAlbums: Album[] | null) => {
  artistName.value = null; // Reset artist name
  if (newAlbums && newAlbums.length > 0 && apiQuery.value.artistId) {
    const currentArtistId = apiQuery.value.artistId;
    const firstAlbum = newAlbums[0];
    if (firstAlbum && firstAlbum.artists) {
      const primaryArtist = firstAlbum.artists.find((a: AlbumArtistDetail) => a.isPrimaryArtist);
      const specificArtist = firstAlbum.artists.find((a: AlbumArtistDetail) => a.artistId === currentArtistId);
      if (specificArtist) {
        artistName.value = specificArtist.name;
      } else if (primaryArtist) {
        artistName.value = primaryArtist.name;
      } else if (firstAlbum.artists.length > 0 && firstAlbum.artists[0]) {
        artistName.value = firstAlbum.artists[0].name;
      }
    }
  }
});

useSeoMeta({
  title: usePageTitle(`Albums`)
});

// New function to fetch and map album details for playback
async function fetchAlbumDetailsById(id: string): Promise<Album | null> {
  currentAlbumLoading.value = true;
  albumIdLoading.value = id;
  let fetchedAlbum: Album | null = null;

  try {
    const apiResponse = await $fetch<Album>(`/api/albums/${id}`);
    // await new Promise(resolve => setTimeout(resolve, 1000));
    if (apiResponse && Array.isArray(apiResponse.tracks) && apiResponse.tracks.length > 0) {
      const tracksForPlayer: Track[] = apiResponse.tracks.map((trackApiResponse: any /* Assuming track from API might be any */) => {
        // Helper to get display artist name for a track
        const getTrackDisplayArtistName = (trackArtists: TrackArtistDetail[]): string => {
          if (!trackArtists || trackArtists.length === 0) return 'Unknown Artist';
          const primary = trackArtists.find(a => a.isPrimaryArtist);
          if (primary) return primary.name;
          return trackArtists.map(a => a.name).join(', ');
        };

        return {
          trackId: trackApiResponse.trackId,
          title: trackApiResponse.title ?? 'Unknown Track',
          // artists field should be directly mapped if API provides it in correct format
          artists: trackApiResponse.artists, // Ensure this matches TrackArtistDetail[]
          // artistName is now derived or handled by components that display track artists
          albumTitle: trackApiResponse.albumTitle ?? apiResponse.title ?? 'Unknown Album',
          filePath: trackApiResponse.filePath,
          duration: trackApiResponse.duration ?? 0,
          coverPath: apiResponse.coverPath, // Album cover for all tracks
          albumId: apiResponse.albumId,
          trackNumber: trackApiResponse.trackNumber ?? null,
          // Fields from Track type that might not be in trackApiResponse directly
          genre: trackApiResponse.genre ?? null,
          year: trackApiResponse.year ?? null,
          diskNumber: trackApiResponse.diskNumber ?? null,
          explicit: trackApiResponse.explicit ?? false,
          createdAt: trackApiResponse.createdAt ?? new Date().toISOString(),
          updatedAt: trackApiResponse.updatedAt ?? new Date().toISOString(),
          musicbrainzTrackId: trackApiResponse.musicbrainzTrackId ?? undefined,
        };
      });

      fetchedAlbum = {
        albumId: apiResponse.albumId,
        title: apiResponse.title,
        year: apiResponse.year,
        coverPath: apiResponse.coverPath,
        artists: apiResponse.artists, // Directly use the artists array from the API response
        tracks: tracksForPlayer,
      };
    } else {
      // console.warn(`[AlbumsIndex] fetchAlbumDetailsById: No tracks found or invalid response for album ID: ${id}`, apiResponse);
    }
  } catch (err) {
    // console.error(`[AlbumsIndex] fetchAlbumDetailsById: Error fetching album ${id}:`, err);
    fetchedAlbum = null; // Ensure it's null on error
  } finally {
    currentAlbumLoading.value = false;
    // albumIdLoading.value = null; // Resetting here might be too soon if multiple clicks happen
  }
  return fetchedAlbum;
}

// Function to play a specific album from the list
const playAlbum = async (albumId: string): Promise<void> => {
  if (!albumId) {
    // console.warn('[AlbumsIndex] playAlbum: albumId is null or undefined.');
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
  if (album && album.albumId) {
    playAlbum(album.albumId);
  } else {
    // console.error('[AlbumsIndex] handleAlbumCardPlayEvent: Album or albumId is missing.', album);
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
    const data = await $fetch<any[]>('/api/playlists');
    playlists.value = data;
  } catch (e: unknown) {
    // console.error('Error fetching playlists:', e);
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
    // console.error('Error adding tracks to playlist:', e);
    const errorMessage = e && typeof e === 'object' && 'data' in e && e.data && typeof e.data === 'object' && 'message' in e.data ?
      String(e.data.message) : 'Failed to add to playlist.';
    showNotification(errorMessage, 'error');
  }
};

// Function to handle edit album action
const handleEditAlbum = (album: Album): void => {
  selectedAlbumForEdit.value = album;
  isEditAlbumModalOpen.value = true;
};

// Function to close the edit album modal
const closeEditAlbumModal = (): void => {
  isEditAlbumModalOpen.value = false;
  // Keep the selected album for a moment to avoid UI flicker
  setTimeout(() => {
    selectedAlbumForEdit.value = null;
  }, 300);
};

// Handle successful album update
const handleAlbumUpdated = (updatedAlbum: Album): void => {
  // Update the album in the albums list
  const index = albums.value ? albums.value.findIndex((a: Album) => a.albumId === updatedAlbum.albumId) : -1;
  if (albums.value && index !== -1) {
    albums.value[index] = { ...albums.value[index], ...updatedAlbum };
  }

  // Update the album in the player store if it's loaded
  playerStore.updateAlbumDetailsInPlayer(updatedAlbum);

  // Close the modal and show success notification
  closeEditAlbumModal();
  showNotification(`Album "${updatedAlbum.title}" updated successfully.`, 'success');
};

// Handle album update error
const handleUpdateError = (errorMessage: string): void => {
  showNotification(errorMessage || 'Failed to update album.', 'error');
};

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