<template>
  <div class="container mx-auto px-4 py-8 space-y-8 overflow-y-auto">
    <!-- Loading -->
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <!-- Error -->
    <div v-else-if="error" class="alert alert-error shadow-lg flex items-center gap-2">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Failed to load playlist. Please try again later.</span>
    </div>
    <!-- Playlist Content -->
    <div v-else-if="playlist">
      <div class="flex flex-col md:flex-row gap-8 items-start">
        <!-- Playlist Cover -->
        <div class="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 relative group bg-base-300 rounded-lg overflow-hidden">
          <div class="grid grid-cols-2 w-full h-full">
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
          </div>
        </div>
        <!-- Playlist Info & Actions -->
        <div class="flex-1 flex flex-col justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold mb-2">{{ playlist.name }}</h1>
            <p class="text-base-content/70">
              {{ formatTrackCount(playlist.tracks.length) }}
              <span v-if="playlist.tracks.length"> • {{ formatDuration(totalDuration) }}</span>
            </p>
          </div>
          <div class="flex gap-2 mt-4">
            <button class="btn btn-primary gap-2" @click="playPlaylist" :disabled="!playlist.tracks.length">
              <Icon name="material-symbols:play-arrow" class="w-6 h-6" />
              Play
            </button>
            <button class="btn btn-outline gap-2" @click="showAddTracksModal = true">
              <Icon name="material-symbols:add" class="w-5 h-5" />
              Add Tracks
            </button>
            <button class="btn btn-ghost gap-2" @click="showRenameModal = true">
              <Icon name="material-symbols:edit" class="w-5 h-5" />
              Rename
            </button>
            <button class="btn btn-error btn-outline gap-2" @click="showDeleteModal = true">
              <Icon name="material-symbols:delete-outline" class="w-5 h-5" />
              Delete
            </button>
          </div>
        </div>
      </div>
      <!-- Empty State -->
      <div v-if="!playlist.tracks.length" class="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="material-symbols:music-note" class="w-16 h-16 text-primary mb-4" />
        <h3 class="text-xl font-bold mb-2">No Tracks Yet</h3>
        <p class="text-base-content/70 mb-6 max-w-md">Add some tracks to your playlist to get started</p>
        <button class="btn btn-primary" @click="showAddTracksModal = true">
          <Icon name="material-symbols:add" class="w-5 h-5 mr-1" />
          Add Tracks
        </button>
      </div>
      <!-- Track List -->
      <div v-else>
        <h2 class="text-2xl font-semibold my-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full">
            <draggable tag="tbody" class="dragArea list-group" v-model:list="playlist.tracks" item-key="playlistTrackId"
              group="playlist" @end="updatePlaylistOrder">
              <template #item="{ element, index }">
                <TrackItem :key="element.playlistTrackId" :track="mapPlaylistTrack(element)" :track-number="index + 1"
                  :in-playlist="true" :playlists="playlist ? [playlist] : []" @play-track="playTrackFromList"
                  @track-options="handleTrackOptions($event, element)" />
              </template>
            </draggable>
          </table>
        </div>
      </div>
    </div>
    <!-- Rename Modal -->
    <dialog v-if="showRenameModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Rename Playlist</h3>
        <form @submit.prevent="renamePlaylist">
          <input v-model="renameValue" type="text" class="input input-bordered w-full mb-4" required />
          <div class="modal-action">
            <button type="button" class="btn" @click="showRenameModal = false">Cancel</button>
            <button type="submit" class="btn btn-primary">Save</button>
          </div>
        </form>
      </div>
    </dialog>
    <!-- Delete Modal -->
    <dialog v-if="showDeleteModal" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Delete Playlist</h3>
        <p>Are you sure you want to delete this playlist? This action cannot be undone.</p>
        <div class="modal-action">
          <button class="btn" @click="showDeleteModal = false">Cancel</button>
          <button class="btn btn-error" @click="deletePlaylist">Delete</button>
        </div>
      </div>
    </dialog>
    <!-- Add Tracks Modal (Stub) -->
    <dialog v-if="showAddTracksModal" class="modal modal-open">
      <div class="modal-box max-w-2xl">
        <h3 class="font-bold text-lg mb-4">Add Tracks to Playlist</h3>
        <!-- Implement track search and selection here -->
        <div class="modal-action">
          <button class="btn" @click="showAddTracksModal = false">Close</button>
        </div>
      </div>
    </dialog>
    <!-- Remove Track Modal -->
    <RemoveFromPlaylistModal v-if="playlist" v-model:open="isRemoveFromPlaylistModalOpen"
      :track="trackToRemove ? mapPlaylistTrack(trackToRemove) : null" :playlist-id="playlist.playlistId"
      @playlist-updated="handlePlaylistUpdated" />

    <!-- Add to Playlist Modal -->
    <AddToPlaylistModal v-model:open="isAddToPlaylistModalOpen" :track="trackForAddToPlaylistModal"
      @add-track="handleAddTrackToPlaylistConfirmed" />

    <!-- Edit Track Modal -->
    <EditTrackModal
      v-if="selectedTrackForEdit"
      :track="selectedTrackForEdit"
      :open="isEditTrackModalOpen"
      @close="handleEditModalClose"
      @track-updated="handleTrackSuccessfullyUpdated"
      @update-error="handleEditModalUpdateError"
    />

  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '~/stores/player';
