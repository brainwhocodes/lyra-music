<script setup lang="ts">
import type { Album } from '~/types/album';
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import type { MessageType } from '~/types/message-type';
import { usePlayerStore } from '~/stores/player';
import type { NotificationMessage } from '~/types/notification-message';
import type { QueueContext } from '~/stores/player';
import { useCoverArt } from '~/composables/use-cover-art';

import TrackItem from '~/components/track/track-item.vue';
import EditAlbumModal from '~/components/modals/edit-album-modal.vue';
import OptionsMenu from '~/components/options-menu.vue';
import EditTrackModal from '~/components/modals/edit-track-modal.vue';
import EditLyricsModal from '~/components/modals/edit-lyrics-modal.vue'; // Import the new modal
import { useTrackArtists, } from '~/composables/useTrackArtists';

// Use the track artists composable for formatting track artists
const { formatTrackWithArtists, getTrackArtistNameString, getFormattedTrackArtists } = useTrackArtists();

const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => route.params.id as string);
const { getCoverArtUrl } = useCoverArt();

// State for "Add to Playlist" functionality
const selectedTrackForPlaylist = ref<Track | null>(null);
const isAddToPlaylistModalOpen = ref(false);
const openMenuForTrackId = ref<string | null>(null);
const notification = ref<NotificationMessage>({ message: '', type: 'info', visible: false });
const isAddAlbumToPlaylistModalOpen = ref(false);
// Template ref for OptionsMenu
const albumOptionsMenuRef = ref<InstanceType<typeof OptionsMenu> | null>(null);
const isEditAlbumModalOpen = ref(false);

// State for EditTrackModal
const isEditTrackModalOpen = ref(false);
const selectedTrackForEdit = ref<Track | null>(null);

// State for EditLyricsModal
const isEditLyricsModalOpen = ref(false);
const selectedTrackForLyrics = ref<Track | null>(null);

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
const { data: album, pending, error } = await useLazyFetch<Album>(`/api/albums/${albumId.value}`);

watch(album, (newAlbum: Album | null) => {
  if (newAlbum) {
    useSeoMeta({
      title: usePageTitle(`Album | ${newAlbum.title}`)
    });
  }
});

if (album.value) {
  useSeoMeta({
    title: usePageTitle(`Album | ${album.value.title}`)
  });
}

const { data: playlists } = await useLazyFetch<Playlist[]>('/api/playlists');

watch(playlists, (newPlaylists: Playlist[] | null) => {
  if (newPlaylists) {
  }
});

if (playlists.value) {
}

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

// Function to add all album tracks to a playlist
const addAlbumToPlaylist = (playlistId: string): void => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0) return;

  const trackIds = album.value.tracks.map((track: Track) => track.trackId);
  addTracksToPlaylist(playlistId, trackIds, `Album "${album.value.title}" added to playlist.`);
  isAddAlbumToPlaylistModalOpen.value = false;
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

// Edit Lyrics Modal Handlers
const openEditLyricsModal = (track: Track): void => {
  selectedTrackForLyrics.value = track;
  isEditLyricsModalOpen.value = true;
};

const handleEditLyricsModalClose = (): void => {
  isEditLyricsModalOpen.value = false;
  selectedTrackForLyrics.value = null;
};

const handleLyricsSuccessfullyUpdated = (/* updatedLyrics: import('~/types/lyrics').Lyrics */): void => {
  // The modal emits the full Lyrics object, but we might not need to use it directly here
  // if we re-fetch lyrics on demand or if the track object itself doesn't store lyrics.
  showNotification('Lyrics updated successfully.', 'success');
  handleEditLyricsModalClose();
};

const handleEditLyricsModalUpdateError = (errorMessage: string): void => {
  showNotification(`Error updating lyrics: ${errorMessage}`, 'error');
  // Optionally, keep the modal open if preferred, or close it.
  // handleEditLyricsModalClose(); 
};

