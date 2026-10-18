<template>
  <UtilityDialog
    :open="open"
    :title="`Add ${track?.title || 'track'} to Playlist`"
    @update:open="
      (value) => {
        if (!value) closeModal();
      }
    "
  >
    <UiLoadingSkeleton
      v-if="loading"
      label="Loading playlists…"
      variant="text"
      :count="3"
    />
    <div v-else-if="loadError" role="alert" class="text-error">
      <p>{{ loadError }}</p>
      <button class="btn btn-outline mt-3" @click="fetchPlaylists">
        Retry loading playlists
      </button>
    </div>
    <ul v-else-if="playlists.length" class="playlist-choices">
      <li v-for="playlist in playlists" :key="playlist.playlistId">
        <button
          type="button"
          class="btn btn-outline"
          :disabled="saving || !track"
          @click="addToPlaylist(playlist.playlistId)"
        >
          {{ playlist.name }}
        </button>
      </li>
    </ul>
    <p v-else>
      You don't have any playlists yet.
      <NuxtLink to="/playlists" class="link" @click="closeModal"
        >Create a playlist</NuxtLink
      >.
    </p>
    <p v-if="saving" role="status" class="mt-4">Adding track…</p>
    <p v-if="saveError" role="alert" class="text-error mt-4">{{ saveError }}</p>
    <div class="modal-action">
      <button type="button" class="btn" autofocus @click="closeModal">
        Cancel
      </button>
    </div>
  </UtilityDialog>
</template>

<script setup lang="ts">
import type { Track } from "~/types/track";
import type { Playlist } from "~/types/playlist";
import UtilityDialog from "~/components/utility/dialog.vue";

const props = defineProps<{ open: boolean; track: Track | null }>();
const emit = defineEmits<{
  "update:open": [value: boolean];
  "add-track": [value: { trackId: string; playlistId: string }];
}>();
const playlists = ref<Playlist[]>([]);
const loading = ref(false),
  saving = ref(false),
  loadError = ref(""),
  saveError = ref("");
let version = 0;
let controller: AbortController | undefined;

function closeModal() {
  emit("update:open", false);
}
async function fetchPlaylists() {
  if (!props.open) return;
  const request = ++version;
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  loadError.value = "";
  try {
    const result = await $fetch<Playlist[]>("/api/playlists", {
      signal: controller.signal,
      retry: 0,
    });
    if (request === version) playlists.value = result;
  } catch (error: any) {
    if (request === version && error?.name !== "AbortError")
      loadError.value = "Could not load playlists. Please try again.";
  } finally {
    if (request === version) loading.value = false;
  }
}

async function addToPlaylist(playlistId: string) {
  const trackId = props.track?.trackId;
  if (!trackId || saving.value || !props.open) return;
  const request = version;
  saving.value = true;
  saveError.value = "";
  try {
    await $fetch(
      "/api/playlists/" + encodeURIComponent(playlistId) + "/tracks",
      {
        method: "POST",
        body: { action: "add", trackIds: [trackId] },
        retry: 0,
      },
    );
    if (request !== version || !props.open || props.track?.trackId !== trackId)
      return;
    emit("add-track", { trackId, playlistId });
    closeModal();
  } catch (error: any) {
    if (request === version)
      saveError.value =
        error?.data?.statusMessage ||
        "Could not add the track. Choose a playlist to try again.";
  } finally {
    if (request === version) saving.value = false;
  }
}

watch(
  [() => props.open, () => props.track?.trackId],
  ([open]) => {
    version++;
    controller?.abort();
    playlists.value = [];
    loading.value = saving.value = false;
    loadError.value = saveError.value = "";
    if (open) void fetchPlaylists();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  version++;
  controller?.abort();
});
</script>

<style scoped>
.playlist-choices {
  display: grid;
  gap: 0.75rem;
  list-style: none;
  padding: 0;
  max-height: 50vh;
  overflow: auto;
}
.playlist-choices .btn {
  width: 100%;
  justify-content: flex-start;
  white-space: normal;
  text-align: left;
}
</style>
