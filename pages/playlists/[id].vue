<template>
  <div>
    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error mt-4">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Failed to load playlist. Please try again later.</span>
    </div>
    
    <!-- Playlist Content -->
    <div v-else-if="playlist" class="pb-16">
      <!-- Back Button and Actions -->
      <div class="flex justify-between items-center mb-4">
        <button class="btn btn-ghost btn-sm gap-1" @click="navigateBack">
          <Icon name="material-symbols:arrow-back" class="w-5 h-5" />
          Back to Playlists
        </button>
        
        <div class="dropdown dropdown-end">
          <button tabindex="0" class="btn btn-ghost btn-sm">
            <Icon name="material-symbols:more-vert" class="w-5 h-5" />
          </button>
          <ul tabindex="0" class="dropdown-content z-[1] menu p-2 shadow bg-base-100 rounded-box w-52">
            <li><a @click="openRenameModal">Rename</a></li>
            <li><a @click="exportPlaylist">Export</a></li>
            <li><a @click="openDeleteModal" class="text-error">Delete</a></li>
          </ul>
        </div>
      </div>
      
      <!-- Playlist Header -->
      <div class="flex flex-col md:flex-row gap-6 mb-8">
        <!-- Playlist Cover -->
        <div class="w-full md:w-64 aspect-square bg-base-300 rounded-lg overflow-hidden flex-shrink-0">
          <div class="grid grid-cols-2 w-full h-full">
            <!-- We'll show up to 4 album covers from the playlist if available -->
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
          </div>
        </div>
        
        <!-- Playlist Info -->
        <div class="flex flex-col justify-between">
          <div>
            <h1 class="text-3xl font-bold mb-2">{{ playlist.name }}</h1>
            <p class="text-base-content/70">
              {{ formatTrackCount(playlist.tracks?.length || 0) }} • 
              {{ formatDuration(calculateTotalDuration()) }}
            </p>
          </div>
          
          <!-- Play Button -->
          <div class="flex gap-2 mt-4">
            <button 
              class="btn btn-primary gap-2" 
              @click="playPlaylist"
              :disabled="!playlist.tracks || playlist.tracks.length === 0"
            >
              <Icon name="material-symbols:play-arrow" class="w-6 h-6" />
              Play
            </button>
            <button 
              class="btn btn-outline gap-2" 
              @click="openAddTracksModal"
            >
              <Icon name="material-symbols:add" class="w-5 h-5" />
              Add Tracks
            </button>
          </div>
        </div>
      </div>
      
      <!-- Empty State -->
      <div v-if="!playlist.tracks || playlist.tracks.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="material-symbols:music-note" class="w-16 h-16 text-primary mb-4" />
        <h3 class="text-xl font-bold mb-2">No Tracks Yet</h3>
        <p class="text-base-content/70 mb-6 max-w-md">
          Add some tracks to your playlist to get started
        </p>
        <button 
          class="btn btn-primary" 
          @click="openAddTracksModal"
        >
          <Icon name="material-symbols:add" class="w-5 h-5 mr-1" />
          Add Tracks
        </button>
      </div>
      
      <!-- Track List -->
      <div v-else>
        <!-- Track List Header -->
        <div class="grid grid-cols-playlist-track items-center py-2 px-4 text-sm font-medium text-base-content/70 border-b border-base-300">
          <div class="flex items-center">#</div>
          <div>Title</div>
          <div>Album</div>
          <div>Duration</div>
          <div></div> <!-- Actions column -->
        </div>
        
        <!-- Tracks -->
        <div 
          class="tracks-container"
          ref="tracksContainer"
        >
          <div
            v-for="(track, index) in playlist.tracks"
            :key="track.playlistTrackId"
            :data-track-id="track.trackId"
            :data-index="index"
            class="grid grid-cols-playlist-track items-center py-3 px-4 hover:bg-base-200 transition-colors border-b border-base-300 group"
            :class="{ 'bg-base-200': isCurrentTrack(track.trackId) }"
            draggable="true"
            @dragstart="onDragStart($event, index)"
            @dragover="onDragOver($event, index)"
            @drop="onDrop($event, index)"
            @dragenter="onDragEnter($event, index)"
            @dragleave="onDragLeave($event)"
          >
            <!-- Track Number/Play Button -->
            <div class="flex items-center">
              <button 
                class="w-8 h-8 flex items-center justify-center"
                @click="playTrack(index)"
              >
                <span v-if="!isCurrentTrack(track.trackId) || (isCurrentTrack(track.trackId) && !isPlaying)" class="group-hover:hidden">{{ index + 1 }}</span>
                <Icon 
                  v-if="isCurrentTrack(track.trackId) && isPlaying" 
                  name="material-symbols:pause" 
                  class="w-5 h-5 text-primary" 
                />
                <Icon 
                  v-else
                  name="material-symbols:play-arrow" 
                  class="w-5 h-5 hidden group-hover:block" 
                />
              </button>
            </div>
            
            <!-- Track Info -->
            <div class="flex items-center gap-3 overflow-hidden">
              <!-- Album Cover -->
              <div class="w-10 h-10 bg-base-300 rounded flex-shrink-0 overflow-hidden">
                <img 
                  v-if="track.coverPath" 
                  :src="track.coverPath" 
                  :alt="track.albumTitle" 
                  class="w-full h-full object-cover"
                />
              </div>
              
              <!-- Track Title and Artist -->
              <div class="overflow-hidden">
                <div class="font-medium truncate" :class="{ 'text-primary': isCurrentTrack(track.trackId) }">
                  {{ track.title }}
                </div>
                <div class="text-sm text-base-content/70 truncate">
                  {{ track.artistName }}
                </div>
              </div>
            </div>
            
            <!-- Album -->
            <div class="truncate">
              {{ track.albumTitle }}
            </div>
            
            <!-- Duration -->
            <div class="text-base-content/70">
              {{ formatDuration(track.duration) }}
            </div>
            
            <!-- Actions -->
            <div class="flex justify-end">
              <button 
                class="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
                @click.stop="removeTrack(track.trackId)"
              >
                <Icon name="material-symbols:delete-outline" class="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    <!-- Rename Playlist Modal -->
    <dialog ref="renameModal" class="modal modal-middle">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Rename Playlist</h3>
        <form @submit.prevent="renamePlaylist">
          <div class="form-control">
            <label class="label">
              <span class="label-text">Playlist Name</span>
            </label>
            <input 
              type="text" 
              v-model="newPlaylistName" 
              placeholder="Playlist Name" 
              class="input input-bordered w-full" 
              required
              ref="playlistNameInput"
            />
          </div>
          <div class="modal-action">
            <button type="button" class="btn" @click="closeRenameModal">Cancel</button>
            <button 
              type="submit" 
              class="btn btn-primary" 
              :disabled="isUpdating || !newPlaylistName.trim()"
            >
              <span v-if="isUpdating" class="loading loading-spinner loading-xs mr-2"></span>
              Save
            </button>
          </div>
        </form>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
    
    <!-- Delete Playlist Modal -->
    <dialog ref="deleteModal" class="modal modal-middle">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Delete Playlist</h3>
        <p>Are you sure you want to delete this playlist? This action cannot be undone.</p>
        <div class="modal-action">
          <button class="btn" @click="closeDeleteModal">Cancel</button>
          <button 
            class="btn btn-error" 
            :disabled="isDeleting"
            @click="deletePlaylist"
          >
            <span v-if="isDeleting" class="loading loading-spinner loading-xs mr-2"></span>
            Delete
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button>close</button>
      </form>
    </dialog>
    
    <!-- Add Tracks Modal -->
    <dialog ref="addTracksModal" class="modal modal-middle">
      <div class="modal-box max-w-3xl">
        <h3 class="font-bold text-lg mb-4">Add Tracks to Playlist</h3>
        
        <!-- Search Input -->
        <div class="form-control mb-4">
          <input 
            type="text" 
            v-model="trackSearchQuery" 
            placeholder="Search for tracks..." 
            class="input input-bordered w-full" 
          />
        </div>
        
        <!-- Track Selection List -->
        <div class="max-h-96 overflow-y-auto">
          <div v-if="isSearchingTracks" class="flex justify-center items-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
          
          <div v-else-if="searchResults.length === 0 && trackSearchQuery.trim()" class="py-8 text-center">
            <p>No tracks found matching your search.</p>
          </div>
          
          <div v-else-if="searchResults.length === 0" class="py-8 text-center">
            <p>Search for tracks to add to your playlist.</p>
          </div>
          
          <div v-else>
            <div 
              v-for="track in searchResults" 
              :key="track.trackId"
              class="flex items-center justify-between py-2 px-3 hover:bg-base-200 rounded-lg transition-colors"
            >
              <!-- Track Info -->
              <div class="flex items-center gap-3 overflow-hidden">
                <!-- Album Cover -->
                <div class="w-10 h-10 bg-base-300 rounded flex-shrink-0 overflow-hidden">
                  <img 
                    v-if="track.coverPath" 
                    :src="track.coverPath" 
                    :alt="track.albumTitle" 
                    class="w-full h-full object-cover"
                  />
                </div>
                
                <!-- Track Title and Artist -->
                <div class="overflow-hidden">
                  <div class="font-medium truncate">
                    {{ track.title }}
                  </div>
                  <div class="text-sm text-base-content/70 truncate">
                    {{ track.artistName }} • {{ track.albumTitle }}
                  </div>
                </div>
              </div>
              
              <!-- Add Button -->
              <button 
                class="btn btn-ghost btn-sm btn-circle"
                @click="selectTrackToAdd(track)"
                :disabled="selectedTrackIds.includes(track.trackId)"
              >
                <Icon 
                  :name="selectedTrackIds.includes(track.trackId) ? 'material-symbols:check' : 'material-symbols:add'" 
                  class="w-5 h-5"
                  :class="{'text-primary': selectedTrackIds.includes(track.trackId)}"
                />
              </button>
            </div>
          </div>
        </div>
        
        <!-- Selected Tracks Summary -->
        <div v-if="selectedTrackIds.length > 0" class="mt-4 p-3 bg-base-200 rounded-lg">
          <div class="flex justify-between items-center">
            <span>{{ selectedTrackIds.length }} track{{ selectedTrackIds.length !== 1 ? 's' : '' }} selected</span>
            <button class="btn btn-ghost btn-xs" @click="clearSelectedTracks">Clear</button>
          </div>
        </div>
        
        <div class="modal-action">
          <button class="btn" @click="closeAddTracksModal">Cancel</button>
          <button 
            class="btn btn-primary" 
            :disabled="isAddingTracks || selectedTrackIds.length === 0"
            @click="addTracksToPlaylist"
          >
            <span v-if="isAddingTracks" class="loading loading-spinner loading-xs mr-2"></span>
            Add to Playlist
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
import { useRoute, useRouter } from 'vue-router';

