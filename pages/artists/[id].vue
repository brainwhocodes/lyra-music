<template>
  <div class="artist-detail-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <NuxtLink to="/artists">Artists</NuxtLink><span aria-hidden="true">/</span
      ><span>{{ artist?.name || "Artist" }}</span>
    </nav>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading artist…"
      variant="detail"
    />
    <p v-else-if="error" role="alert">
      Could not load this artist.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <template v-else-if="artist">
      <header class="detail-hero">
        <AlbumArt :src="artist.artistImage" />
        <div class="artist-info">
          <h1 class="page-heading">{{ artist.name }}</h1>
          <p class="page-summary">
            {{ artist.albums.length }}
            {{ artist.albums.length === 1 ? "album" : "albums"
            }}<span v-if="trackRows">
              · {{ trackRows.length }}
              {{ trackRows.length === 1 ? "track" : "tracks" }}</span
            >
          </p>
          <p>Explore the albums and tracks in your library.</p>
          <div class="artist-actions">
            <button
              class="btn btn-primary"
              :disabled="!artistTracks.length"
              @click="playArtist(false)"
            >
              Play tracks
            </button>
            <button
              class="btn btn-outline"
              :disabled="!artistTracks.length"
              @click="playArtist(true)"
            >
              Shuffle
            </button>
            <button
              class="btn btn-outline"
              :disabled="!artistTracks.length"
              @click="addToQueue"
            >
              Add to Queue
            </button>
            <button
              class="btn btn-ghost"
              :disabled="!artistTracks.length"
              @click="openPicker"
            >
              Add to playlist
            </button>
          </div>
        </div>
      </header>
      <section class="artist-section">
        <div class="section-heading">
          <h2>Albums</h2>
          <NuxtLink :to="{ path: '/albums', query: { artistId: artist.id } }"
            >View all albums →</NuxtLink
          >
        </div>
        <div v-if="mappedAlbums.length" class="collection-grid">
          <AlbumCard
            v-for="album in mappedAlbums"
            :key="album.albumId"
            :album="album"
            :available-actions="[]"
            :is-playing-this-album="
              player.isPlaying && player.currentTrack?.albumId === album.albumId
            "
            :is-loading-this-album="loadingAlbumId === album.albumId"
            @play="playAlbum"
          />
        </div>
        <p v-else>No albums found for this artist.</p>
      </section>
      <section class="artist-section">
        <h2>Tracks</h2>
        <UiLoadingSkeleton
          v-if="tracksPending"
          label="Loading tracks…"
          variant="tracks"
        />
        <p v-else-if="tracksError" role="alert">
          Could not load tracks.
          <button class="btn btn-outline" @click="refreshTracks()">
            Try again
          </button>
        </p>
        <ul v-else-if="artistTracks.length" class="artist-tracks">
          <li v-for="(track, index) in artistTracks" :key="track.trackId">
            <button
              class="btn btn-circle btn-primary"
              :aria-label="`${player.isPlaying && player.currentTrack?.trackId === track.trackId ? 'Pause' : 'Play'} ${track.title}`"
              @click="playTrack(index)"
            >
              <Icon
                :name="
                  player.isPlaying &&
                  player.currentTrack?.trackId === track.trackId
                    ? 'material-symbols:pause-rounded'
                    : 'material-symbols:play-arrow-rounded'
                "
                aria-hidden="true"
              />
            </button>
            <div>
              <h3>{{ track.title }}</h3>
              <NuxtLink v-if="track.albumId" :to="`/albums/${track.albumId}`">{{
                track.albumTitle
              }}</NuxtLink>
            </div>
            <span>{{ formatTrackDuration(track.duration) }}</span>
          </li>
        </ul>
        <p v-else>No tracks found for this artist.</p>
      </section>
    </template>
    <PlaylistPicker
      :open="pickerOpen"
      :title="`Add ${artist?.name || 'artist'} to playlist`"
      :playlists="playlists"
      :pending="loadingPlaylists"
      :load-error="
        playlistsError ? 'Could not load playlists. Please try again.' : ''
      "
      @retry="fetchPlaylists"
      :busy="adding"
      :error="addError"
      @close="pickerOpen = false"
      @select="addToPlaylist"
    />
  </div>
