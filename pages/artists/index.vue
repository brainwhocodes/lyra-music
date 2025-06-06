<template>
  <div class="w-full h-full p-4 bg-base-200 overflow-y-auto">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Artists</h1>
    </div>

    <div v-if="loading" class="text-center">
      <span class="loading loading-lg loading-spinner"></span>
    </div>

    <div v-else-if="error" class="alert alert-error">
      <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      <span>Error loading artists: {{ error }}</span>
    </div>

    <div v-else-if="artists.length === 0" class="text-center text-gray-500">
      No artists found. Have you scanned your libraries?
    </div>

    <!-- Artist Grid View -->
    <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
       <NuxtLink 
         v-for="artist in artists" 
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
           <!-- TODO: Add album/track counts if added to API -->
         </div>
       </NuxtLink>
    </div>
  

  </div>
</template>

<script setup lang="ts">
// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define type for artist data
interface Artist {
  artistId: string;
  artistName: string;
  artistImage: string | null;
  // Add counts later if implemented
  // albumCount?: number;
  // trackCount?: number;
}
useHead(() => ({
  title: usePageTitle('Artists'),
}));

// State
const artists = ref<Artist[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);
const viewMode = ref<'grid' | 'table'>('grid');

// Fetch artists on component mount
onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await $fetch<Artist[]>('/api/artists');
    artists.value = data;
  } catch (err: any) {
    error.value = err.data?.message || err.message || 'Failed to load artists.';
  } finally {
    loading.value = false;
  }
});

function getArtistImageUrl(imagePath: string | null): string {
  return imagePath ? `${imagePath}` : '/images/icons/default-artist-art.webp';
}

// Navigation function
function goToArtist(artistId: string): void {
  // Navigate to the artist detail page
  navigateTo(`/artists/${artistId}`);
}

// Handle artist options
function handleArtistOptions(artist: Artist): void {
  // Implement options menu functionality here
}

</script>

<style scoped>
/* Add any page-specific styles here if needed */
</style>
