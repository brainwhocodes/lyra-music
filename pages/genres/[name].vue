<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';

const route = useRoute();
const playerStore = usePlayerStore();

const genreName = computed(() => {
  try {
    return decodeURIComponent(route.params.name as string);
  } catch (e) {
    console.error("Error decoding genre name:", e);
    return route.params.name as string; // Fallback to raw param
  }
});

// Define the structure for albums within the genre details
interface GenreAlbum {
  id: number;
  title: string;
  year: number | null;
  cover_path: string | null;
  artist_id: number;
  artist_name: string;
}

// Define the structure expected from the API
interface GenreDetails {
  name: string;
  albums: GenreAlbum[];
}

const { data: genreDetails, pending, error } = await useAsyncData<GenreDetails>(
  `genre-${genreName.value}`,
  // Ensure the genre name is encoded for the URL path
  () => $fetch(`/api/genres/${encodeURIComponent(genreName.value)}`),
  { watch: [genreName] } // Refetch if the genre name changes
);

const getCoverUrl = (coverPath: string | null | undefined): string => {
  return coverPath ? `/api/covers${coverPath}` : '/img/placeholder.png';
};

// Function to play a specific album
const playAlbum = async (albumId: number): Promise<void> => {
  try {
    const tracks = await $fetch(`/api/tracks?albumId=${albumId}`);
    if (tracks && tracks.length > 0) {
      playerStore.loadQueue(tracks);
    } else {
      console.warn(`No tracks found for album ${albumId}`);
    }
  } catch (err) {
    console.error(`Error fetching tracks for album ${albumId}:`, err);
  }
};

// Set page title
useHead(() => ({
  title: `Genre: ${genreName.value}`
}));

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg">
      <div>
        <Icon name="material-symbols:error-outline-rounded" class="w-6 h-6"/>
        <span>Error loading albums for genre '{{ genreName }}': {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="genreDetails">
      <h1 class="text-3xl font-bold mb-6">Genre: {{ genreDetails.name }}</h1>

      <div v-if="genreDetails.albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div 
          v-for="album in genreDetails.albums" 
          :key="album.id" 
          class="card bg-base-100 shadow-xl overflow-hidden group relative"
        >
          <figure class="aspect-square relative">
             <NuxtLink :to="`/albums/${album.id}`" title="View Album">
              <img 
                :src="getCoverUrl(album.cover_path)" 
                :alt="album.title" 
                class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
                loading="lazy"
              />
            </NuxtLink>
            <!-- Overlay Play Button -->
            <div class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
              <button @click.stop="playAlbum(album.id)" title="Play Album">
                <Icon name="material-symbols:play-arrow-rounded" class="w-12 h-12 text-white" />
              </button>
            </div>
          </figure>
          <div class="card-body p-3">
            <NuxtLink :to="`/albums/${album.id}`" class="hover:text-primary transition-colors duration-200" title="View Album">
              <h2 class="card-title text-sm truncate" :title="album.title">{{ album.title }}</h2>
            </NuxtLink>
             <NuxtLink 
                :to="`/artists/${album.artist_id}`" 
                class="text-xs text-neutral-content hover:text-primary transition-colors duration-200 truncate"
                :title="album.artist_name"
              >
                 {{ album.artist_name }}
              </NuxtLink>
            <p v-if="album.year" class="text-xs text-gray-500">{{ album.year }}</p>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-gray-500">No albums found for the genre "{{ genreDetails.name }}".</p>
      </div>

    </div>
     <div v-else class="text-center text-gray-500">
      <p>Genre not found.</p>
    </div>
  </div>
</template>