import TrackItem from '~/components/track/track-item.vue';
import type { Playlist, PlaylistTrack } from '~/types/playlist';
import type { Track } from '~/types/track';
import { useNotification } from '~/composables/useNotification';
import RemoveFromPlaylistModal from '~/components/modals/remove-from-playlist-modal.vue';
import AddToPlaylistModal from '~/components/modals/add-to-playlist-modal.vue'; // Added
import EditTrackModal from '~/components/modals/edit-track-modal.vue';
import draggable from 'vuedraggable';

definePageMeta({
  layout: 'sidebar-layout'
  
});


const playerStore = usePlayerStore();

const route = useRoute();

const playlistId = computed((): string => route.params.id as string);

const pending = ref<boolean>(true);
const error = ref<boolean>(false);

const showRenameModal = ref(false);
const showDeleteModal = ref(false);
const showAddTracksModal = ref(false);
const renameValue = ref('');

const isAddToPlaylistModalOpen = ref(false); // Added
const trackForAddToPlaylistModal = ref<Track | null>(null); // Added

// State for EditTrackModal
const isEditTrackModalOpen = ref(false);
const selectedTrackForEdit = ref<Track | null>(null);
const { showNotification } = useNotification();

/**
 * Fetch playlist details from API
 */
pending.value = true;
error.value = false;

const { data: playlist, error: playlistError } = await useLazyFetch<Playlist>(`/api/playlists/${playlistId.value}`);

if (playlistError.value) {
  error.value = true;
  console.error('Failed to fetch playlist:', playlistError.value);
}


watch(playlist.value, (newPlaylist: Playlist | null) => {
  if (newPlaylist) {
    renameValue.value = newPlaylist.name;
    pending.value = false;
    useSeoMeta({
      title: usePageTitle('Playlists | ' + newPlaylist?.name)
    });
  }
});

async function fetchPlaylist() {
  const playlist = await $fetch(`/api/playlists/${playlistId.value}`);
  return playlist;
}

if (playlist.value) {
    renameValue.value = playlist.value.name;
    pending.value = false;
    useSeoMeta({
      title: usePageTitle('Playlists | ' + playlist.value?.name)
    });
}


const totalDuration = computed((): number => {
  if (!playlist.value) return 0;
  return playlist.value.tracks.reduce((sum: number, t: PlaylistTrack) => sum + (t.track?.duration || 0), 0);
});

function formatTrackCount(count: number): string {
  return count === 1 ? '1 track' : `${count} tracks`;
}

