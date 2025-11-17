<template>
  <dialog :class="['modal', { 'modal-open': open }]">
    <div class="modal-box">
      <h3 class="font-bold text-lg mb-4">Remove Track</h3>
      <p>Are you sure you want to remove "{{ track?.title }}" from this playlist?</p>
      <div class="modal-action">
        <button class="btn" @click="close">Cancel</button>
        <button class="btn btn-error" @click="removeTrack">Remove</button>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';

const props = defineProps({
  open: {
    type: Boolean,
    required: true,
  },
  track: {
    type: Object as () => Track | null,
    required: false,
    default: null,
  },
  playlistId: {
    type: String,
    required: true,
  },
});

const emit = defineEmits(['update:open', 'playlist-updated']);
const pending = ref(false);
const error = ref<string | null>(null);

// No need for manual token handling - using cookie-based authentication

const close = (): void => {
  emit('update:open', false);
  error.value = null;
};

const removeTrack = async (): Promise<void> => {
  if (!props.track) return;
  
  pending.value = true;
  error.value = null;
  
  try {
    const updatedPlaylist = await $fetch<Playlist>(`/api/playlists/${props.playlistId}/tracks`, {
      method: 'DELETE',
      body: {
        trackIds: [props.track.trackId]
      }
    });
    
    emit('playlist-updated', updatedPlaylist);
    close();
  } catch (err: any) {
    error.value = err?.data?.statusMessage || 'Failed to remove track from playlist';
  } finally {
    pending.value = false;
  }
};
</script>
