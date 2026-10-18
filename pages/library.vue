<template>
  <div class="library-page">
    <div class="library-overview">
      <div class="library-collection">
        <LibraryHeader />
        <section class="library-section">
          <div class="section-heading">
            <h2>Albums</h2>
            <NuxtLink to="/albums"
              >View all albums <span aria-hidden="true">→</span></NuxtLink
            >
          </div>
          <AlbumGrid
            :albums="(albums || []).slice(0, 4)"
            :pending="pending"
            :error="error"
            :album-id-loading="loadingAlbumId"
            :current-album-loading="Boolean(loadingAlbumId)"
            @play="playAlbum"
            @add-to-playlist="openPicker"
            @edit-album="selectedAlbumForEdit = $event"
          />
        </section>
      </div>
      <section class="library-feature" aria-labelledby="library-feature-title">
        <img
          src="/images/lyra-radio/rooftop-dj.webp"
          alt=""
          width="1536"
          height="1024"
        />
        <div>
          <h2 id="library-feature-title">Find your next favourite.</h2>
          <p>
            Rediscover what you love, explore deeper cuts, and make room for a
            little serendipity.
          </p>
          <NuxtLink to="/explore" class="btn btn-primary"
            >Explore your music</NuxtLink
          >
        </div>
      </section>
    </div>
    <div class="library-columns">
      <section class="library-section">
        <div class="section-heading">
          <h2>Artists</h2>
          <NuxtLink to="/artists" aria-label="View all artists"
            >View all →</NuxtLink
          >
        </div>
        <ArtistGrid />
      </section>
      <section class="library-section">
        <div class="section-heading">
          <h2>Playlists</h2>
          <NuxtLink to="/playlists" aria-label="View all playlists"
            >View all →</NuxtLink
          >
        </div>
        <PlaylistGrid />
      </section>
      <section class="library-section">
        <div class="section-heading">
          <h2>Genres</h2>
          <NuxtLink to="/genres" aria-label="View all genres"
            >View all →</NuxtLink
          >
        </div>
        <GenreGrid :limit="4" />
      </section>
    </div>
    <PlaylistPicker
      :open="Boolean(selectedAlbumForPlaylist)"
      :title="`Add ${selectedAlbumForPlaylist?.title || 'album'} to playlist`"
      :playlists="playlists"
      :pending="loadingPlaylists"
      :load-error="
        playlistsError ? 'Could not load playlists. Please try again.' : ''
      "
      @retry="fetchPlaylists"
      :busy="adding"
      :error="addError"
      @close="selectedAlbumForPlaylist = null"
      @select="addToPlaylist"
    />
    <EditAlbumModal
      v-if="selectedAlbumForEdit"
      :album="selectedAlbumForEdit"
      :open="true"
      @close="selectedAlbumForEdit = null"
      @album-updated="albumUpdated"
      @update-error="showNotification($event, 'error')"
    />
  </div>
