<template>
  <UtilityDialog
    :open="open"
    title="Remove Track"
    @update:open="
      (value) => {
        if (!value) close();
      }
    "
  >
    <p>Remove “{{ track?.title }}” from this playlist?</p>
    <p v-if="pending" role="status" class="mt-4">Removing track…</p>
    <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
    <div class="modal-action">
      <button type="button" class="btn" autofocus @click="close">Cancel</button
      ><button
        type="button"
        class="btn btn-error"
        :disabled="pending || !track"
        @click="removeTrack"
      >
        Remove
      </button>
    </div>
  </UtilityDialog>
</template>

<script setup lang="ts">
import type { Track } from "~/types/track";
import type { Playlist } from "~/types/playlist";
import UtilityDialog from "~/components/utility/dialog.vue";

const props = defineProps<{
  open: boolean;
  track?: Track | null;
  playlistId: string;
}>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  "playlist-updated": [playlist: Playlist];
}>();
const pending = ref(false),
  error = ref("");
let version = 0;
watch(
  [() => props.open, () => props.track?.trackId, () => props.playlistId],
  () => {
    version++;
    pending.value = false;
    error.value = "";
  },
  { immediate: true },
);
function close() {
  emit("update:open", false);
}
async function removeTrack() {
  const trackId = props.track?.trackId,
    playlistId = props.playlistId;
  if (!trackId || !playlistId || pending.value || !props.open) return;
  const request = version;
  pending.value = true;
  error.value = "";
  try {
    const result = await $fetch<Playlist>(
      "/api/playlists/" + encodeURIComponent(playlistId) + "/tracks",
      { method: "DELETE", body: { trackIds: [trackId] }, retry: 0 },
    );
    if (
      request !== version ||
      !props.open ||
      props.track?.trackId !== trackId ||
      props.playlistId !== playlistId
    )
      return;
    emit("playlist-updated", result);
    close();
  } catch (cause: any) {
    if (request === version)
      error.value =
        cause?.data?.statusMessage ||
        "Could not remove the track. Please try again.";
  } finally {
    if (request === version) pending.value = false;
  }
}
onBeforeUnmount(() => {
  version++;
});
</script>
