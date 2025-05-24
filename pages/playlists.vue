<template>
  <div class="relative">
    <!-- Top Bar: Search + Create Playlist Button -->
    <div class="flex justify-between items-center mb-2 sticky top-0 bg-base-200/80 backdrop-blur py-2 z-10">
      <div class="form-control">
        <input 
          type="text" 
          placeholder="Search Playlists..." 
          class="input input-bordered w-72 md:w-96" 
          v-model="searchQuery" 
        />
      </div>
      <div class="flex items-center gap-4">
        <button 
          class="btn btn-primary btn-sm" 
          @click="openCreatePlaylistModal"
        >
          <Icon name="material-symbols:add" class="w-5 h-5 mr-1" />
          New Playlist
        </button>
      </div>
    </div>

    <!-- Loading and Error States -->
    <div v-if="pending" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <div v-else-if="error" class="alert alert-error mt-4">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Failed to load playlists. Please try again later.</span>
    </div>

    <!-- Empty State -->
    <div v-else-if="!playlists || playlists.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="material-symbols:playlist-add-circle-outline" class="w-20 h-20 text-primary mb-4" />
      <h3 class="text-xl font-bold mb-2">No Playlists Yet</h3>
      <p class="text-base-content/70 mb-6 max-w-md">
        Create your first playlist to organize your favorite tracks
      </p>
      <button 
        class="btn btn-primary" 
        @click="openCreatePlaylistModal"
      >
        <Icon name="material-symbols:add" class="w-5 h-5 mr-1" />
        Create Playlist
      </button>
    </div>

    <!-- Playlists Grid -->
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
      <div 
        v-for="playlist in filteredPlaylists" 
        :key="playlist.playlistId" 
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group"
        @click="navigateToPlaylist(playlist.playlistId)"
      >
        <!-- Playlist Cover (Default or Generated) -->
        <figure class="relative pt-[100%] bg-base-300 overflow-hidden">
          <!-- Playlist Cover Image (if available) -->
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="grid grid-cols-2 w-full h-full">
              <!-- We'll show up to 4 album covers from the playlist if available -->
              <div class="bg-base-200 aspect-square"></div>
              <div class="bg-base-300 aspect-square"></div>
              <div class="bg-base-200 aspect-square"></div>
              <div class="bg-base-300 aspect-square"></div>
            </div>
            
            <!-- Play Button Overlay -->
            <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
              <button 
                class="btn btn-circle btn-primary"
                @click.stop="playPlaylist(playlist.playlistId)"
              >
                <Icon name="material-symbols:play-arrow" class="w-8 h-8" />
              </button>
            </div>
          </div>
        </figure>
        
        <div class="card-body p-4">
          <h2 class="card-title text-base truncate">{{ playlist.name }}</h2>
          <p class="text-sm text-base-content/70">
            {{ formatTrackCount(playlist.trackCount) }}
          </p>
          
          <!-- Action Buttons -->
          <div class="card-actions justify-end mt-2">
            <div class="dropdown dropdown-end">
              <button tabindex="0" class="btn btn-ghost btn-sm btn-circle" @click.stop>
                <Icon name="material-symbols:more-vert" class="w-5 h-5" />
              </button>
              <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
                <li><a @click.stop="editPlaylist(playlist)">Rename</a></li>
                <li><a @click.stop="deletePlaylist(playlist.playlistId)" class="text-error">Delete</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Create Playlist Modal -->
    <dialog ref="createPlaylistModal" class="modal" style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 50;">
      <div class="modal-box p-6 max-w-md">
        <h3 class="font-bold text-lg mb-4">Create New Playlist</h3>
        <form @submit.prevent="createPlaylist">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Playlist Name</span>
            </label>
            <input 
              type="text" 
              v-model="newPlaylistName" 
              placeholder="My Awesome Playlist" 
              class="input input-bordered w-full" 
              required
              ref="playlistNameInput"
            />
          </div>
          <div class="modal-action">
            <button type="button" class="btn" @click="closeCreatePlaylistModal">Cancel</button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              :disabled="isCreatingPlaylist || !newPlaylistName.trim()"
            >
              <span v-if="isCreatingPlaylist" class="loading loading-spinner loading-xs mr-2"></span>
              Create
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Edit Playlist Modal -->
    <dialog ref="editPlaylistModal" class="modal modal-middle">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Rename Playlist</h3>
        <form @submit.prevent="updatePlaylist">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Playlist Name</span>
            </label>
            <input 
              type="text" 
              v-model="editPlaylistName" 
              placeholder="Playlist Name" 
              class="input input-bordered w-full" 
              required
              ref="editPlaylistNameInput"
            />
          </div>
          <div class="modal-action">
            <button type="button" class="btn" @click="closeEditPlaylistModal">Cancel</button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              :disabled="isUpdatingPlaylist || !editPlaylistName.trim()"
            >
              <span v-if="isUpdatingPlaylist" class="loading loading-spinner loading-xs mr-2"></span>
              Save
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>

    <!-- Delete Confirmation Modal -->
    <dialog ref="deletePlaylistModal" class="modal modal-middle">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Delete Playlist</h3>
        <p>Are you sure you want to delete this playlist? This action cannot be undone.</p>
        <div class="modal-action">
          <button class="btn" @click="closeDeletePlaylistModal">Cancel</button>
          <button 
            class="btn btn-error" 
            :disabled="isDeletingPlaylist"
            @click="confirmDeletePlaylist"
          >
            <span v-if="isDeletingPlaylist" class="loading loading-spinner loading-xs mr-2"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore, type Track } from '~/stores/player';

