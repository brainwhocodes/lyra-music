<template>
  <div class="container mx-auto p-4">
    <h1 class="text-3xl font-bold mb-6">Artists</h1>

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

    <!-- Artist List/Grid -->
    <div v-else class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
       <div 
         v-for="artist in artists" 
         :key="artist.id" 
         class="card card-compact bg-base-200 shadow-md hover:shadow-lg transition-shadow cursor-pointer"
         @click="goToArtist(artist.id)" 
         >
         <div class="card-body items-center text-center">
           <h2 class="card-title">{{ artist.name }}</h2>
           <!-- TODO: Add artist image or placeholder -->
           <!-- TODO: Add album/track counts if added to API -->
         </div>
       </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define type for artist data
interface Artist {
  id: number;
  name: string;
  // Add counts later if implemented
  // albumCount?: number;
  // trackCount?: number;
}

// State
const artists = ref<Artist[]>([]);
const loading = ref(true);
const error = ref<string | null>(null);

// Fetch artists on component mount
onMounted(async () => {
  loading.value = true;
  error.value = null;
  try {
    const data = await $fetch<Artist[]>('/api/artists');
    artists.value = data;
  } catch (err: any) {
    console.error('Error fetching artists:', err);
    error.value = err.data?.message || err.message || 'Failed to load artists.';
  } finally {
    loading.value = false;
  }
});

// Navigation function
function goToArtist(artistId: number) {
  // Navigate to a dedicated artist page or filter another page
  // For now, let's assume we'll filter the albums page
   navigateTo({ path: '/albums', query: { artistId: artistId } });
   console.log(`Navigate to view for artist ID: ${artistId}`);
}

</script>

<style scoped>
/* Add any page-specific styles here if needed */
</style>
