<template>
  <div>
    <header class="page-intro">
      <h1 class="page-heading">Artists</h1>
      <p v-if="artists">
        {{ artists.length }}
        {{ artists.length === 1 ? "artist" : "artists" }} in your collection
      </p>
    </header>
    <div class="page-toolbar artist-toolbar">
      <label
        ><span class="sr-only">Search artists</span
        ><input
          v-model="query"
          type="search"
          class="input input-bordered"
          placeholder="Search artists..."
      /></label>
      <select
        v-model="sort"
        class="select select-bordered"
        aria-label="Sort artists"
      >
        <option value="asc">Sort: A–Z</option>
        <option value="desc">Sort: Z–A</option>
      </select>
    </div>
    <UiLoadingSkeleton v-if="pending" label="Loading artists…" />
    <p v-else-if="error" role="alert">
      Could not load artists.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </p>
    <p v-else-if="!filteredArtists.length" role="status">
      {{
        query
          ? "No artists match your search."
          : "No artists in your library yet. Add a music folder in Settings."
      }}
    </p>
    <div v-else class="collection-grid artist-grid">
      <NuxtLink
        v-for="artist in filteredArtists"
        :key="artist.artistId"
        :to="`/artists/${artist.artistId}`"
        class="artist-card"
      >
        <AlbumArt :src="artist.artistImage" />
        <h2>{{ artist.artistName }}</h2>
        <span>Explore artist <span aria-hidden="true">↗</span></span>
      </NuxtLink>
    </div>
  </div>
</template>
<script setup lang="ts">
import AlbumArt from "~/components/album/album-art.vue";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Artists") });
const {
  data: artists,
  pending,
  error,
  refresh,
} = useLazyFetch<
  Array<{ artistId: string; artistName: string; artistImage: string | null }>
>("/api/artists");
const query = ref("");
const sort = ref("asc");
const filteredArtists = computed(() =>
  (artists.value || [])
    .filter((artist) =>
      artist.artistName
        .toLowerCase()
        .includes(query.value.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort.value === "asc"
        ? a.artistName.localeCompare(b.artistName)
        : b.artistName.localeCompare(a.artistName),
    ),
);
</script>
<style scoped>
.artist-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem;
  justify-content: space-between;
  padding-bottom: 1.5rem;
  margin-bottom: 2rem;
  border-bottom: 1px solid var(--line, #c9c1b4);
}
.artist-toolbar label {
  flex: 1;
  max-width: 650px;
  min-width: min(100%, 240px);
}
.artist-toolbar input {
  width: 100%;
}
.artist-card {
  color: inherit;
  text-decoration: none;
  min-width: 0;
}
.artist-card h2 {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2.4vw, 2.2rem);
  margin: 1rem 0 0.4rem;
  overflow-wrap: anywhere;
}
.artist-card > span {
  display: flex;
  justify-content: space-between;
  color: var(--muted, #62594f);
}
.artist-card:hover h2 {
  color: var(--copper, #a34127);
}
</style>
