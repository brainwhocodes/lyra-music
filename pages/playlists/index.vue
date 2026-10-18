<template>
  <div class="utility-page">
    <header class="utility-head">
      <div>
        <h1 class="page-heading">Playlists.</h1>
        <p class="page-intro utility-subtitle">Make a place for every mood.</p>
      </div>
      <button class="btn btn-primary" @click="isCreateModalOpen = true">
        New Playlist
      </button>
    </header>
    <div class="page-toolbar">
      <label
        >Search playlists<input
          v-model="searchQuery"
          type="search"
          class="input"
          placeholder="Find a playlist"
      /></label>
    </div>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading playlists…"
      variant="rows"
      :count="3"
    />
    <div v-else-if="error" role="alert" class="utility-status">
      Could not load playlists.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <div v-else-if="!playlists?.length" class="utility-empty">
      <h2>No playlists yet.</h2>
      <p>Start with a few tracks you want to hear together.</p>
      <button class="btn btn-primary" @click="isCreateModalOpen = true">
        Create Playlist
      </button>
    </div>
    <p
      v-else-if="!filteredPlaylists.length"
      role="status"
      class="utility-empty"
    >
      No playlists match “{{ searchQuery }}”.
    </p>
    <div v-else class="utility-list">
      <article
        v-for="playlist in filteredPlaylists"
        :key="playlist.playlistId"
        class="utility-row"
      >
        <UtilityArt />
        <div>
          <h2>
            <NuxtLink :to="`/playlists/${playlist.playlistId}`">{{
              playlist.name
            }}</NuxtLink>
          </h2>
          <p>
            {{ playlist.trackCount }}
            {{ playlist.trackCount === 1 ? "track" : "tracks" }}
          </p>
        </div>
        <div class="utility-actions">
          <button
            class="btn btn-primary"
            :aria-label="`Play ${playlist.name}`"
            :disabled="!playlist.trackCount || busyId === playlist.playlistId"
            @click="playPlaylist(playlist)"
          >
            Play</button
          ><NuxtLink
            class="btn btn-outline"
            :to="`/playlists/${playlist.playlistId}`"
            >Open playlist</NuxtLink
          ><button
            class="btn btn-ghost"
            :aria-label="`Rename ${playlist.name}`"
            @click="openRename(playlist)"
          >
            Rename</button
          ><button
            class="btn btn-ghost text-error"
            :aria-label="`Delete ${playlist.name}`"
            @click="openDelete(playlist)"
          >
            Delete
          </button>
        </div>
      </article>
    </div>
    <p v-if="pageError" role="alert" class="utility-status text-error">
      {{ pageError }}
    </p>
    <CreatePlaylistModal
      v-model:open="isCreateModalOpen"
      :is-submitting="creating"
      :error-message="createError"
      @create-playlist="createPlaylist"
    />
    <UtilityDialog v-model:open="renameOpen" title="Rename Playlist">
      <form @submit.prevent="renamePlaylist">
        <label class="label" for="rename-playlist">Playlist Name</label
        ><input
          id="rename-playlist"
          v-model="renameValue"
          autofocus
          required
          maxlength="200"
          class="input w-full"
        />
        <p v-if="actionError" role="alert" class="text-error mt-4">
          {{ actionError }}
        </p>
        <div class="modal-action">
          <button class="btn" type="button" @click="renameOpen = false">
            Cancel</button
          ><button
            class="btn btn-primary"
            :disabled="busy || !renameValue.trim()"
          >
            Save
          </button>
        </div>
      </form>
    </UtilityDialog>
    <UtilityDialog v-model:open="deleteOpen" title="Delete Playlist">
      <p>
        Delete “{{ selected?.name }}”? Your music files will remain in the
        library.
      </p>
      <p v-if="actionError" role="alert" class="text-error mt-4">
        {{ actionError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="deleteOpen = false">Cancel</button
        ><button class="btn btn-error" :disabled="busy" @click="deletePlaylist">
          Delete
        </button>
      </div>
    </UtilityDialog>
  </div>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import type { Playlist } from "~/types/playlist";
import CreatePlaylistModal from "~/components/modals/create-playlist-modal.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Playlists") });
const player = usePlayerStore();
const {
  data: playlists,
  pending,
  error,
  refresh,
} = useLazyFetch<Playlist[]>("/api/playlists");
const searchQuery = ref("");
const filteredPlaylists = computed(() =>
  (playlists.value ?? []).filter((p) =>
    p.name.toLowerCase().includes(searchQuery.value.trim().toLowerCase()),
  ),
);
const isCreateModalOpen = ref(false),
  creating = ref(false),
  createError = ref("");
const renameOpen = ref(false),
  deleteOpen = ref(false),
  renameValue = ref(""),
  busy = ref(false);
const selected = ref<Playlist | null>(null),
  actionError = ref(""),
  pageError = ref(""),
  busyId = ref("");
watch(isCreateModalOpen, (open) => {
  if (open) createError.value = "";
});
const message = (err: any, fallback: string) =>
  err?.data?.statusMessage || err?.data?.message || fallback;
async function createPlaylist(name: string) {
  if (creating.value) return;
  creating.value = true;
  createError.value = "";
  try {
    await $fetch("/api/playlists", { method: "POST", body: { name } });
    await refresh();
    isCreateModalOpen.value = false;
  } catch (err) {
    createError.value = message(err, "Could not create playlist. Try again.");
  } finally {
    creating.value = false;
  }
}
function openRename(playlist: Playlist) {
  selected.value = playlist;
  renameValue.value = playlist.name;
  actionError.value = "";
  renameOpen.value = true;
}
function openDelete(playlist: Playlist) {
  selected.value = playlist;
  actionError.value = "";
  deleteOpen.value = true;
}
async function renamePlaylist() {
  if (!selected.value || busy.value || !renameValue.value.trim()) return;
  busy.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/playlists/${selected.value.playlistId}`, {
      method: "PUT",
      body: { name: renameValue.value.trim() },
    });
    await refresh();
    renameOpen.value = false;
  } catch (err) {
    actionError.value = message(err, "Could not rename playlist.");
  } finally {
    busy.value = false;
  }
}
async function deletePlaylist() {
  if (!selected.value || busy.value) return;
  busy.value = true;
  actionError.value = "";
  try {
    await $fetch(`/api/playlists/${selected.value.playlistId}`, {
      method: "DELETE",
    });
    await refresh();
    deleteOpen.value = false;
  } catch (err) {
    actionError.value = message(err, "Could not delete playlist.");
  } finally {
    busy.value = false;
  }
}
async function playPlaylist(playlist: Playlist) {
  busyId.value = playlist.playlistId;
  pageError.value = "";
  try {
    const detail = await $fetch<Playlist>(
      `/api/playlists/${playlist.playlistId}`,
    );
    if (!detail.tracks.length) {
      pageError.value = "This playlist has no tracks yet.";
      return;
    }
    player.loadQueue(
      detail.tracks.map((entry) => entry.track),
      { type: "playlist", id: playlist.playlistId },
    );
  } catch (err) {
    pageError.value = message(err, "Could not play this playlist.");
  } finally {
    busyId.value = "";
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
