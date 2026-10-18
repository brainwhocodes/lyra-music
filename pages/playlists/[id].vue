<template>
  <div class="utility-page">
    <NuxtLink to="/playlists" class="utility-back">← Playlists</NuxtLink>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading playlist…"
      variant="detail"
    />
    <div v-else-if="error" role="alert" class="utility-status">
      Could not load this playlist.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="playlist">
      <header class="detail-hero">
        <UtilityArt />
        <div>
          <h1 class="page-heading">{{ playlist.name }}</h1>
          <p class="page-intro">
            {{ playlist.tracks.length }} tracks ·
            {{ formatTrackDuration(totalDuration) }}
          </p>
          <div class="utility-actions">
            <button
              class="btn btn-primary"
              :disabled="!playlist.tracks.length"
              @click="playTrack(0)"
            >
              Play all</button
            ><button class="btn btn-outline" @click="openAddTracks">
              Add tracks</button
            ><button class="btn btn-ghost" @click="openRename">Rename</button
            ><button class="btn btn-ghost text-error" @click="openDelete">
              Delete playlist
            </button>
          </div>
        </div>
      </header>
      <p v-if="actionError" role="alert" class="utility-status text-error">
        {{ actionError }}
      </p>
      <p v-if="statusMessage" role="status" class="utility-status">
        {{ statusMessage }}
      </p>
      <div v-if="!playlist.tracks.length" class="utility-empty">
        <h2>A little room for music.</h2>
        <p>Add tracks from your library to begin this playlist.</p>
      </div>
      <section v-else aria-labelledby="playlist-tracks">
        <h2 id="playlist-tracks" class="mb-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full playlist-table">
            <caption class="sr-only">
              Playlist tracks, playback and ordering
            </caption>
            <tbody>
              <TrackItem
                v-for="(entry, index) in playlist.tracks"
                :key="entry.playlistTrackId"
                :track="entry.track"
                :track-number="index + 1"
                :in-playlist="true"
                :playlists="[playlist]"
                @play-track="playTrack(index)"
                @track-options="handleOptions($event, entry)"
              >
                <template #actions
                  ><div class="reorder-actions">
                    <button
                      class="btn btn-ghost"
                      :aria-label="`Move up ${entry.track.title}`"
                      :disabled="index === 0 || busy"
                      @click="moveTrack(index, -1)"
                    >
                      ↑</button
                    ><button
                      class="btn btn-ghost"
                      :aria-label="`Move down ${entry.track.title}`"
                      :disabled="index === playlist.tracks.length - 1 || busy"
                      @click="moveTrack(index, 1)"
                    >
                      ↓
                    </button>
                  </div></template
                >
              </TrackItem>
            </tbody>
          </table>
        </div>
      </section>
    </template>
    <UtilityDialog v-model:open="renameOpen" title="Rename Playlist"
      ><form @submit.prevent="renamePlaylist">
        <label class="label" for="playlist-name">Playlist Name</label
        ><input
          id="playlist-name"
          v-model="renameValue"
          class="input w-full"
          required
          autofocus
          maxlength="200"
        />
        <p v-if="modalError" role="alert" class="text-error mt-4">
          {{ modalError }}
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
      </form></UtilityDialog
    >
    <UtilityDialog v-model:open="deleteOpen" title="Delete Playlist"
      ><p>
        Delete “{{ playlist?.name }}”? Your music files will remain in the
        library.
      </p>
      <p v-if="modalError" role="alert" class="text-error mt-4">
        {{ modalError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="deleteOpen = false">Cancel</button
        ><button class="btn btn-error" :disabled="busy" @click="deletePlaylist">
          Delete
        </button>
      </div></UtilityDialog
    >
    <UtilityDialog v-model:open="addOpen" title="Add tracks to playlist"
      ><form @submit.prevent="addTracks">
        <label class="label" for="find-playlist-tracks"
          >Search library tracks</label
        ><input
          id="find-playlist-tracks"
          v-model="trackSearch"
          class="input w-full"
          type="search"
          autofocus
        />
        <UiLoadingSkeleton
          v-if="loadingTracks"
          label="Loading tracks…"
          variant="text"
          :count="3"
          class="mt-4"
        />
        <div v-else class="track-picker">
          <label v-for="track in filteredAvailable" :key="track.id"
            ><input
              v-model="selectedIds"
              type="checkbox"
              :value="track.id"
              class="checkbox"
            /><span
              >{{ track.title
              }}<small class="block">{{
                track.artistName || "Unknown artist"
              }}</small></span
            ></label
          >
          <p v-if="!filteredAvailable.length">
            No available tracks match this search.
          </p>
        </div>
        <p v-if="modalError" role="alert" class="text-error mt-4">
          {{ modalError }}
        </p>
        <div class="modal-action">
          <button class="btn" type="button" @click="addOpen = false">
            Cancel</button
          ><button
            class="btn btn-primary"
            :disabled="busy || !selectedIds.length"
          >
            Add selected tracks ({{ selectedIds.length }})
          </button>
        </div>
      </form></UtilityDialog
    >
    <UtilityDialog v-model:open="removeOpen" title="Remove track"
      ><p>Remove “{{ removing?.track.title }}” from this playlist?</p>
      <p v-if="modalError" role="alert" class="text-error mt-4">
        {{ modalError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="removeOpen = false">Cancel</button
        ><button class="btn btn-error" :disabled="busy" @click="removeTrack">
          Remove
        </button>
      </div></UtilityDialog
    >
    <UtilityTrackActions
      ref="trackActions"
      @updated="refresh()"
      @error="actionError = $event"
    />
  </div>
</template>
<script setup lang="ts">
import TrackItem from "~/components/track/track-item.vue";
import type { Playlist, PlaylistTrack } from "~/types/playlist";
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { formatTrackDuration } from "~/utils/formatters";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute(),
  player = usePlayerStore();
const playlistId = computed(() => String(route.params.id));
const {
  data: playlist,
  pending,
  error,
  refresh,
} = useLazyFetch<Playlist>(() => `/api/playlists/${playlistId.value}`);
useSeoMeta({ title: () => usePageTitle(playlist.value?.name || "Playlist") });
const totalDuration = computed(
  () =>
    playlist.value?.tracks.reduce(
      (sum, entry) => sum + (entry.track.duration || 0),
      0,
    ) || 0,
);
const busy = ref(false),
  actionError = ref(""),
  statusMessage = ref(""),
  modalError = ref("");
const renameOpen = ref(false),
  deleteOpen = ref(false),
  addOpen = ref(false),
  removeOpen = ref(false),
  renameValue = ref("");
const removing = ref<PlaylistTrack | null>(null);
const trackActions = ref<{
  open: (event: { action: string; track: Track }) => void;
} | null>(null);
interface AvailableTrack {
  id: string;
  title: string;
  artistName: string | null;
}
const available = ref<AvailableTrack[]>([]),
  loadingTracks = ref(false),
  trackSearch = ref(""),
  selectedIds = ref<string[]>([]);
const filteredAvailable = computed(() =>
  available.value.filter(
    (t) =>
      !playlist.value?.tracks.some((entry) => entry.trackId === t.id) &&
      `${t.title} ${t.artistName || ""}`
        .toLowerCase()
        .includes(trackSearch.value.trim().toLowerCase()),
  ),
);
const failure = (err: any, fallback: string) =>
  err?.data?.statusMessage || err?.data?.message || fallback;
function openRename() {
  renameValue.value = playlist.value?.name || "";
  modalError.value = "";
  renameOpen.value = true;
}
function openDelete() {
  modalError.value = "";
  deleteOpen.value = true;
}
function playTrack(index: number) {
  if (!playlist.value?.tracks[index]) return;
  const track = playlist.value.tracks[index].track;
  if (
    player.currentTrack?.trackId === track.trackId &&
    player.currentQueueContext.id === playlistId.value
  ) {
    player.togglePlayPause();
    return;
  }
  player.loadQueue(
    playlist.value.tracks.map((entry) => entry.track),
    { type: "playlist", id: playlistId.value },
    true,
    index,
  );
}
function handleOptions(
  event: { action: string; track: Track },
  entry: PlaylistTrack,
) {
  if (event.action === "remove-from-playlist") {
    removing.value = entry;
    modalError.value = "";
    removeOpen.value = true;
  } else trackActions.value?.open(event);
}
async function mutate(action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = true;
  modalError.value = "";
  actionError.value = "";
  try {
    await action();
  } catch (err) {
    modalError.value = failure(err, "Could not save this change. Try again.");
    actionError.value = modalError.value;
  } finally {
    busy.value = false;
  }
}
async function renamePlaylist() {
  if (!renameValue.value.trim()) return;
  await mutate(async () => {
    await $fetch(`/api/playlists/${playlistId.value}`, {
      method: "PUT",
      body: { name: renameValue.value.trim() },
    });
    await refresh();
    renameOpen.value = false;
    statusMessage.value = "Playlist renamed.";
  });
}
async function deletePlaylist() {
  await mutate(async () => {
    await $fetch(`/api/playlists/${playlistId.value}`, { method: "DELETE" });
    deleteOpen.value = false;
    await navigateTo("/playlists");
  });
}
async function openAddTracks() {
  selectedIds.value = [];
  trackSearch.value = "";
  modalError.value = "";
  addOpen.value = true;
  loadingTracks.value = true;
  try {
    available.value = await $fetch<AvailableTrack[]>("/api/tracks");
  } catch (err) {
    modalError.value = failure(err, "Could not load library tracks.");
  } finally {
    loadingTracks.value = false;
  }
}
async function addTracks() {
  if (!selectedIds.value.length) return;
  await mutate(async () => {
    await $fetch(`/api/playlists/${playlistId.value}/tracks`, {
      method: "POST",
      body: { action: "add", trackIds: selectedIds.value },
    });
    await refresh();
    addOpen.value = false;
    statusMessage.value = "Tracks added.";
  });
}
async function removeTrack() {
  if (!removing.value) return;
  await mutate(async () => {
    await $fetch(`/api/playlists/${playlistId.value}/tracks`, {
      method: "DELETE",
      body: { trackIds: [removing.value!.trackId] },
    });
    await refresh();
    removeOpen.value = false;
    statusMessage.value = "Track removed.";
  });
}
async function moveTrack(index: number, delta: number) {
  if (!playlist.value || busy.value) return;
  const order = [...playlist.value.tracks],
    target = index + delta;
  if (target < 0 || target >= order.length) return;
  [order[index], order[target]] = [order[target]!, order[index]!];
  await mutate(async () => {
    playlist.value = await $fetch<Playlist>(
      `/api/playlists/${playlistId.value}/reorder`,
      {
        method: "PUT",
        body: { playlistTrackIds: order.map((t) => t.playlistTrackId) },
      },
    );
    statusMessage.value = "Playlist order updated.";
  });
}
</script>
<style src="~/assets/utility-pages.css"></style>
<style scoped>
.reorder-actions {
  display: flex;
  justify-content: center;
}
.reorder-actions .btn {
  padding: 0.4rem;
  min-width: 44px;
}
.track-picker {
  max-height: 20rem;
  overflow: auto;
  margin-top: 1rem;
}
.track-picker label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem;
  border-bottom: 1px solid var(--rule);
  min-height: 44px;
}
.playlist-table :deep(td:last-child) {
  min-width: 6rem;
}
.playlist-table :deep(td:nth-child(3)) {
  min-width: 9rem;
}
@media (max-width: 600px) {
  .playlist-table :deep(td:first-child) {
    display: none;
  }
  .playlist-table :deep(td:nth-child(3)) {
    min-width: 0;
  }
  .playlist-table :deep(td) {
    padding: 0.6rem 0.2rem;
  }
  .playlist-table :deep(img) {
    display: none;
  }
  .playlist-table :deep(td:nth-child(4)) {
    display: none;
  }
}
</style>
