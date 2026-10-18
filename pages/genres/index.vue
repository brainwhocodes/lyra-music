<template>
  <div class="genres-page">
    <header class="page-intro">
      <h1 class="page-heading">Genres</h1>
      <p class="genre-subtitle">Browse your collection by sound.</p>
    </header>
    <div class="page-toolbar">
      <label
        ><span class="sr-only">Search genres</span
        ><input
          v-model="query"
          class="input input-bordered"
          type="search"
          placeholder="Search genres..."
      /></label>
    </div>
    <UiLoadingSkeleton v-if="pending" label="Loading genres…" variant="tiles" />
    <p v-else-if="error" role="alert">
      Could not load genres.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <p v-else-if="!filtered.length" role="status">
      {{
        query
          ? "No genres match your search."
          : "No genres in your library yet."
      }}
    </p>
    <div v-else class="genre-grid">
      <NuxtLink
        v-for="genre in filtered"
        :key="genre.genreId"
        :to="`/genres/${genre.genreId}`"
        class="genre-tile"
        ><AlbumArt :src="getGenreImageUrl(genre.name)" class="genre-art" />
        <div class="genre-copy"><h2>{{ genre.name }}</h2>
        <p>
          {{ genre.albumCount }}
          {{ genre.albumCount === 1 ? "album" : "albums" }}
        </p>
        </div><span class="genre-arrow" aria-hidden="true">↗</span></NuxtLink
      >
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Genre } from "~/types/genre";
import AlbumArt from "~/components/album/album-art.vue";
const { getGenreImageUrl } = useGenreImage();
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Genres") });
const {
  data: genres,
  pending,
  error,
  refresh,
} = useLazyFetch<Genre[]>("/api/genres");
const query = ref("");
const filtered = computed(() =>
  (genres.value || []).filter((genre) =>
    genre.name.toLowerCase().includes(query.value.trim().toLowerCase()),
  ),
);
</script>
<style scoped>
.genre-subtitle {
  font-family: var(--font-display);
  color: var(--ink, #262522);
  font-size: clamp(1.5rem, 3.5vw, 3rem);
  line-height: 1.2;
  font-style: normal;
}
.genre-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1rem;
}
.genre-tile {
  position: relative;
  display: grid;
  grid-template-columns: 36% minmax(0, 1fr);
  align-items: center;
  min-height: 138px;
  overflow: hidden;
  border: 1px solid var(--rule, #b4a99a);
  color: inherit;
  text-decoration: none;
}
.genre-art { align-self: stretch; border: 0; }
.genre-copy { padding: 1rem 2.25rem 1rem 1.25rem; min-width: 0; }
.genre-tile h2 {
  font-size: clamp(1.6rem, 3vw, 2.75rem);
  margin: 0 0 0.35rem;
  font-weight: 500;
  overflow-wrap: anywhere;
}
.genre-tile p {
  color: var(--muted, #62594f);
  margin: 0;
}
.genre-arrow {
  position: absolute;
  right: 1.25rem;
  top: 1.75rem;
}
.genre-tile:hover {
  border-color: var(--copper, #a34127);
  background: var(--color-base-200);
}
@media (max-width: 550px) {
  .genre-grid {
    grid-template-columns: 1fr;
  }
}
</style>
