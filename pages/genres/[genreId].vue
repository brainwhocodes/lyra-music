<template>
  <div>
    <NuxtLink to="/genres" class="btn btn-ghost genre-back">← Genres</NuxtLink>
    <header class="page-intro genre-intro">
      <h1 class="page-heading">{{ genre?.name || "Genre" }}</h1>
      <p>
        {{
          genre
            ? `The albums and tracks filed under ${genre.name} in your collection.`
            : "Browse the music in your collection."
        }}
      </p>
      <p v-if="collection">
        {{ genreTracks.length }}
        {{ genreTracks.length === 1 ? "track" : "tracks" }} ·
        {{ collection.albums.length }}
        {{ collection.albums.length === 1 ? "album" : "albums" }}
      </p>
      <button
        class="btn btn-primary"
        :disabled="!genreTracks.length"
        @click="playAll"
      >
        Play all
      </button>
    </header>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading this genre…"
      variant="tracks"
      :count="6"
    />
    <p v-else-if="error" role="alert">
      Could not load this genre.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <template v-else>
      <section class="genre-section">
        <h2>Tracks</h2>
        <TrackTable
          v-if="genreTracks.length"
          :tracks="genreTracks"
          :caption="`Tracks in ${genre?.name || 'this genre'}`"
          @play="playTrack"
        />
        <p v-else>No tracks found for this genre.</p>
      </section>
      <section class="genre-section">
        <h2>Albums</h2>
        <div v-if="collection?.albums.length" class="collection-grid">
          <AlbumCard
            v-for="album in collection.albums"
            :key="album.albumId"
            :album="album"
            :available-actions="[]"
            :is-playing-this-album="
              player.isPlaying && player.currentTrack?.albumId === album.albumId
            "
            @play="playAlbum"
          />
        </div>
        <p v-else>No albums found for this genre.</p>
      </section>
    </template>
  </div>
</template>
<script setup lang="ts">
import type { Album } from "~/types/album";
import type { Track } from "~/types/track";
import type { Genre } from "~/types/genre";
import { usePlayerStore } from "~/stores/player";
import AlbumCard from "~/components/album/album-card.vue";
import TrackTable from "~/components/library/track-table.vue";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute();
const genreId = computed(() => String(route.params.genreId));
const request = useRequestFetch();
const { data: genres } = useLazyFetch<Genre[]>("/api/genres");
const genre = computed(() =>
  genres.value?.find((value) => value.genreId === genreId.value),
);
useHead(() => ({ title: usePageTitle(genre.value?.name || "Genre") }));
const {
  data: collection,
  pending,
  error,
  refresh,
} = useLazyAsyncData(
  `genre-collection-${genreId.value}`,
  async () => {
    const albums = await request<Album[]>(
      `/api/genres/${genreId.value}/albums`,
    );
    const details = await Promise.all(
      albums.map((album) => request<Album>(`/api/albums/${album.albumId}`)),
    );
    return {
      albums,
      tracks: details.flatMap((album) =>
        (album.tracks || []).map((track) => ({
          ...track,
          albumId: album.albumId,
          albumTitle: album.title,
          coverPath: album.coverPath,
          artistId:
            track.artists?.find((artist) => artist.isPrimaryArtist)?.artistId ||
            track.artists?.[0]?.artistId,
          artistName: track.artists?.map((artist) => artist.name).join(", "),
        })),
      ),
    };
  },
  { watch: [genreId] },
);
const player = usePlayerStore();
const genreTracks = computed(() => collection.value?.tracks || []);
function playAll() {
  if (genreTracks.value.length)
    player.loadQueue(
      genreTracks.value,
      {
        type: "all_tracks",
        id: `genre-${genreId.value}`,
        name: genre.value?.name || "Genre",
      },
      true,
    );
}
function playTrack(track: Track) {
  if (player.currentTrack?.trackId === track.trackId)
    return player.togglePlayPause();
  player.loadQueue(
    genreTracks.value,
    {
      type: "all_tracks",
      id: `genre-${genreId.value}`,
      name: genre.value?.name || "Genre",
    },
    true,
    genreTracks.value.findIndex((item) => item.trackId === track.trackId),
  );
}
function playAlbum(album: Album) {
  if (
    player.currentQueueContext.type === "album" &&
    player.currentQueueContext.id === album.albumId
  )
    return player.togglePlayPause();
  const tracks = genreTracks.value.filter(
    (track) => track.albumId === album.albumId,
  );
  if (tracks.length)
    player.loadQueue(
      tracks,
      { type: "album", id: album.albumId, name: album.title },
      true,
    );
}
</script>
<style scoped>
.genre-back {
  padding-left: 0;
  margin-bottom: 1.5rem;
}
.genre-intro {
  max-width: 52rem;
}
.genre-intro > p {
  max-width: 50ch;
  margin: 1rem 0;
  font-size: 1.125rem;
}
.genre-intro > button {
  margin-top: 0.75rem;
}
.genre-section {
  border-top: 1px solid var(--rule, #b4a99a);
  margin-top: 2.5rem;
  padding-top: 1.5rem;
}
.genre-section h2 {
  margin: 0 0 1.25rem;
  font-weight: 500;
}
</style>
