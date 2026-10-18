<template>
  <div class="albums-page">
    <header class="page-intro">
      <h1 class="page-heading">
        Albums<span v-if="artistName" class="artist-filter">
          by {{ artistName }}</span
        >
      </h1>
      <p v-if="albums">
        {{ albums.length }} {{ albums.length === 1 ? "album" : "albums" }} in
        your collection
      </p>
    </header>
    <div class="page-toolbar album-toolbar">
      <label class="album-search"
        ><span class="sr-only">Search albums</span
        ><input
          v-model="searchQuery"
          type="search"
          class="input input-bordered"
          placeholder="Search albums by title or artist..."
      /></label>
      <label
        ><span class="sr-only">Sort albums</span
        ><select
          v-model="sort"
          class="select select-bordered"
          aria-label="Sort albums"
        >
          <option value="title">Sort by: Title</option>
          <option value="artist">Sort by: Artist</option>
          <option value="year">Sort by: Year</option>
        </select></label
      >
      <div class="view-switch" role="group" aria-label="Album view">
        <button
          class="btn"
          :class="{ 'btn-primary': view === 'grid' }"
          :aria-pressed="view === 'grid'"
          aria-label="Grid view"
          @click="view = 'grid'"
        >
          <Icon name="material-symbols:grid-view-outline" /></button
        ><button
          class="btn"
          :class="{ 'btn-primary': view === 'list' }"
          :aria-pressed="view === 'list'"
          aria-label="List view"
          @click="view = 'list'"
        >
          <Icon name="material-symbols:format-list-bulleted" />
        </button>
      </div>
    </div>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading albums…"
      :variant="view === 'grid' ? 'cards' : 'rows'"
    />
    <p v-else-if="error" role="alert">
      Could not load albums.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <p v-else-if="!filteredAlbums.length" role="status">
      No albums found{{ artistName ? ` for ${artistName}` : ""
      }}{{ searchQuery ? " matching your search" : "" }}.
    </p>
    <div v-else :class="['collection-grid', { 'album-list': view === 'list' }]">
      <AlbumCard
        v-for="album in filteredAlbums"
        :key="album.albumId"
        :album="album"
        :is-playing-this-album="
          player.isPlaying && player.currentTrack?.albumId === album.albumId
        "
        :is-loading-this-album="loadingAlbumId === album.albumId"
        @play="playAlbum"
        @add-to-playlist="openPicker"
        @edit-album="selectedEdit = $event"
        @delete-album="selectedDelete = $event"
      />
    </div>
    <PlaylistPicker
      :open="Boolean(selectedPlaylistAlbum)"
      :title="`Add ${selectedPlaylistAlbum?.title || 'album'} to playlist`"
      :playlists="playlists"
      :pending="loadingPlaylists"
      :load-error="
        playlistsError ? 'Could not load playlists. Please try again.' : ''
      "
      @retry="fetchPlaylists"
      :busy="adding"
      :error="addError"
      @close="selectedPlaylistAlbum = null"
      @select="addToPlaylist"
    />
    <EditAlbumModal
      v-if="selectedEdit"
      :album="selectedEdit"
      :open="true"
      @close="selectedEdit = null"
      @album-updated="albumUpdated"
      @update-error="showNotification($event, 'error')"
    />
    <ConfirmDeleteModal
      :open="Boolean(selectedDelete)"
      title="Delete Album"
      :message="`Delete ${selectedDelete?.title || 'this album'} from your library? This cannot be undone.`"
      @close="selectedDelete = null"
      @confirm="deleteAlbum"
    />
  </div>
