
<script setup lang="ts">
import { ref, computed } from 'vue';

// Define the expected structure from the API
interface Genre {
  name: string;
  album_count: number; // Assuming the API provides this
}

// Fetch genres from the API endpoint /api/genres/index.get.ts
const { data: genres, pending, error } = await useAsyncData<Genre[]>(
  'genres-list',
  () => $fetch('/api/genres'), 
);

// Simple fuzzy search filtering
const searchQuery = ref('');
const filteredGenres = computed(() => {
  if (!searchQuery.value) {
    return genres.value;
  }
  const lowerQuery = searchQuery.value.toLowerCase();
  return genres.value?.filter(genre => 
    genre.name.toLowerCase().includes(lowerQuery)
  );
});


useHead({ title: 'Genres' });

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <h1 class="text-3xl font-bold mb-6">Genres</h1>

    <!-- Search Bar -->
    <div class="mb-6">
      <input 
        type="text" 
        v-model="searchQuery" 
        placeholder="Search genres..." 
        class="input input-bordered w-full max-w-md"
      />
    </div>

    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg">
      <div>
        <Icon name="material-symbols:error-outline-rounded" class="w-6 h-6"/>
        <span>Error loading genres: {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="filteredGenres && filteredGenres.length > 0">
      <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <NuxtLink 
          v-for="genre in filteredGenres" 
          :key="genre.name" 
          :to="`/genres/${encodeURIComponent(genre.name)}`" 
          class="card bg-base-100 hover:bg-base-200 shadow-md transition-colors duration-200 p-4 text-center"
          :title="`${genre.name} (${genre.album_count} album${genre.album_count !== 1 ? 's' : ''})`"
        >
          <h2 class="text-lg font-semibold truncate">{{ genre.name }}</h2>
          <p class="text-sm text-neutral-content">{{ genre.album_count }} album{{ genre.album_count !== 1 ? 's' : '' }}</p>
        </NuxtLink>
      </div>
    </div>
    <div v-else class="text-center text-neutral-content italic">
       <p v-if="searchQuery">No genres found matching "{{ searchQuery }}".</p>
       <p v-else>No genres found in the library.</p>
    </div>

  </div>
</template>