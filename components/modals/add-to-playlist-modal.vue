<template>
  <Teleport to="body">
    <div v-if="open" class="modal modal-open" @click.self="closeModal">
      <div class="modal-box">
        <button
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
          @click="closeModal"
        >
          ✕
        </button>
        <h3 v-if="track" class="font-bold text-lg">
          Add "{{ track.title }}" to Playlist
        </h3>
        <div v-if="isLoading" class="mt-4 py-4 text-center">
          <span class="loading loading-spinner loading-md"></span>
          <p class="mt-2">Loading playlists...</p>
        </div>
        <div v-else-if="error" class="mt-4 py-4 text-center text-error">
          <p>{{ error }}</p>
          <button class="btn btn-sm btn-outline mt-2" @click="fetchPlaylists">Retry</button>
        </div>
        <div v-else-if="playlists.length > 0" class="mt-4">
          <ul class="menu bg-base-100 w-full p-0 rounded-box max-h-60 overflow-y-auto">
            <li v-for="playlist in playlists" :key="playlist.playlistId">
              <a @click="handleAddTrackToPlaylist(playlist.playlistId)">
                {{ playlist.name }}
              </a>
            </li>
          </ul>
        </div>
        <p v-else class="py-4">
          You don't have any playlists yet.
          <NuxtLink to="/playlists" class="link" @click="closeModal">Create one?</NuxtLink>
        </p>
        <div class="modal-action mt-6">
          <button class="btn btn-ghost" @click="closeModal">Cancel</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';

interface Props {
  open: boolean;
  track: Track | null;
}

const props = defineProps<Props>();

// State for the component
const playlists = ref<Playlist[]>([]);
const isLoading = ref(false);
const error = ref<string | null>(null);

/**
 * Fetches the user's playlists from the API.
 */
const fetchPlaylists = async (): Promise<void> => {
  isLoading.value = true;
  error.value = null;
  
  try {
    // Fetch playlists from API using cookie-based authentication
    const response = await $fetch<Playlist[]>('/api/playlists');
    
    playlists.value = response;
  } catch (err) {
    console.error('Error fetching playlists:', err);
    error.value = 'Failed to load playlists';
  } finally {
    isLoading.value = false;
  }
};



const emit = defineEmits(['update:open', 'add-track']);

/**
 * Closes the modal.
 */
const closeModal = (): void => {
  emit('update:open', false);
};

/**
 * Handles adding the track to the selected playlist.
 * @param playlistId - The ID of the playlist to add the track to.
 */
const handleAddTrackToPlaylist = async (playlistId: string): Promise<void> => {
  if (props.track) {
    try {
      const response = await $fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trackId: props.track.trackId })
      });
      
      // Emit event for parent components to handle if needed
      emit('add-track', { trackId: props.track.trackId, playlistId });
      
      // Success - let parent component handle notification
    } catch (err) {
      console.error('Error adding track to playlist:', err);
      // Error - let parent component handle notification
    }
  }
  closeModal();
};

// Watch for modal open state changes
watch(() => props.open, (isOpen: boolean) => {
  if (isOpen) {
    // Add keyboard event listener
    document.addEventListener('keydown', onKeyDown);
    
    // Fetch playlists when modal opens
    fetchPlaylists();
  } else {
    // Remove keyboard event listener when modal closes
    document.removeEventListener('keydown', onKeyDown);
  }
});

const onKeyDown = (event: KeyboardEvent): void => {
  if (event.key === 'Escape') {
    closeModal();
  }
};

onUnmounted(() => {
  document.removeEventListener('keydown', onKeyDown);
});
</script>

<style scoped>
.modal-open {
  display: flex;
  align-items: center;
  justify-content: center;
}
.modal-box {
  max-height: 90vh; /* Ensure modal box doesn't get too tall */
}
</style>
