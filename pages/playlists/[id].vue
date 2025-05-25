<template>
  <div class="container mx-auto px-4 py-8 space-y-8">
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
            <tbody>
              <TrackItem
                v-for="(track, i) in playlist.tracks"
                :key="track.playlistTrackId"
                :track="mapPlaylistTrack(track)"
                :track-number="i + 1"
                @play-track="playTrackFromList"
                @track-options="openTrackOptions(track)"
              />
            </tbody>
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
    <!-- Notification -->
    <div v-if="notification.visible" :class="['toast', notification.type === 'error' ? 'toast-error' : 'toast-success']">
      {{ notification.message }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router';
import { usePlayerStore } from '~/stores/player';
import TrackItem from '~/components/track/track-item.vue';
import type { Playlist, PlaylistTrack } from '~/types/playlist';
import type { Track } from '~/types/track';
import type { NotificationMessage } from '~/types/notification-message';

definePageMeta({
  layout: 'sidebar-layout'
});

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();

const playlistId = computed((): string => route.params.id as string);

const pending = ref<boolean>(true);
const error = ref<boolean>(false);
const playlist = ref<Playlist | null>(null);

const showRenameModal = ref(false);
const showDeleteModal = ref(false);
const showAddTracksModal = ref(false);
const renameValue = ref('');

const notification = ref<NotificationMessage>({ message: '', type: 'info', visible: false });

function showNotification(message: string, type: 'success' | 'error' = 'success'): void {
  notification.value = { message, type, visible: true };
  setTimeout(() => (notification.value.visible = false), 2500);
}

/**
 * Fetch playlist details from API
 */
async function fetchPlaylist(): Promise<void> {
  pending.value = true;
  error.value = false;
  try {
    const data = await $fetch<Playlist>(`/api/playlists/${playlistId.value}`);
    playlist.value = data;
    renameValue.value = data.name;
  } catch (e) {
    error.value = true;
  } finally {
    pending.value = false;
  }
}

onMounted(fetchPlaylist);

const totalDuration = computed((): number => {
  if (!playlist.value) return 0;
  return playlist.value.tracks.reduce((sum: number, t: PlaylistTrack) => sum + (t.duration || 0), 0);
});

function formatTrackCount(count: number): string {
  return count === 1 ? '1 track' : `${count} tracks`;
}

function mapPlaylistTrack(track: PlaylistTrack): Track {
  return {
    trackId: track.trackId,
    title: track.title,
    artistName: track.artistName,
    albumId: track.albumId,
    albumTitle: track.albumTitle,
    duration: track.duration,
    filePath: track.filePath || '', // Ensure filePath is not null
    coverPath: track.coverPath,
    trackNumber: track.trackNumber ?? null, // Added from PlaylistTrack
    artistId: track.artistId, // Added from PlaylistTrack
  };
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

function openTrackOptions(track: PlaylistTrack): void {
  // Implement options menu if needed
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
</script>

<style scoped>
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
.toast-success { background: #22c55e; }
.toast-error { background: #ef4444; }
</style>