// Define types
interface Playlist {
  playlistId: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  trackCount?: number; // This will be calculated on the frontend
}

// State
const searchQuery = ref('');
const newPlaylistName = ref('');
const editPlaylistName = ref('');
const currentPlaylistId = ref<string | null>(null);
const isCreatingPlaylist = ref(false);
const isUpdatingPlaylist = ref(false);
const isDeletingPlaylist = ref(false);

// Refs for modals
const createPlaylistModal = ref<HTMLDialogElement | null>(null);
const editPlaylistModal = ref<HTMLDialogElement | null>(null);
const deletePlaylistModal = ref<HTMLDialogElement | null>(null);
const playlistNameInput = ref<HTMLInputElement | null>(null);
const editPlaylistNameInput = ref<HTMLInputElement | null>(null);

// Fetch playlists
const { data: playlists, pending, error, refresh } = useFetch<Playlist[]>('/api/playlists', {
  lazy: true,
  server: false,
  transform: (data: any[]) => {
    // Add trackCount property (will be updated when we implement the API)
    return data.map(playlist => ({
      ...playlist,
      trackCount: 0 // Placeholder, will be populated from API
    }));
  }
});

// Initialize player store
const playerStore = usePlayerStore();

// Computed
const filteredPlaylists = computed(() => {
  if (!playlists.value) return [];
  if (!searchQuery.value.trim()) return playlists.value;
  
  const query = searchQuery.value.toLowerCase();
  return playlists.value.filter((playlist: Playlist) => 
    playlist.name.toLowerCase().includes(query)
  );
});

// Modal functions
const openCreatePlaylistModal = () => {
  newPlaylistName.value = '';
  createPlaylistModal.value?.showModal();
  // Focus the input after the modal is shown
  setTimeout(() => {
    playlistNameInput.value?.focus();
  }, 100);
};

const closeCreatePlaylistModal = () => {
  createPlaylistModal.value?.close();
};

const openEditPlaylistModal = (playlist: Playlist) => {
  currentPlaylistId.value = playlist.playlistId;
  editPlaylistName.value = playlist.name;
  editPlaylistModal.value?.showModal();
  // Focus the input after the modal is shown
  setTimeout(() => {
    editPlaylistNameInput.value?.focus();
  }, 100);
};

const closeEditPlaylistModal = () => {
  editPlaylistModal.value?.close();
};

const openDeletePlaylistModal = (playlistId: string) => {
  currentPlaylistId.value = playlistId;
  deletePlaylistModal.value?.showModal();
};

const closeDeletePlaylistModal = () => {
  deletePlaylistModal.value?.close();
};

// CRUD operations
const createPlaylist = async () => {
  if (!newPlaylistName.value.trim()) return;
  
  try {
    isCreatingPlaylist.value = true;
    
    await $fetch('/api/playlists', {
      method: 'POST',
      body: {
        name: newPlaylistName.value.trim()
      }
    });
    
    // Refresh the playlists list
    await refresh();
    
    // Close the modal
    closeCreatePlaylistModal();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to create playlist:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isCreatingPlaylist.value = false;
  }
};

const editPlaylist = (playlist: Playlist) => {
  openEditPlaylistModal(playlist);
};

const updatePlaylist = async () => {
  if (!currentPlaylistId.value || !editPlaylistName.value.trim()) return;
  
  try {
    isUpdatingPlaylist.value = true;
    
    await $fetch(`/api/playlists/${currentPlaylistId.value}`, {
      method: 'PUT',
      body: {
        name: editPlaylistName.value.trim()
      }
    });
    
    // Refresh the playlists list
    await refresh();
    
    // Close the modal
    closeEditPlaylistModal();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to update playlist:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isUpdatingPlaylist.value = false;
  }
};

const deletePlaylist = (playlistId: string) => {
  openDeletePlaylistModal(playlistId);
};

const confirmDeletePlaylist = async () => {
  if (!currentPlaylistId.value) return;
  
  try {
    isDeletingPlaylist.value = true;
    
    await $fetch(`/api/playlists/${currentPlaylistId.value}`, {
      method: 'DELETE'
    });
    
    // Refresh the playlists list
    await refresh();
    
    // Close the modal
    closeDeletePlaylistModal();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to delete playlist:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isDeletingPlaylist.value = false;
  }
};

// Navigation
const navigateToPlaylist = (playlistId: string) => {
  navigateTo(`/playlists/${playlistId}`);
};

// Playback
const playPlaylist = async (playlistId: string) => {
  try {
    // Fetch the playlist with its tracks
    const playlistWithTracks = await $fetch<any>(`/api/playlists/${playlistId}`);
    
    if (!playlistWithTracks.tracks || playlistWithTracks.tracks.length === 0) {
      console.warn('No tracks in this playlist');
      return;
    }
    
    // Load the tracks into the player queue
    playerStore.loadQueue(playlistWithTracks.tracks);
    
    // Start playing from the first track
    playerStore.playFromQueue(0);
  } catch (err) {
    console.error('Error playing playlist:', err);
  }
};

// Utility functions
const formatTrackCount = (count: number): string => {
  return count === 1 ? '1 track' : `${count} tracks`;
};

// Lifecycle
onMounted(() => {
  // Fetch playlists on component mount
  refresh();
});

definePageMeta({
  layout: 'sidebar-layout'
});
</script>

<style scoped>
/* Any additional styles can go here */
</style>