</template>
<script setup lang="ts">
import type { Album } from "~/types/album";
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { usePlaylists } from "~/composables/usePlaylists";
import { formatTrackDuration } from "~/utils/formatters";
import AlbumArt from "~/components/album/album-art.vue";
import AlbumCard from "~/components/album/album-card.vue";
import PlaylistPicker from "~/components/library/playlist-picker.vue";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute();
const artistId = computed(() => String(route.params.id));
interface ArtistDetails {
  id: string;
  name: string;
  artistImage: string | null;
  albums: Array<{
    id: string;
    title: string;
    year: number | null;
    cover_path: string | null;
    albumArtistId: string | null;
    albumArtistName: string | null;
  }>;
}
interface TrackRow {
  id: string;
  title: string;
  path: string;
  duration: number | null;
  trackNumber: number | null;
  genre: string | null;
  albumId: string | null;
  albumTitle: string | null;
  artistId: string | null;
  artistName: string | null;
  coverPath: string | null;
  createdAt: string;
}
const {
  data: artist,
  pending,
  error,
  refresh,
} = useLazyFetch<ArtistDetails>(() => `/api/artists/${artistId.value}`);
const {
  data: trackRows,
  pending: tracksPending,
  error: tracksError,
  refresh: refreshTracks,
} = useLazyFetch<TrackRow[]>("/api/tracks", {
  query: computed(() => ({ artistId: artistId.value })),
});
useHead(() => ({ title: usePageTitle(artist.value?.name || "Artist") }));
const player = usePlayerStore();
const { showNotification } = useNotification();
const {
  playlists,
  fetchPlaylists,
  loading: loadingPlaylists,
  error: playlistsError,
} = usePlaylists();
const pickerOpen = ref(false);
const adding = ref(false);
const addError = ref("");
const loadingAlbumId = ref<string | null>(null);
const mappedAlbums = computed<Album[]>(() =>
  (artist.value?.albums || []).map((album) => ({
    albumId: album.id,
    title: album.title,
    year: album.year,
    coverPath: album.cover_path,
    artists:
      album.albumArtistId && album.albumArtistName
        ? [
            {
              artistId: album.albumArtistId,
              name: album.albumArtistName,
              isPrimaryArtist: true,
            },
          ]
        : [],
  })),
);
const artistTracks = computed<Track[]>(() =>
  (trackRows.value || []).map((row) => ({
    trackId: row.id,
    title: row.title,
    filePath: row.path,
    duration: row.duration,
    trackNumber: row.trackNumber,
    albumId: row.albumId,
    albumTitle: row.albumTitle || undefined,
    genre: row.genre,
    coverPath: row.coverPath,
    artists:
      row.artistId && row.artistName
        ? [
            {
              artistId: row.artistId,
              name: row.artistName,
              isPrimaryArtist: true,
            },
          ]
        : [],
    artistName: row.artistName || undefined,
    year: null,
    diskNumber: null,
    explicit: false,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  })),
);
function playArtist(shuffle: boolean) {
  if (!artist.value || !artistTracks.value.length) return;
  player.loadQueue(
    artistTracks.value,
    { type: "artist", id: artist.value.id, name: artist.value.name },
    true,
    0,
    shuffle,
  );
}
function playTrack(index: number) {
  if (!artist.value) return;
  if (
    player.currentQueueContext.id === artist.value.id &&
    player.currentTrack?.trackId === artistTracks.value[index]?.trackId
  )
    return player.togglePlayPause();
  player.loadQueue(
    artistTracks.value,
    { type: "artist", id: artist.value.id, name: artist.value.name },
    true,
    index,
  );
}
function addToQueue() {
  player.addTracksToQueue(artistTracks.value);
  player.showQueueSidebar();
  showNotification("Artist tracks added to queue.", "success");
}
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
function openPicker() {
  pickerOpen.value = true;
  addError.value = "";
  fetchPlaylists();
}
async function addToPlaylist(playlistId: string) {
  if (adding.value) return;
  adding.value = true;
  addError.value = "";
  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: {
        action: "add",
        trackIds: artistTracks.value.map((track) => track.trackId),
      },
    });
    pickerOpen.value = false;
    showNotification("Artist tracks added to playlist.", "success");
  } catch {
    addError.value = "Could not add these tracks. Please try again.";
  } finally {
    adding.value = false;
  }
}
</script>
<style scoped>
.breadcrumbs {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  color: var(--muted, #62594f);
  margin-bottom: 1.5rem;
}
.breadcrumbs a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.breadcrumbs span {
  align-self: center;
}
.detail-hero {
  display: grid;
  grid-template-columns: minmax(150px, 280px) minmax(0, 1fr);
  gap: clamp(1.5rem, 4vw, 3rem);
  align-items: center;
}
.artist-info {
  min-width: 0;
}
.artist-info > p {
  color: var(--muted, #62594f);
}
.artist-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.75rem;
}
.artist-section {
  border-top: 1px solid var(--line, #c9c1b4);
  padding-top: 1.25rem;
  margin-top: 2.5rem;
}
.detail-hero + .artist-section {
  border-top: 0;
  padding-top: 0;
  margin-top: 0;
}
.artist-section h2 {
  font-size: 2.25rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
.section-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  border-top: 0;
  padding-top: 0;
  margin-top: 0;
}
.section-heading a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.artist-tracks {
  list-style: none;
  margin: 0;
  padding: 0;
}
.artist-tracks li {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr) auto;
  align-items: center;
  gap: 1.25rem;
  padding: 1rem 0;
  border-bottom: 1px solid var(--line, #c9c1b4);
}
.artist-tracks h3 {
  font-size: 1.45rem;
  margin: 0 0 0.2rem;
  overflow-wrap: anywhere;
  font-weight: 500;
}
.artist-tracks a,
.artist-tracks li > span {
  color: var(--muted, #62594f);
  font-size: 0.875rem;
}
@media (max-width: 650px) {
  .detail-hero {
    grid-template-columns: 1fr;
  }
  .detail-hero > .album-art {
    max-width: 220px;
  }
  .artist-tracks li {
    gap: 0.75rem;
  }
}
</style>
