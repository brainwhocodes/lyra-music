<template>
  <div class="utility-page">
    <NuxtLink to="/discovery" class="utility-back">← Discover</NuxtLink>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading discovery playlist…"
      variant="detail"
    />
    <div v-else-if="error" class="utility-status" role="alert">
      Could not load this collection.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="playlist">
      <header class="discovery-heading">
        <h1 class="page-heading">{{ playlist.title }}</h1>
        <p class="page-intro utility-subtitle">
          A listening path through your collection.
        </p>
        <p class="page-intro">
          {{ playlist.tracks.length }} tracks from your library, ready to hear
          together.
        </p>
        <div class="utility-actions">
          <button
            class="btn btn-primary"
            :disabled="!playlist.tracks.length"
            @click="play(0)"
          >
            Play all</button
          ><button
            class="btn btn-outline"
            :disabled="!playlist.tracks.length"
            @click="openSave"
          >
            Save as playlist
          </button>
        </div>
      </header>
      <div v-if="!playlist.tracks.length" class="utility-empty">
        <h2>No tracks in this collection yet.</h2>
        <p>
          <NuxtLink to="/explore"
            >Find something to listen to in Explore.</NuxtLink
          >
        </p>
      </div>
      <div v-else class="overflow-x-auto">
        <table class="table w-full">
          <caption class="sr-only">
            Discovery playlist tracks
          </caption>
          <tbody>
            <TrackItem
              v-for="(entry, index) in playlist.tracks"
              :key="entry.discoveryPlaylistTrackId"
              :track="entry.track"
              :track-number="index + 1"
              :playlists="[]"
              @play-track="play(index)"
              @track-options="trackActions?.open($event)"
            />
          </tbody>
        </table>
      </div>
      <p v-if="actionError" role="alert" class="utility-status text-error">
        {{ actionError }}
      </p>
    </template>
    <UtilityDialog v-model:open="saveOpen" title="Save as playlist"
      ><form @submit.prevent="save">
        <label class="label" for="discovery-playlist-name">Playlist Name</label
        ><input
          id="discovery-playlist-name"
          v-model="name"
          autofocus
          required
          maxlength="200"
          class="input w-full"
        />
        <p v-if="saveError" role="alert" class="text-error mt-4">
          {{ saveError }}
        </p>
        <div class="modal-action">
          <button class="btn" type="button" @click="saveOpen = false">
            Cancel</button
          ><button class="btn btn-primary" :disabled="saving || !name.trim()">
            Save playlist
          </button>
        </div>
      </form></UtilityDialog
    >
    <UtilityTrackActions
      ref="trackActions"
      @updated="refresh()"
      @error="actionError = $event"
    />
  </div>
</template>
<script setup lang="ts">
import type { DiscoveryPlaylist } from "~/types/discovery-playlist";
import type { Track } from "~/types/track";
import TrackItem from "~/components/track/track-item.vue";
import { usePlayerStore } from "~/stores/player";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute(),
  player = usePlayerStore();
const id = computed(() => String(route.params.id));
const {
  data: playlist,
  pending,
  error,
  refresh,
} = useLazyFetch<DiscoveryPlaylist>(
  () => `/api/discovery-playlists/${id.value}`,
);
useSeoMeta({ title: () => usePageTitle(playlist.value?.title || "Discover") });
const saveOpen = ref(false),
  saving = ref(false),
  name = ref(""),
  saveError = ref(""),
  actionError = ref("");
const trackActions = ref<{
  open: (event: { action: string; track: Track }) => void;
} | null>(null);
function play(index: number) {
  if (!playlist.value?.tracks[index]) return;
  const track = playlist.value.tracks[index].track;
  if (
    player.currentTrack?.trackId === track.trackId &&
    player.currentQueueContext.id === id.value
  ) {
    player.togglePlayPause();
    return;
  }
  player.loadQueue(
    playlist.value.tracks.map((t) => t.track),
    { type: "discovery", id: id.value },
    true,
    index,
  );
}
function openSave() {
  name.value = playlist.value?.title || "";
  saveError.value = "";
  saveOpen.value = true;
}
async function save() {
  if (!playlist.value || saving.value || !name.value.trim()) return;
  saving.value = true;
  saveError.value = "";
  let createdId: string | undefined;
  try {
    const created = await $fetch<{ playlistId: string }>("/api/playlists", {
      method: "POST",
      body: { name: name.value.trim() },
    });
    createdId = created.playlistId;
    await $fetch(`/api/playlists/${createdId}/tracks`, {
      method: "POST",
      body: {
        action: "add",
        trackIds: playlist.value.tracks.map((t) => t.track.trackId),
      },
    });
    saveOpen.value = false;
    await navigateTo(`/playlists/${createdId}`);
  } catch (err: any) {
    if (createdId)
      await $fetch(`/api/playlists/${createdId}`, { method: "DELETE" }).catch(
        () => {},
      );
    saveError.value =
      err?.data?.statusMessage ||
      "Could not save this playlist. Please try again.";
  } finally {
    saving.value = false;
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
<style scoped>
.discovery-heading {
  padding: 1rem 0 2.5rem;
  border-bottom: 1px solid var(--rule);
  margin-bottom: 1.5rem;
}
@media (max-width: 600px) {
  .table :deep(td:nth-child(4)) {
    display: none;
  }
  .table :deep(td) {
    padding: 0.6rem 0.3rem;
  }
  .table :deep(img) {
    display: none;
  }
}
</style>
