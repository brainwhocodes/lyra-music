<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Albums {{ artistName ? `by ${artistName}` : '' }}</h1>

    <div v-if="loading" class="text-center">
      <span class="loading loading-lg loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Error loading albums: {{ error }}</span>
    </div>

    <div v-else-if="albums.length === 0" class="text-center text-gray-500">
      No albums found{{ artistName ? ` for ${artistName}` : '' }}.
    </div>

    <!-- Album List/Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
      <div 
        v-for="album in albums" 
        :key="album.id" 
        class="card card-compact bg-base-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
        @click="goToAlbum(album.id)"
        >
        <figure>
          <img 
            :src="getCoverArtUrl(album.artPath)" 
            :alt="album.title" 
            class="aspect-square object-cover w-full" 
            @error="onImageError"
            />
            <!-- Basic placeholder using CSS if no artPath and no placeholder file -->
            <!-- <div v-else class="aspect-square w-full bg-base-300 flex items-center justify-center">
              <svg class="w-1/2 h-1/2 text-base-content opacity-20" fill="currentColor" viewBox="0 0 20 20"><path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 1.343-3 3s1.343 3 3 3 3-1.343 3-3V4a1 1 0 00-.804-.98zM7 6.18v6.934A4.316 4.316 0 006.99 14.006 4.369 4.369 0 005 14c-.94 0-1.791.41-2.364 1.088A2.99 2.99 0 015 15c.94 0 1.791.41 2.364 1.088A2.99 2.99 0 017 17c.01-.002.01-.004.01-.006V6.18zM17 14.114V4.82l-8 1.6v6.694A4.37 4.37 0 0015 12c.94 0 1.791.41 2.364 1.088A2.99 2.99 0 0117 15c.94 0 1.791.41 2.364 1.088A2.99 2.99 0 0117 17v-2.886z"></path></svg>
            </div> -->
        </figure>
        <div class="card-body">
          <h2 class="card-title text-sm truncate" :title="album.title">{{ album.title }}</h2>
          <p class="text-xs truncate" :title="album.artistName || 'Unknown Artist'">{{ album.artistName || 'Unknown Artist' }}</p>
          <p class="text-xs text-gray-500">{{ album.year || '' }}</p>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define type for album data
interface Album {
  id: number;
  title: string;
  year: number | null;
  artPath: string | null;
  artistId: number | null;
  artistName: string | null; // Included from join
}

// Function to get cover art URL (adjust path as needed)
function getCoverArtUrl(artPath: string | null): string {
  // TODO: Determine the correct base URL or prefix for serving cover art
  // This might involve a dedicated API endpoint or configuring Nuxt Image
  if (artPath) {
    // Assuming artPath is relative to a public dir or served via API
    // Example: return `/api/covers/${encodeURIComponent(artPath)}`;
    // Placeholder: return a default image if path exists but is invalid for now
    return artPath.replace('\\', '/').replace('/public', ''); // Placeholder
  }
  // Return a default placeholder image if artPath is null
  return '/images/icons/placeholder-music.svg';
}

const route = useRoute();

// State
const albums = ref<Album[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const artistName = ref<string | null>(null); // To display if filtering by artist

// Computed property for API query parameters
const apiQuery = computed(() => {
  const query: { artistId?: number } = {};
  if (route.query.artistId) {
    query.artistId = Number(route.query.artistId);
  }
  return query;
});

// Fetch albums function
async function fetchAlbums() {
  loading.value = true;
  error.value = null;
  artistName.value = null; // Reset artist name
  try {
    const data = await $fetch<Album[]>('/api/albums', { query: apiQuery.value });
    albums.value = data;
    // If filtered by artist and results exist, grab the artist name from the first album
    if (apiQuery.value.artistId && data.length > 0) {
        artistName.value = data[0].artistName;
    }
  } catch (err: any) {
    console.error('Error fetching albums:', err);
    error.value = err.data?.message || err.message || 'Failed to load albums.';
  } finally {
    loading.value = false;
  }
}

// Fetch albums on component mount and when query changes
onMounted(() => {
  fetchAlbums();
});

watch(() => route.query, () => {
    fetchAlbums();
}, { immediate: true }); // Use immediate: true if needed based on Nuxt version/behavior


// Navigation function
function goToAlbum(albumId: number) {
  navigateTo(`/albums/${albumId}`);
  console.log(`Navigate to view for album ID: ${albumId}`);
}

// Handle image loading errors (e.g., show placeholder)
function onImageError(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = '/placeholder-cover.png'; // Path to your placeholder image in public dir
}

</script>

<style scoped>
/* Add any page-specific styles here if needed */
.card-title {
    white-space: normal; /* Allow wrapping for longer titles */
    overflow-wrap: break-word;
}
</style>