// Types
interface PlaylistTrack extends Track {
  playlistTrackId: string;
  order: number;
}

interface Playlist {
  playlistId: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  tracks?: PlaylistTrack[];
}

// Route and Router
const route = useRoute();
const router = useRouter();
const playlistId = computed(() => route.params.id as string);

// Player Store
const playerStore = usePlayerStore();
const isPlaying = computed(() => playerStore.isPlaying);

// State
const newPlaylistName = ref('');
const trackSearchQuery = ref('');
const selectedTrackIds = ref<string[]>([]);
const isUpdating = ref(false);
const isDeleting = ref(false);
const isAddingTracks = ref(false);
const isSearchingTracks = ref(false);
const isDragging = ref(false);
const draggedIndex = ref<number | null>(null);
const dragOverIndex = ref<number | null>(null);
const reorderDebounceTimeout = ref<NodeJS.Timeout | null>(null);
const searchResults = ref<Track[]>([]);

// Refs
const renameModal = ref<HTMLDialogElement | null>(null);
const deleteModal = ref<HTMLDialogElement | null>(null);
const addTracksModal = ref<HTMLDialogElement | null>(null);
const playlistNameInput = ref<HTMLInputElement | null>(null);
const tracksContainer = ref<HTMLElement | null>(null);

// Fetch playlist data
const { data: playlist, pending, error, refresh } = useFetch<Playlist>(() => `/api/playlists/${playlistId.value}`, {
  lazy: true,
  server: false,
  watch: [playlistId]
});

