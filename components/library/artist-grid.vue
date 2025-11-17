<template>
  <div>
    <div v-if="pending" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-8 gap-4">
      <div v-for="n in 8" :key="n" class="animate-pulse">
        <div class="bg-base-300 aspect-square w-full rounded-lg"></div>
        <div class="bg-base-300 h-4 w-3/4 mt-2 rounded"></div>
      </div>
    </div>
    <div v-else-if="error" class="text-error">
      <p>Could not load artists. Please try again later.</p>
    </div>
    <div v-else-if="limitedArtists && limitedArtists.length" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
       <NuxtLink 
         v-for="artist in limitedArtists" 
         :key="artist.artistId" 
         :to="`/artists/${artist.artistId}`"
         class="card card-compact bg-base-100 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
         >
         <figure class="aspect-square overflow-hidden">
           <img 
             :src="getArtistImageUrl(artist.artistImage)" 
             :alt="artist.artistName" 
             class="w-full h-full object-cover"
           />
         </figure>
         <div class="card-body items-center text-center">
           <h2 class="card-title">{{ artist.artistName }}</h2>
         </div>
       </NuxtLink>
    </div>
    <div v-else>
      <p>No artists found in your library.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from '#imports';
import type { Artist } from '~/types/artist';

const { data: artists, pending, error } = useLazyFetch<Artist[]>('/api/artists');

const limitedArtists = computed(() => {
  if (!artists.value) return [];
  return artists.value.slice(0, 6);
});

function getArtistImageUrl(imagePath: string | null): string {
  return imagePath ? `${imagePath}` : '/images/icons/default-artist-art.webp';
}
</script>
