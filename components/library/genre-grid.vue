<template>
  <div>
    <div v-if="pending" class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <!-- Skeleton loader -->
      <div v-for="n in internalLimit" :key="n" class="animate-pulse card bg-base-300 aspect-video"></div>
    </div>
    <div v-else-if="error" class="text-error">
      <p>Could not load genres. Please try again later.</p>
    </div>
    <div v-else-if="limitedGenres && limitedGenres.length" class="grid grid-cols-2 md:grid-cols-6 gap-4">
      <GenreCard v-for="genre in limitedGenres" :key="genre.id" :genre="genre" />
    </div>
    <div v-else>
      <p>No genres found.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import type { Genre } from '~/types/genre';
import GenreCard from '~/components/library/genre-card.vue';

const props = withDefaults(defineProps<{
  limit?: number;
}>(), {
  limit: 6,
});

const { data: genres, pending, error } = useLazyFetch<Genre[]>('/api/genres');

const limitedGenres = computed(() => {
  if (!genres.value) return [];
  return genres.value.slice(0, props.limit);
});

const internalLimit = computed(() => props.limit || 6);

</script>