// Methods
const navigateBack = () => {
  router.push('/playlists');
};

const isCurrentTrack = (trackId: string): boolean => {
  return playerStore.currentTrack?.trackId === trackId;
};

const playTrack = (index: number) => {
  if (!playlist.value?.tracks) return;
  
  // If this is the current track, just toggle play/pause
  if (isCurrentTrack(playlist.value.tracks[index].trackId)) {
    playerStore.togglePlayPause();
    return;
  }
  
  // Otherwise, load the playlist and play from this track
  playerStore.loadQueue(playlist.value.tracks);
  playerStore.playFromQueue(index);
};

const playPlaylist = () => {
  if (!playlist.value?.tracks || playlist.value.tracks.length === 0) return;
  
  playerStore.loadQueue(playlist.value.tracks);
  playerStore.playFromQueue(0);
};

// Rename Playlist
const openRenameModal = () => {
  if (!playlist.value) return;
  
  newPlaylistName.value = playlist.value.name;
  renameModal.value?.showModal();
  
  // Focus the input after the modal is shown
  setTimeout(() => {
    playlistNameInput.value?.focus();
  }, 100);
};

const closeRenameModal = () => {
  renameModal.value?.close();
};

const renamePlaylist = async () => {
  if (!playlist.value || !newPlaylistName.value.trim()) return;
  
  try {
    isUpdating.value = true;
    
    await $fetch(`/api/playlists/${playlistId.value}`, {
      method: 'PUT',
      body: {
        name: newPlaylistName.value.trim()
      }
    });
    
    // Refresh the playlist data
    await refresh();
    
    // Close the modal
    closeRenameModal();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to rename playlist:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isUpdating.value = false;
  }
};

