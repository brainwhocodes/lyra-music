<template>
  <dialog
    ref="dialog"
    class="modal playlist-picker"
    :aria-labelledby="headingId"
    @cancel.prevent="$emit('close')"
  >
    <div class="modal-box">
      <h2 :id="headingId">{{ title }}</h2>
      <UiLoadingSkeleton
        v-if="pending"
        label="Loading playlists…"
        variant="text"
        :count="3"
      />
      <div v-else-if="loadError" role="alert">
        <p>{{ loadError }}</p>
        <button type="button" class="btn btn-outline" @click="$emit('retry')">
          Retry loading playlists
        </button>
      </div>
      <div v-else-if="playlists.length" class="picker-options">
        <button
          v-for="playlist in playlists"
          :key="playlist.playlistId"
          type="button"
          class="btn btn-outline"
          :disabled="busy"
          @click="$emit('select', playlist.playlistId)"
        >
          {{ playlist.name }}
        </button>
      </div>
      <p v-else>
        No playlists yet.
        <NuxtLink to="/playlists">Create a playlist</NuxtLink>.
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <div class="modal-action">
        <button type="button" class="btn" autofocus @click="$emit('close')">
          Cancel
        </button>
      </div>
    </div>
  </dialog>
</template>
<script setup lang="ts">
import type { Playlist } from "~/types/playlist";
const props = withDefaults(
  defineProps<{
    open: boolean;
    title: string;
    playlists: Playlist[];
    pending?: boolean;
    loadError?: string;
    busy?: boolean;
    error?: string;
  }>(),
  { pending: false, busy: false, error: "", loadError: "" },
);
defineEmits<{
  (e: "close" | "retry"): void;
  (e: "select", playlistId: string): void;
}>();
const dialog = ref<HTMLDialogElement | null>(null);
const headingId = useId();
watch(
  [() => props.open, dialog],
  ([open]) => {
    if (!dialog.value) return;
    if (open && !dialog.value.open) dialog.value.showModal();
    else if (!open && dialog.value.open) dialog.value.close();
  },
  { flush: "post" },
);
</script>
<style scoped>
.playlist-picker {
  transition-property: translate, background-color, opacity;
}
.playlist-picker[open] {
  visibility: visible;
}
.picker-options {
  display: grid;
  gap: 0.75rem;
  margin-top: 1.5rem;
}
.modal-box h2 {
  font-size: 1.75rem;
}
</style>
