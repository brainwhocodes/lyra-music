<template>
  <UiLoadingSkeleton
    v-if="pending"
    label="Loading genres…"
    variant="compact"
    :count="limit"
  />
  <p v-else-if="error" role="alert">Could not load genres. Please try again.</p>
  <div v-else-if="genres?.length" class="library-links">
    <GenreCard
      v-for="genre in genres.slice(0, limit)"
      :key="genre.genreId"
      :genre="genre"
    />
  </div>
  <p v-else>No genres in your library yet.</p>
</template>
<script setup lang="ts">
import GenreCard from "~/components/library/genre-card.vue";
withDefaults(defineProps<{ limit?: number }>(), { limit: 4 });
const {
  data: genres,
  pending,
  error,
} = useLazyFetch<Array<{ genreId: string; name: string }>>("/api/genres");
</script>