function mapPlaylistTrack(pt: PlaylistTrack): Track {
  if (!pt.track) {
    console.error('PlaylistTrack is missing the nested .track object. PlaylistTrack ID:', pt.playlistTrackId);
    // Return a fallback/default track structure to prevent further errors in TrackItem
    return {
      trackId: pt.trackId || 'error-unknown-track-id',
      title: 'Error: Track data unavailable',
      // artistName: 'Unknown Artist', // Removed: Use 'artists' array for artist info
      albumId: null,
      albumTitle: 'Unknown Album',
      duration: 0,
      filePath: '',
      coverPath: null,
      trackNumber: null,
      artistId: null, // Retained as it's an optional field in Track interface (string | null)
      genre: null,
      year: null,
      diskNumber: null,
      artists: [], // Correctly provides an empty array for artists
      explicit: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
  // The pt.track object should conform to the global Track type as per backend response and types/playlist.ts
  return pt.track;
}

function playPlaylist(): void {
  if (!playlist.value?.tracks.length || !playlistId.value) return;

  const tracks = playlist.value.tracks.map(mapPlaylistTrack);
  const firstTrack = tracks[0];
  if (!firstTrack) return;

  const thisPlaylistContext = { type: 'playlist' as const, id: playlistId.value };

  const isSameTrackAndContext =
    playerStore.currentTrack?.trackId === firstTrack.trackId &&
    playerStore.currentQueueContext.type === thisPlaylistContext.type &&
    playerStore.currentQueueContext.id === thisPlaylistContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    playerStore.loadQueue(tracks, thisPlaylistContext);
    playerStore.playFromQueue(0);
  }
}

function playTrackFromList(clickedTrack: Track): void {
  if (!playlist.value?.tracks.length || !playlistId.value) return;

  const thisPlaylistContext = { type: 'playlist' as const, id: playlistId.value };

  const isSameTrackAndContext =
    playerStore.currentTrack?.trackId === clickedTrack.trackId &&
    playerStore.currentQueueContext.type === thisPlaylistContext.type &&
    playerStore.currentQueueContext.id === thisPlaylistContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    const tracks = playlist.value.tracks.map(mapPlaylistTrack);
    const idx = tracks.findIndex((t: Track) => t.trackId === clickedTrack.trackId);
    if (idx !== -1) {
      playerStore.loadQueue(tracks, thisPlaylistContext);
      playerStore.playFromQueue(idx);
    }
  }
}

const isRemoveFromPlaylistModalOpen = ref(false);
const trackToRemove = ref<PlaylistTrack | null>(null);

function openTrackOptions(track: PlaylistTrack): void {
  // Handle track options menu click
}

const handleTrackOptions = (event: { action: string; track: Track }, playlistTrackElement?: PlaylistTrack): void => {
  const trackObject = event.track; // This is the full Track object from TrackItem's perspective

  if (event.action === 'edit-track') {
    // The EditTrackModal expects a Track object, which event.track should be.
    openEditModal(trackObject);
  } else if (event.action === 'add-to-playlist') {
    // AddToPlaylistModal also expects a Track object.
    trackForAddToPlaylistModal.value = trackObject;
    isAddToPlaylistModalOpen.value = true;
  } else if (event.action === 'remove-from-playlist') {
    // RemoveFromPlaylistModal uses trackToRemove (which is a PlaylistTrack)
    // and mapPlaylistTrack to get the Track object for display.
    // It needs playlistTrackElement to identify which item in playlist.tracks to remove.
    if (playlistTrackElement) {
      trackToRemove.value = playlistTrackElement;
      isRemoveFromPlaylistModalOpen.value = true;
    } else {
      console.warn('Remove from playlist action called without playlistTrackElement for track:', trackObject.title);
      // Fallback or error notification if playlistTrackElement is unexpectedly missing
      showNotification('Could not identify track in playlist for removal.', 'error');
    }
  } else {
    console.warn('Unhandled track option:', event.action, 'for track:', trackObject.title);
  }
};

async function handleRemoveTrackFromPlaylist(payload: { trackId: string; playlistId: string }): Promise<void> {
  if (!playlist.value) return;

  try {
    await $fetch(`/api/playlists/${playlist.value.playlistId}/tracks`, {
      method: 'DELETE',
      body: {
        trackIds: [payload.trackId]
      }
    });

    showNotification('Track removed from playlist');
    await fetchPlaylist(); // Refresh the playlist data
  } catch (error) {
    showNotification('Failed to remove track from playlist', 'error');
  }
}

async function handlePlaylistUpdated(updatedPlaylist: Playlist): Promise<void> {
  if (!updatedPlaylist) return;

  // Update the local playlist data with the response from the API
  playlist.value = updatedPlaylist;
  showNotification('Playlist updated');
}

