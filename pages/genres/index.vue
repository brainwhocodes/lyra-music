
<script setup lang="ts">
import type { Genre } from '~/types/genre';

// Fetch genres from the API endpoint /api/genres/index.get.ts
const { data: genres, pending, error } = await useLazyFetch<Genre[]>('/api/genres');

watch(genres.value, (newGenres: Genre[] | null) => {
  if (newGenres) {
    pending.value = false;
    useSeoMeta({
      title: usePageTitle('Genres')
    });
    genres.value = newGenres;
  }
});

if (genres.value) {
  useSeoMeta({
    title: usePageTitle('Genres')
  });
  genres.value = genres.value;
}

// Simple fuzzy search filtering
const searchQuery = ref('');
const filteredGenres = computed(() => {
  if (!searchQuery.value) {
    return genres.value;
  }
  const lowerQuery = searchQuery.value.toLowerCase();
  return genres.value?.filter((genre: Genre) => 
    genre.name.toLowerCase().includes(lowerQuery)
  );
});




definePageMeta({
  layout: 'sidebar-layout'
});

</script>

<template>
  <div class="container mx-auto px-4 py-8 overflow-y-auto bg-base-200">
    <h1 class="text-3xl font-bold mb-6">Genres</h1>

    <!-- Search Bar -->
    <div class="mb-6">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="Search genres..." 
        class="input input-bordered w-full max-w-md bg-C"
      />
    </div>

    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="text-center text-error">
      <p>Error loading genres: {{ error.message }}</p>
    </div>
    <div v-else-if="filteredGenres.length === 0" class="text-center">
      <p>No genres found.</p>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      <NuxtLink 
        v-for="genre in filteredGenres" 
        :key="genre.genreId" 
        :to="`/genres/${genre.genreId}`"
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300"
      >
        <div class="card-body">
          <h2 class="card-title truncate">{{ genre.name }}</h2>
          <p class="text-sm text-base-content/70">{{ genre.albumCount }} album{{ genre.albumCount !== 1 ? 's' : '' }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>