</template>
<script setup lang="ts">
import type { Album } from "~/types/album";
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { usePlaylists } from "~/composables/usePlaylists";
import LibraryHeader from "~/components/library/library-header.vue";
import AlbumGrid from "~/components/library/album-grid.vue";
import ArtistGrid from "~/components/library/artist-grid.vue";
import PlaylistGrid from "~/components/library/playlist-grid.vue";
import GenreGrid from "~/components/library/genre-grid.vue";
import PlaylistPicker from "~/components/library/playlist-picker.vue";
import EditAlbumModal from "~/components/modals/edit-album-modal.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Library") });
const {
  data: albums,
  pending,
  error,
  refresh,
} = useLazyFetch<Album[]>("/api/albums");
const player = usePlayerStore();
const { showNotification } = useNotification();
const {
  playlists,
  fetchPlaylists,
  loading: loadingPlaylists,
  error: playlistsError,
} = usePlaylists();
const loadingAlbumId = ref<string | null>(null);
const selectedAlbumForPlaylist = ref<Album | null>(null);
const selectedAlbumForEdit = ref<Album | null>(null);
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
  selectedAlbumForPlaylist.value = album;
  addError.value = "";
  fetchPlaylists();
}
async function addToPlaylist(playlistId: string) {
  if (!selectedAlbumForPlaylist.value || adding.value) return;
  adding.value = true;
  addError.value = "";
  try {
    const album = await $fetch<Album>(
      `/api/albums/${selectedAlbumForPlaylist.value.albumId}`,
    );
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: {
        action: "add",
        trackIds: (album.tracks || []).map((track: Track) => track.trackId),
      },
    });
    selectedAlbumForPlaylist.value = null;
    showNotification("Album added to playlist.", "success");
  } catch {
    addError.value = "Could not add this album. Please try again.";
  } finally {
    adding.value = false;
  }
}
async function albumUpdated() {
  selectedAlbumForEdit.value = null;
  await refresh();
  showNotification("Album updated.", "success");
}
</script>
<style scoped>
.library-overview {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(0, 1fr);
  gap: 2rem;
  align-items: start;
}
.library-collection {
  min-width: 0;
}
.library-feature {
  display: grid;
  border-left: 2px solid var(--ink);
  padding-left: 1.5rem;
  min-width: 0;
}
.library-feature > div {
  padding: 1rem 0;
  align-self: center;
}
.library-feature h2 {
  font-size: clamp(1.8rem, 3vw, 2.8rem);
  line-height: 1.1;
  margin: 0 0 1rem;
  font-weight: 500;
}
.library-feature p {
  color: var(--muted, #62594f);
  max-width: 35rem;
  margin-bottom: 1.5rem;
  line-height: 1.65;
}
.library-feature img {
  width: 100%;
  height: 100%;
  height: 21rem;
  border: 2px solid var(--ink);
  object-fit: cover;
  object-position: 74% top;
}
.library-feature .btn {
  height: auto;
  white-space: normal;
  max-width: 100%;
  min-height: 44px;
}
.library-section {
  border-top: 1px solid var(--rule);
  padding-top: 1rem;
  min-width: 0;
}
.section-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  border-top: 0;
  padding-top: 0;
  margin-top: 0;
  margin-bottom: 1rem;
}
.section-heading h2 {
  font-size: 2rem;
  font-weight: 500;
  margin: 0;
}
.section-heading a {
  font-size: 0.875rem;
  min-height: 44px;
  display: inline-flex;
  align-items: center;
  white-space: nowrap;
}
.library-columns {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 20rem), 1fr));
  gap: 1.5rem;
  margin-top: 2rem;
}
.library-page :deep(.library-links) {
  display: grid;
  gap: 0.85rem;
}
.library-page :deep(.library-item) {
  display: grid;
  grid-template-columns: 56px minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.85rem;
  min-width: 0;
  text-decoration: none;
  color: inherit;
}
.library-page :deep(.library-item strong) {
  display: block;
  font-family: var(--font-display);
  font-size: 1.15rem;
  font-weight: 700;
  overflow-wrap: anywhere;
}
.library-page :deep(.library-item small) {
  display: block;
  color: var(--muted, #62594f);
  font-size: 0.875rem;
  margin-top: 0.15rem;
}
@media (max-width: 1000px) {
  .library-overview {
    grid-template-columns: minmax(0, 1fr);
  }
  .library-columns {
    grid-template-columns: 1fr;
  }
  .library-feature {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
    border-left: 0;
    border-top: 2px solid var(--ink);
    padding: 1.25rem 0 0;
    gap: 1.5rem;
  }
  .wide-only {
    display: none;
  }
}
@media (max-width: 600px) {
  .library-feature {
    grid-template-columns: 1fr;
  }
  .library-feature img {
    height: 160px;
    min-height: 0;
  }
  .library-feature > div {
    padding: 0;
  }
}
</style>