// Delete Playlist
const openDeleteModal = () => {
  deleteModal.value?.showModal();
};

const closeDeleteModal = () => {
  deleteModal.value?.close();
};

const deletePlaylist = async () => {
  try {
    isDeleting.value = true;
    
    await $fetch(`/api/playlists/${playlistId.value}`, {
      method: 'DELETE'
    });
    
    // Navigate back to playlists page
    navigateBack();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to delete playlist:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isDeleting.value = false;
  }
};

// Remove Track
const removeTrack = async (trackId: string) => {
  if (!confirm('Are you sure you want to remove this track from the playlist?')) return;
  
  try {
    await $fetch(`/api/playlists/${playlistId.value}/tracks`, {
      method: 'POST',
      body: {
        action: 'remove',
        trackIds: [trackId]
      }
    });
    
    // Refresh the playlist data
    await refresh();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to remove track:', err);
    // Show error toast
    // If you have a toast system, use it here
  }
};

// Add Tracks
const openAddTracksModal = () => {
  trackSearchQuery.value = '';
  selectedTrackIds.value = [];
  searchResults.value = [];
  addTracksModal.value?.showModal();
};

const closeAddTracksModal = () => {
  addTracksModal.value?.close();
};

// Search tracks function
const searchTracksTimeout = ref<NodeJS.Timeout | null>(null);

