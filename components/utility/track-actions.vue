<template>
  <AddToPlaylistModal
    v-model:open="adding"
    :track="selected"
    @add-track="emit('updated')"
  />
  <EditTrackModal
    v-if="selected && editing"
    :track="selected"
    :open="editing"
    @close="editing = false"
    @track-updated="updated"
    @update-error="reportError"
  />
  <EditLyricsModal
    v-if="selected && lyrics"
    :track="selected"
    :open="lyrics"
    @close="lyrics = false"
    @lyrics-updated="emit('updated')"
    @update-error="reportError"
  />
</template>
<script setup lang="ts">
import AddToPlaylistModal from "~/components/modals/add-to-playlist-modal.vue";
import EditTrackModal from "~/components/modals/edit-track-modal.vue";
import EditLyricsModal from "~/components/modals/edit-lyrics-modal.vue";
import type { Track } from "~/types/track";
const emit = defineEmits<{ updated: []; error: [message: string] }>();
const selected = ref<Track | null>(null);
const adding = ref(false),
  editing = ref(false),
  lyrics = ref(false);
function open(event: { action: string; track: Track }) {
  selected.value = event.track;
  if (event.action === "add-to-playlist") adding.value = true;
  if (event.action === "edit-track") editing.value = true;
  if (event.action === "edit-lyrics") lyrics.value = true;
}
function updated() {
  editing.value = false;
  emit("updated");
}
function reportError(message: string) {
  emit("error", message);
}
defineExpose({ open });
</script>
