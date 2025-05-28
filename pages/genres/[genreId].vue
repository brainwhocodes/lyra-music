<script setup lang="ts">
// Removed 'ref' as it's not used directly here
import { useRoute } from 'vue-router';
import type { Album } from '~/types/album'; // Assuming Album type is in types/album.ts

// Interface for the basic genre info fetched for the title
interface GenreBasicInfo {
  genreId: string;
  name: string;
  albumCount: number; // Or whatever fields /api/genres returns
}

const route = useRoute();
const genreId = route.params.genreId as string;

const { data: albums, pending, error } = await useLazyFetch<Album[]>(`/api/genres/${genreId}/albums`, {
  server: false,
});

// For displaying the genre name
const { data: allGenres } = await useFetch<GenreBasicInfo[]>(`/api/genres`); 
const currentGenre = computed(() => {
  if (allGenres.value && genreId) {
    return allGenres.value.find((g: GenreBasicInfo) => g.genreId === genreId);
  }
  return null;
});

const genrePageTitle = computed(() => currentGenre.value ? `${currentGenre.value.name} Albums` : 'Genre Albums');
useHead({ title: genrePageTitle });

definePageMeta({
  layout: 'sidebar-layout'
});

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/genres" class="btn btn-ghost btn-sm mb-4">&larr; Back to Genres</NuxtLink>
      <h1 class="text-3xl font-bold">{{ currentGenre?.name || 'Genre' }} Albums</h1>
    </div>

    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="text-center text-error">
      <p>Error loading albums for this genre: {{ error.message }}</p>
    </div>
    <div v-else-if="!albums || albums.length === 0" class="text-center">
      <p>No albums found for this genre.</p>
    </div>
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      <NuxtLink 
        v-for="album in albums" 
        :key="album.albumId" 
        :to="`/albums/${album.albumId}`"
        class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300"
      >
        <figure v-if="album.coverPath" class="aspect-square">
          <img :src="album.coverPath" :alt="album.title" class="object-cover w-full h-full" />
        </figure>
        <div v-else class="aspect-square bg-base-300 flex items-center justify-center">
          <Icon name="mdi:album" class="w-16 h-16 text-base-content/30" />
        </div>
        <div class="card-body p-4">
          <h2 class="card-title text-base truncate" :title="album.title">{{ album.title }}</h2>
          <p v-if="album.artistName" class="text-sm text-base-content/70 truncate" :title="album.artistName">{{ album.artistName }}</p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