const searchTracks = async (): Promise<void> => {
  if (!trackSearchQuery.value.trim()) {
    searchResults.value = [];
    return;
  }
  
  try {
    isSearchingTracks.value = true;
    
    // Fetch tracks matching the search query
    const results = await $fetch<Track[]>('/api/tracks', {
      params: {
        query: trackSearchQuery.value.trim()
      }
    });
    
    searchResults.value = results;
  } catch (err: any) {
    console.error('Failed to search tracks:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isSearchingTracks.value = false;
  }
};

// Create a wrapper function that debounces the search
const debouncedSearchTracks = (): void => {
  if (searchTracksTimeout.value) {
    clearTimeout(searchTracksTimeout.value);
  }
  searchTracksTimeout.value = setTimeout(() => {
    searchTracks();
  }, 300);
};

// Watch for changes to the search query
watch(trackSearchQuery, () => {
  debouncedSearchTracks();
});

const selectTrackToAdd = (track: Track) => {
  if (selectedTrackIds.value.includes(track.trackId)) {
    // Remove from selection
    selectedTrackIds.value = selectedTrackIds.value.filter((id: string) => id !== track.trackId);
  } else {
    // Add to selection
    selectedTrackIds.value.push(track.trackId);
  }
};

const clearSelectedTracks = () => {
  selectedTrackIds.value = [];
};

const addTracksToPlaylist = async () => {
  if (selectedTrackIds.value.length === 0) return;
  
  try {
    isAddingTracks.value = true;
    
    await $fetch(`/api/playlists/${playlistId.value}/tracks`, {
      method: 'POST',
      body: {
        action: 'add',
        trackIds: selectedTrackIds.value
      }
    });
    
    // Refresh the playlist data
    await refresh();
    
    // Close the modal
    closeAddTracksModal();
    
    // Show success toast
    // If you have a toast system, use it here
  } catch (err: any) {
    console.error('Failed to add tracks:', err);
    // Show error toast
    // If you have a toast system, use it here
  } finally {
    isAddingTracks.value = false;
  }
};

// Drag and Drop Reordering
const onDragStart = (event: DragEvent, index: number) => {
  if (!event.dataTransfer) return;
  
  isDragging.value = true;
  draggedIndex.value = index;
  
  // Set data for the drag operation
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', index.toString());
  
  // Add a class to the dragged element
  const target = event.target as HTMLElement;
  target.classList.add('dragging');
};

const onDragOver = (event: DragEvent, index: number) => {
  event.preventDefault();
  dragOverIndex.value = index;
};

const onDragEnter = (event: DragEvent, index: number) => {
  event.preventDefault();
  const target = event.target as HTMLElement;
  const trackElement = target.closest('[data-index]') as HTMLElement;
  
  if (trackElement) {
    trackElement.classList.add('drag-over');
  }
};

const onDragLeave = (event: DragEvent) => {
  const target = event.target as HTMLElement;
  const trackElement = target.closest('[data-index]') as HTMLElement;
  
  if (trackElement) {
    trackElement.classList.remove('drag-over');
  }
};

const onDrop = async (event: DragEvent, dropIndex: number) => {
  event.preventDefault();
  
  // Remove drag-over class from all elements
  const trackElements = document.querySelectorAll('[data-index]');
  trackElements.forEach(el => el.classList.remove('drag-over', 'dragging'));
  
  // Get the dragged index
  if (draggedIndex.value === null || draggedIndex.value === dropIndex) {
    isDragging.value = false;
    draggedIndex.value = null;
    dragOverIndex.value = null;
    return;
  }
  
  // Reorder the tracks locally
  if (playlist.value?.tracks) {
    const tracks = [...playlist.value.tracks];
    const [movedTrack] = tracks.splice(draggedIndex.value, 1);
    tracks.splice(dropIndex, 0, movedTrack);
    
    // Update the playlist with the new order
    playlist.value = {
      ...playlist.value,
      tracks
    };
    
    // Debounce the API call to save the new order
    if (reorderDebounceTimeout.value) {
      clearTimeout(reorderDebounceTimeout.value);
    }
    
    reorderDebounceTimeout.value = setTimeout(async () => {
      try {
        // Save the new order to the server
        await $fetch(`/api/playlists/${playlistId.value}/reorder`, {
          method: 'POST',
          body: {
            trackIds: tracks.map(track => track.trackId)
          }
        });
        
        // Refresh the playlist data
        await refresh();
      } catch (err: any) {
        console.error('Failed to reorder tracks:', err);
        // Show error toast
        // If you have a toast system, use it here
        
        // Refresh to get the original order
        await refresh();
      }
    }, 500);
  }
  
  isDragging.value = false;
  draggedIndex.value = null;
  dragOverIndex.value = null;
};

// Export Playlist
const exportPlaylist = () => {
  if (!playlist.value?.tracks || playlist.value.tracks.length === 0) {
    alert('This playlist has no tracks to export.');
    return;
  }
  
  // Create M3U content
  const m3uContent = [
    '#EXTM3U',
    ...playlist.value.tracks.map((track: Track) => {
      return [
        `#EXTINF:${Math.round(track.duration)},${track.artistName} - ${track.title}`,
        track.filePath
      ].join('\n');
    })
  ].join('\n');
  
  // Create a blob and download link
  const blob = new Blob([m3uContent], { type: 'audio/x-mpegurl' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${playlist.value.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.m3u`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

// Utility functions
const formatTrackCount = (count: number): string => {
  return count === 1 ? '1 track' : `${count} tracks`;
};

const formatDuration = (seconds: number): string => {
  if (!seconds) return '0:00';
  
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const calculateTotalDuration = (): number => {
  if (!playlist.value?.tracks) return 0;
  
  return playlist.value.tracks.reduce((total: number, track: Track) => total + (track.duration || 0), 0);
};

// Lifecycle
onMounted(() => {
  // Fetch playlist on component mount
  refresh();
});

// Define page meta if needed
// definePageMeta({ 
//   middleware: 'auth'  // Uncomment if auth middleware is ready
// });
</script>

<style scoped>
.grid-cols-playlist-track {
  grid-template-columns: 40px 1fr 1fr 80px 40px;
}

/* Drag and drop styles */
.dragging {
  opacity: 0.5;
}

.drag-over {
  border-bottom: 2px solid hsl(var(--p));
}

@media (max-width: 768px) {
  .grid-cols-playlist-track {
    grid-template-columns: 40px 1fr 80px 40px;
  }
  
  .grid-cols-playlist-track > :nth-child(3) {
    display: none;
  }
}
</style>