async function renamePlaylist(): Promise<void> {
  if (!playlist.value) return;
  try {
    await $fetch(`/api/playlists/${playlist.value.playlistId}/rename`, {
      method: 'PUT',
      body: { name: renameValue.value },
    });
    showNotification('Playlist renamed successfully.');
    showRenameModal.value = false;
    await fetchPlaylist();
  } catch (e) {
    showNotification('Failed to rename playlist.', 'error');
  }
}

async function deletePlaylist(): Promise<void> {
  if (!playlist.value) return;
  try {
    await $fetch(`/api/playlists/${playlist.value.playlistId}`, { method: 'DELETE' });
    showNotification('Playlist deleted.', 'success');
    navigateTo('/playlists');
  } catch (e) {
    showNotification('Failed to delete playlist.', 'error');
  }
}

async function handleAddTrackToPlaylistConfirmed(payload: { trackId: string; playlistId: string }): Promise<void> {
  // The modal already made the API call. We just show a notification.
  // To show the target playlist's name, we might need to fetch all user playlists if it's not the current one.
  if (playlist.value && payload.playlistId === playlist.value.playlistId) {
    showNotification(`Track added to ${playlist.value.name}`, 'success');
    // Optionally, re-fetch current playlist to show the newly added track if not already handled by modal's parent page update logic
    // await fetchPlaylist(); // Uncomment if needed and if AddToPlaylistModal doesn't trigger a wider state update
  } else {
    showNotification('Track added to playlist', 'success');
  }
}

// Edit Track Modal Handlers
const openEditModal = (track: Track): void => {
  selectedTrackForEdit.value = track;
  isEditTrackModalOpen.value = true;
};

const handleEditModalClose = (): void => {
  isEditTrackModalOpen.value = false;
  selectedTrackForEdit.value = null;
};

const handleTrackSuccessfullyUpdated = async (updatedTrack: Track): Promise<void> => {
  showNotification(`Track '${updatedTrack.title}' updated.`, 'success');
  if (playlist.value) {
    const index = playlist.value.tracks.findIndex((pt: PlaylistTrack) => pt.track?.trackId === updatedTrack.trackId);
    if (index !== -1 && playlist.value.tracks[index].track) {
      // Create a new object for reactivity for the specific track
      const newTrackData = { ...playlist.value.tracks[index].track, ...updatedTrack };
      // Create a new object for the playlistTrack item for reactivity
      playlist.value.tracks[index] = { ...playlist.value.tracks[index], track: newTrackData };
      // Force a refresh of the array for components like draggable if necessary
      playlist.value.tracks = [...playlist.value.tracks];
    } else {
      // Fallback: If track not found or structure is complex, refetch the whole playlist
      const refreshedPlaylist = await fetchPlaylist(); // Ensure fetchPlaylist returns the new playlist data
      if (refreshedPlaylist) playlist.value = refreshedPlaylist;
    }
  }
  handleEditModalClose();
};

const handleEditModalUpdateError = (errorMessage: string): void => {
  showNotification(`Error: ${errorMessage}`, 'error');
  // Decide if modal should close or stay open for user to retry/see error
};

async function updatePlaylistOrder(): Promise<void> {
  if (!playlist.value || !playlist.value.tracks) return;

  const orderedTrackIds = playlist.value.tracks.map((t: PlaylistTrack) => t.playlistTrackId);

  try {
    const updatedPlaylistData = await $fetch<Playlist>(`/api/playlists/${playlistId.value}/reorder`, {
      method: 'PUT',
      body: { playlistTrackIds: orderedTrackIds },
    });
    playlist.value = updatedPlaylistData;
    showNotification('Playlist order updated successfully!', 'success');
  } catch (err: any) {
    showNotification(`Error updating playlist order: ${err.data?.message || err.message || 'Unknown error'}`, 'error');
    await fetchPlaylist(); // Revert optimistic update if API call fails
  }
}

</script>

<style scoped>
.sortable-ghost {
  opacity: 0.5;
  background: #f0f0f0;
  border: 2px dashed #ccc;
}

.toast {
  position: fixed;
  bottom: 2rem;
  right: 2rem;
  z-index: 1000;
  padding: 1rem 2rem;
  border-radius: 0.5rem;
  font-weight: 600;
  color: #fff;
  background: #323232;
}

.toast-success {
  background: #22c55e;
}

.toast-error {
  background: #ef4444;
}
</style>
