<template>
  <div>
    <header class="page-intro">
      <h1 class="page-heading">Tracks</h1>
      <p class="tracks-subtitle">
        {{
          route.query.albumId
            ? "One album, every detail."
            : route.query.artistId
              ? "An artist, in every track."
              : "Your complete collection."
        }}
      </p>
      <p>
        Every track in your library, all in one place. Play, explore, and
        revisit the music you love.
      </p>
    </header>
    <div class="page-toolbar">
      <label
        ><span class="sr-only">Search tracks</span
        ><input
          v-model="query"
          type="search"
          class="input input-bordered"
          placeholder="Search your tracks..." /></label
      ><select
        v-model="sort"
        class="select select-bordered"
        aria-label="Sort tracks"
      >
        <option value="title">Sort by: Title</option>
        <option value="album">Sort by: Album</option>
        <option value="artist">Sort by: Artist</option>
      </select>
    </div>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading tracks…"
      variant="tracks"
      :count="6"
    />
    <p v-else-if="error" role="alert">
      Could not load tracks.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <p v-else-if="!filtered.length" role="status">
      No tracks found{{
        query ? " matching your search" : " for this selection"
      }}.
    </p>
    <TrackTable
      v-else
      :tracks="filtered"
      caption="Tracks in your collection"
      @play="playTrack"
    />
  </div>
</template>
<script setup lang="ts">
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import TrackTable from "~/components/library/track-table.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Tracks") });
const route = useRoute();
const apiQuery = computed(() => ({
  ...(route.query.artistId ? { artistId: String(route.query.artistId) } : {}),
  ...(route.query.albumId ? { albumId: String(route.query.albumId) } : {}),
}));
interface ApiTrack {
  id: string;
  title: string;
  trackNumber: number | null;
  duration: number | null;
  path: string;
  genre: string | null;
  albumId: string | null;
  albumTitle: string | null;
  coverPath: string | null;
  artistId: string | null;
  artistName: string | null;
  createdAt: string;
}
const {
  data: rows,
  pending,
  error,
  refresh,
} = useLazyFetch<ApiTrack[]>("/api/tracks", { query: apiQuery });
const tracks = computed<Track[]>(() =>
  (rows.value || []).map((row) => ({
    trackId: row.id,
    title: row.title,
    filePath: row.path,
    duration: row.duration,
    trackNumber: row.trackNumber,
    albumId: row.albumId,
    albumTitle: row.albumTitle || undefined,
    coverPath: row.coverPath,
    genre: row.genre,
    artistId: row.artistId,
    artistName: row.artistName || undefined,
    artists:
      row.artistId && row.artistName
        ? [{ artistId: row.artistId, name: row.artistName }]
        : [],
    year: null,
    diskNumber: null,
    explicit: false,
    createdAt: row.createdAt,
    updatedAt: row.createdAt,
  })),
);
const query = ref("");
const sort = ref("title");
const filtered = computed(() =>
  tracks.value
    .filter((track) =>
      [track.title, track.albumTitle, track.artistName].some((value) =>
        value?.toLowerCase().includes(query.value.trim().toLowerCase()),
      ),
    )
    .sort((a, b) =>
      sort.value === "album"
        ? (a.albumTitle || "").localeCompare(b.albumTitle || "") ||
          a.title.localeCompare(b.title)
        : sort.value === "artist"
          ? (a.artistName || "").localeCompare(b.artistName || "") ||
            a.title.localeCompare(b.title)
          : a.title.localeCompare(b.title),
    ),
);
const player = usePlayerStore();
function playTrack(track: Track) {
  if (player.currentTrack?.trackId === track.trackId)
    return player.togglePlayPause();
  player.loadQueue(
    filtered.value,
    { type: "all_tracks", id: "filtered-tracks", name: "Tracks" },
    true,
    filtered.value.findIndex((item) => item.trackId === track.trackId),
  );
}
</script>
<style scoped>
.tracks-subtitle {
  font-family: var(--font-display);
  font-size: clamp(1.6rem, 3.5vw, 3.25rem);
  font-style: normal;
  line-height: 1.15;
  color: var(--ink, #262522);
  margin-bottom: 1.5rem;
}
.page-intro > p:last-child {
  max-width: 55ch;
  font-size: 1.125rem;
}
</style>
