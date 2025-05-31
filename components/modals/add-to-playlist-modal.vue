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
        <div v-if="playlists.length > 0" class="mt-4">
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
  playlists: Playlist[];
}

const props = defineProps<Props>();

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
const handleAddTrackToPlaylist = (playlistId: string): void => {
  if (props.track) {
    emit('add-track', { trackId: props.track.trackId, playlistId });
  }
  closeModal();
};

// Close modal on escape key press
watch(() => props.open, (isOpen: boolean) => {
  if (isOpen) {
    document.addEventListener('keydown', onKeyDown);
  } else {
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