</template>
<script setup lang="ts">
import type { Album } from "~/types/album";
import { usePlayerStore } from "~/stores/player";
import { usePlaylists } from "~/composables/usePlaylists";
import AlbumCard from "~/components/album/album-card.vue";
import PlaylistPicker from "~/components/library/playlist-picker.vue";
import EditAlbumModal from "~/components/modals/edit-album-modal.vue";
import ConfirmDeleteModal from "~/components/modals/confirm-delete-modal.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Albums") });
const route = useRoute();
const query = computed(() =>
  route.query.artistId ? { artistId: String(route.query.artistId) } : {},
);
const {
  data: albums,
  pending,
  error,
  refresh,
} = useLazyFetch<Album[]>("/api/albums", { query });
const searchQuery = ref("");
const sort = ref("title");
const view = ref<"grid" | "list">("grid");
const artistName = computed(
  () =>
    albums.value
      ?.flatMap((album) => album.artists || [])
      .find((artist) => artist.artistId === route.query.artistId)?.name,
);
const filteredAlbums = computed(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return (albums.value || [])
    .filter(
      (album) =>
        !query ||
        album.title.toLowerCase().includes(query) ||
        album.artists?.some((artist) =>
          artist.name.toLowerCase().includes(query),
        ),
    )
    .sort((a, b) =>
      sort.value === "year"
        ? (b.year || 0) - (a.year || 0) || a.title.localeCompare(b.title)
        : sort.value === "artist"
          ? (a.artists?.[0]?.name || "").localeCompare(
              b.artists?.[0]?.name || "",
            ) || a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
    );
});
const player = usePlayerStore();
const { showNotification } = useNotification();
const {
  playlists,
  fetchPlaylists,
  loading: loadingPlaylists,
  error: playlistsError,
} = usePlaylists();
const loadingAlbumId = ref<string | null>(null);
const selectedEdit = ref<Album | null>(null);
const selectedDelete = ref<Album | null>(null);
const selectedPlaylistAlbum = ref<Album | null>(null);
const adding = ref(false);
const addError = ref("");
async function playAlbum(album: Album) {
  if (loadingAlbumId.value) return;
  if (
    player.currentQueueContext.type === "album" &&
    player.currentQueueContext.id === album.albumId
  )
    return player.togglePlayPause();
  loadingAlbumId.value = album.albumId;
  try {
    const details = await $fetch<Album>(`/api/albums/${album.albumId}`);
    const tracks = (details.tracks || []).map((track) => ({
      ...track,
      albumId: details.albumId,
      albumTitle: details.title,
      coverPath: details.coverPath,
    }));
    if (!tracks.length)
      return showNotification("No tracks in this album yet.", "info");
    player.loadQueue(
      tracks,
      { type: "album", id: album.albumId, name: album.title },
      true,
    );
  } catch {
    showNotification("Could not play this album.", "error");
  } finally {
    loadingAlbumId.value = null;
  }
}
function openPicker(album: Album) {
  selectedPlaylistAlbum.value = album;
  addError.value = "";
  fetchPlaylists();
}
async function addToPlaylist(playlistId: string) {
  if (!selectedPlaylistAlbum.value || adding.value) return;
  adding.value = true;
  addError.value = "";
  try {
    const album = await $fetch<Album>(
      `/api/albums/${selectedPlaylistAlbum.value.albumId}`,
    );
    const trackIds = (album.tracks || []).map((track) => track.trackId);
    if (!trackIds.length) {
      addError.value = "This album has no tracks yet.";
      return;
    }
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: { action: "add", trackIds },
    });
    selectedPlaylistAlbum.value = null;
    showNotification("Album added to playlist.", "success");
  } catch {
    addError.value = "Could not add this album. Please try again.";
  } finally {
    adding.value = false;
  }
}
async function albumUpdated(album: Album) {
  selectedEdit.value = null;
  player.updateAlbumDetailsInPlayer(album);
  await refresh();
  showNotification("Album updated.", "success");
}
async function deleteAlbum() {
  if (!selectedDelete.value) return;
  try {
    await $fetch(`/api/albums/${selectedDelete.value.albumId}`, {
      method: "DELETE",
    });
    selectedDelete.value = null;
    await refresh();
    showNotification("Album deleted.", "success");
  } catch {
    showNotification("Could not delete this album.", "error");
  }
}
</script>
<style scoped>
.artist-filter {
  font-size: 0.5em;
}
.album-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--line, #c9c1b4);
}
.album-search {
  flex: 1;
  min-width: min(100%, 220px);
}
.album-search input {
  width: 100%;
}
.view-switch {
  display: flex;
  gap: 0.5rem;
}
.album-list {
  grid-template-columns: 1fr;
}
.album-list :deep(.record-card) {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(160px, 0.65fr) auto;
  align-items: center;
  gap: 1rem;
  border-bottom: 1px solid var(--line, #c9c1b4);
  padding-bottom: 1.25rem;
}
.album-list :deep(.record-link) {
  display: flex;
  align-items: center;
  gap: 1.25rem;
}
.album-list :deep(.album-art) {
  width: 88px;
  flex-shrink: 0;
}
.album-list :deep(.record-year) {
  display: none;
}
.album-list :deep(.record-actions) {
  margin: 0;
}
@media (max-width: 650px) {
  .album-list :deep(.record-card) {
    grid-template-columns: 1fr;
  }
  .album-list :deep(.record-credit) {
    margin-top: -0.5rem;
  }
  .album-toolbar > label:nth-child(2) {
    flex: 1;
  }
  .album-toolbar select {
    width: 100%;
  }
}
@media (max-width: 440px) {
  .album-toolbar > label,
  .album-toolbar > label:nth-child(2) {
    flex: 1 1 100%;
    min-width: 0;
  }
}
</style>