// Edit Track Modal Handlers
const openEditTrackModal = (track: Track): void => {
  selectedTrackForEdit.value = track;
  isEditTrackModalOpen.value = true;
};

const handleEditTrackModalClose = (): void => {
  isEditTrackModalOpen.value = false;
  selectedTrackForEdit.value = null;
};

const handleTrackSuccessfullyUpdated = (updatedTrack: Track): void => {
  showNotification(`Track '${updatedTrack.title}' updated successfully.`, 'success');
  if (album.value && album.value.tracks) {
    const index = album.value.tracks.findIndex((t: Track) => t.trackId === updatedTrack.trackId);
    if (index !== -1) {
      album.value.tracks[index] = { ...album.value.tracks[index], ...updatedTrack };
      album.value.tracks = [...album.value.tracks]; // Ensure reactivity by creating a new array instance
    }
  }
  handleEditTrackModalClose();
};

const handleEditTrackModalUpdateError = (errorMessage: string): void => {
  showNotification(`Error updating track: ${errorMessage}`, 'error');
};

// Handle track options from TrackItem component
const handleTrackOptions = (options: { action: string; track: Track }): void => {
  const { action, track } = options;

  switch (action) {
    case 'add-to-playlist':
      openAddToPlaylistModal(track);
      break;
    case 'edit-track':
      openEditTrackModal(track);
      break;
    case 'edit-lyrics': // Add new case for editing lyrics
      openEditLyricsModal(track);
      break;
  }

  // Close any open menus
  openMenuForTrackId.value = null;
};

// Computed property to get a display name for the album's artist(s)
const displayAlbumArtistName = computed<string>(() => {
  if (!album.value?.artists?.length) {
    return 'Unknown Artist';
  }

  // Get all primary artists
  const primaryArtists = album.value.artists.filter(
    (artist: import('~/types/album').AlbumArtistDetail) => artist.isPrimaryArtist
  );

  if (primaryArtists.length === 0) {
    // If no primary artists, use all artists
    primaryArtists.push(...album.value.artists);
  }

  if (primaryArtists.length > 3) {
    // If more than 3 artists, show "Various Artists"
    return 'Various Artists';
  } else if (primaryArtists.length > 1) {
    // Join multiple artists with commas and '&' for the last one
    return primaryArtists
      .map((artist: import('~/types/album').AlbumArtistDetail) => artist.name)
      .join(', ')
      .replace(/,([^,]*)$/, ' &$1');
  }

  // Return single artist name
  return primaryArtists[0].name;
});

// Get all album artists with roles for detailed display
const formattedAlbumArtists = computed(() => {
  if (!album.value?.artists?.length) return [];

  return album.value.artists.map((artist: import('~/types/album').AlbumArtistDetail) => ({
    ...artist,
    url: `/artists/${artist.artistId}`,
    displayRole: '', // Don't display roles, just use commas
    isPrimary: !!artist.isPrimaryArtist
  }));
});

// Helper to get display artist name from a track's artists array using the composable
const getDisplayArtistNameForTrack = (track: Track): string => {
  // If no artists, use the album's display artist as fallback
  if (!track.artists || track.artists.length === 0) {
    return displayAlbumArtistName.value;
  }

  return getTrackArtistNameString(track);
};

// No longer need the manual helper since we use the composable now

// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0) return [];

  const albumCover = album.value.coverPath;
  const currentAlbumTitle = album.value.title;

  return album.value.tracks.map((track: Track) => {
    // Pass along original track.artists. Explicitly set formattedArtists and artistName to undefined
    // to ensure the player store handles all formatting.
    return {
      ...track, // This includes the original track.artists array
      albumId: album.value!.albumId,
      albumTitle: track.albumTitle || currentAlbumTitle,
      coverPath: track.coverPath || albumCover,
      formattedArtists: undefined,
      artistName: undefined
    };
  });
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
const playOrPauseCurrentAlbum = (): void => {
  if (!album.value || !playerReadyTracks.value.length) {
    // TODO: showNotification('No tracks available for this album.', 'info');
    console.warn('Play/Pause: No album or tracks available');
    return;
  }

  const isThisAlbumContextActive = playerStore.currentQueueContext.type === 'album' &&
    playerStore.currentQueueContext.id === album.value.albumId;

  if (isThisAlbumContextActive) {
    // If this album is already the active context, just toggle play/pause.
    playerStore.togglePlayPause();
  } else {
    // Different album/context is loaded, or nothing is loaded.
    // Load this album and start playing from the first track.
    const newContext: QueueContext = { type: 'album', id: album.value.albumId, name: album.value.title };
    playerStore.loadQueue(playerReadyTracks.value, newContext, true, 0);
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

const openEditAlbumModal = (): void => {
  isEditAlbumModalOpen.value = true;
};

const onAlbumUpdated = (updatedAlbumData: Album): void => {
  if (album.value) { // Ensure album.value is not null
    // Merge updated data into the existing album ref
    // This helps preserve reactivity if only parts of the album object are returned
    // or if we want to be selective about what's updated.
    // For a full replacement:
    album.value = { ...album.value, ...updatedAlbumData };
    playerStore.updateAlbumDetailsInPlayer(updatedAlbumData); // Update player store
  }
  isEditAlbumModalOpen.value = false;
  showNotification('Album updated successfully!', 'success');
};

const onAlbumUpdateError = (errorMessage: string): void => {



  showNotification(errorMessage || 'Failed to update album.', 'error');
  // Modal likely closes itself or provides its own error state, 
  // but if needed: isEditAlbumModalOpen.value = false;
};

</script>

<template>
  <div class="px-4 py-8 overflow-y-auto w-full lg:h-[calc(90vh)] h-[calc(100vh-100px)] bg-base-100">
    <div class="container mx-auto">
      <EditAlbumModal v-if="album" :album="album" :open="isEditAlbumModalOpen" @close="isEditAlbumModalOpen = false"
        @albumUpdated="onAlbumUpdated" @updateError="onAlbumUpdateError" />
      <EditTrackModal v-if="selectedTrackForEdit" :track="selectedTrackForEdit" :open="isEditTrackModalOpen"
        @close="handleEditTrackModalClose" @trackUpdated="handleTrackSuccessfullyUpdated"
        @updateError="handleEditTrackModalUpdateError" />
      <EditLyricsModal v-if="selectedTrackForLyrics" :track="selectedTrackForLyrics" :open="isEditLyricsModalOpen"
        @close="handleEditLyricsModalClose" @lyricsUpdated="handleLyricsSuccessfullyUpdated"
        @updateError="handleEditLyricsModalUpdateError" />
      <div v-if="pending" class="text-center">
        <span class="loading loading-spinner loading-lg"></span>
      </div>
      <div v-else-if="error" class="text-center text-error">
        Error loading album: {{ error.message }}
      </div>
      <!-- ... (rest of the template remains the same) -->
      <div v-else-if="album" class="flex flex-col md:flex-row gap-8 items-center">
        <!-- Album Cover -->
        <div class="md:w-1/3">
          <img :src="getCoverArtUrl(album.coverPath)" :alt="`${album.title} cover`"
            class="w-full aspect-square rounded-lg shadow-xl object-cover" />
        </div>

        <!-- Album Info -->
        <div class="flex-1">
          <h1 class="text-4xl font-bold mb-2 text-center lg:text-left">{{ album.title }}</h1>

          <!-- Album Artists with Links -->
          <div class="text-xl text-base-content/80 mb-2 text-center lg:text-left">
            <span v-if="formattedAlbumArtists.length === 0">Unknown Artist</span>
            <template v-else>
              <span v-for="(artist, index) in formattedAlbumArtists" :key="artist.artistId" class="mr-1">
                <NuxtLink :to="artist.url" :class="['hover:underline', { 'font-semibold': artist.isPrimary }]">
                  {{ artist.name }}
                </NuxtLink>
                <span v-if="artist.displayRole" class="text-sm text-base-content/60">{{ artist.displayRole }}</span>
                <span v-if="index < formattedAlbumArtists.length - 2">, </span>
                <span v-else-if="index === formattedAlbumArtists.length - 2"> & </span>
              </span>
            </template>
          </div>

          <div class="flex items-center gap-4 text-sm text-base-content/60 mb-6 justify-center lg:justify-start">
            <div class="flex items-center">
              <Icon name="material-symbols:music-note" class="w-4 h-4 mr-1" />
              <span>{{ playerReadyTracks.length || 0 }} tracks</span>
            </div>
            <div class="flex items-center">
              <Icon name="material-symbols:schedule" class="w-4 h-4 mr-1" />
              <span>{{formatDuration(playerReadyTracks?.reduce((total: number, track: Track) => total + (track.duration
                || 0),
                0)) }}</span>
            </div>
            <div class="flex items-center">
              <Icon name="material-symbols:album" class="w-4 h-4 mr-1" />
              <span>{{ album.year }}</span>
            </div>
          </div>

          <!-- Action Buttons -->
          <div class="flex flex-wrap gap-3 items-center justify-center lg:justify-start">
            <button @click="playOrPauseCurrentAlbum" class="btn btn-xl btn-circle btn-primary">
              <Icon name="material-symbols:play-arrow" class="w-5 h-5"
                v-if="!isCurrentAlbumLoaded || !playerStore.isPlaying" />
              <Icon name="material-symbols:pause" class="w-5 h-5" v-else />
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
              <TrackItem v-for="(track, index) in album.tracks" :key="track.trackId" :track="{
                ...track,
                artistName: getDisplayArtistNameForTrack(track.artists), // Use hoisted helper
                albumTitle: album.title,
                coverPath: getCoverArtUrl(track.coverPath || album.coverPath),
                formattedArtists: getFormattedTrackArtists(track.artists) // Pass formatted artists for detailed display
              }" :track-number="index + 1" :playlists="playlists || []" @play-track="playTrack(index)"
                @track-options="handleTrackOptions" />
            </tbody>
          </table>
        </div>
      </div>
    </div>

    <!-- Add to Playlist Modal (for single tracks) -->
    <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Add "{{ selectedTrackForPlaylist?.title }}" to Playlist</h3>
        <ul v-if="playlists && playlists.length > 0" class="menu bg-base-100 w-full p-2 rounded-box">
          <li v-for="playlist in playlists" :key="playlist.playlistId">
            <a @click="addTrackToPlaylist(playlist.playlistId)">
              {{ playlist.name }}
            </a>
          </li>
        </ul>
        <p v-else-if="!playlists || !playlists.length" class="py-4">You don't have any playlists yet. <NuxtLink
            to="/playlists" class="link">Create one?</NuxtLink>
        </p>
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
        <ul v-if="playlists && playlists.length > 0" class="menu bg-base-100 w-full p-2 rounded-box">
          <li v-for="playlist in playlists" :key="playlist.playlistId">
            <!-- The existing addAlbumToPlaylist function will be called -->
            <a @click="addAlbumToPlaylist(playlist.playlistId)">
              {{ playlist.name }}
            </a>
          </li>
        </ul>
        <p v-else-if="!playlists || !playlists.length" class="py-4">You don't have any playlists yet. <NuxtLink
            to="/playlists" class="link">Create one?</NuxtLink>
        </p>
        <p v-else class="py-4">Loading playlists...</p>
        <div class="modal-action">
          <button class="btn" @click="isAddAlbumToPlaylistModalOpen = false">Close</button>
        </div>
      </div>
    </div>

    <!-- Global Notification -->
    <div v-if="notification.visible" class="toast toast-top toast-center min-w-max">
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
  </div>
</template>
