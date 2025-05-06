<template>
  <div>
    <!-- Top Bar: Search + Sort + User -->
    <div class="flex justify-between items-center mb-2 sticky top-0 bg-base-200/80 backdrop-blur py-2 z-10">
       <div class="form-control">
         <input 
           type="text" 
           placeholder="Search Albums by Title..." 
           class="input input-bordered w-72 md:w-96" 
           v-model="searchQuery" 
         />
       </div>
      <div class="flex items-center gap-4">
        <select class="select select-bordered select-sm">
          <option disabled selected>Sorted By: A-Z</option>
          <option>Date Added</option>
          <option>Most Played</option>
          <option>Release Year</option>
        </select>
         <button class="btn btn-ghost btn-circle">
           <Icon name="material-symbols:settings-outline" class="w-6 h-6" />
         </button>
         <div class="dropdown dropdown-end">
            <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
              <div class="w-10 rounded-full">
                <img alt="User Avatar" src="https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
              </div>
            </div>
            <ul tabindex="0" class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
              <li><NuxtLink to="/profile">Profile</NuxtLink></li>
              <li><NuxtLink to="/settings">Settings</NuxtLink></li>
               <li><hr class="my-1" /></li>
              <li><a>Logout</a></li>
            </ul>
          </div>
      </div>
    </div>

    <!-- Genre Filter Tags -->
    <div class="mt-0 mb-4 flex flex-wrap gap-2 items-center sticky top-[68px] bg-base-200/80 backdrop-blur py-2 z-10">
      <span class="text-sm font-semibold mr-2">Genres:</span>
      <button 
        class="btn btn-xs"
        :class="{ 'btn-active btn-primary': selectedGenre === null }" 
        @click="selectedGenre = null"
      >
        All Genres
      </button>
      <div v-if="pendingGenres" class="text-sm">Loading genres...</div>
      <div v-else-if="genresError" class="text-error text-sm">Error loading genres</div>
      <button 
        v-else 
        v-for="genre in genres" 
        :key="genre"
        class="btn btn-xs"
        :class="{ 'btn-active btn-primary': selectedGenre === genre }" 
        @click="selectedGenre = genre"
      >
        {{ genre }}
      </button>
    </div>

    <!-- Album Grid -->
    <div v-if="pendingAlbums" class="text-center py-10">
       <span class="loading loading-spinner loading-lg"></span>
    </div>
     <div v-else-if="albumsError" class="alert alert-error">
        <Icon name="mdi:alert-circle-outline" class="w-6 h-6" />
        <span>Error loading albums: {{ albumsError.message }}</span>
     </div>
     <div v-else-if="albums && albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
        <div v-for="album in albums" :key="album.id" class="card card-compact bg-base-100 shadow-md hover:shadow-xl transition-shadow duration-300 group">
           <figure class="relative">
             <img :src="getCoverArtUrl(album.artPath)" @error="setDefaultCover" alt="Album Art" class="aspect-square object-cover w-full" />
              <!-- Play button overlay -->
              <button 
                class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
                @click.stop="playAlbum(album.id)" 
                title="Play Album"
              >
                 <Icon name="material-symbols:play-arrow-rounded" class="w-12 h-12 text-white" />
              </button>
           </figure>
           <div class="card-body p-3">
             <NuxtLink :to="`/albums/${album.id}`" class="card-title text-sm truncate link link-hover" :title="album.title">
                {{ album.title }}
             </NuxtLink>
             <NuxtLink :to="`/artists/${album.artistId}`" class="text-xs text-base-content/70 truncate link link-hover" :title="album.artistName">
                {{ album.artistName }}
             </NuxtLink>
           </div>
        </div>
     </div>
     <div v-else class="text-center text-gray-500 py-10">
        No albums found in the library. Add media folders in Settings.
     </div>
  </div>

   <!-- Global Audio Player Placeholder - To be implemented in layout -->
   <!-- <AudioPlayer /> -->
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { usePlayerStore } from '~/stores/player'; // Import the player store

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define interfaces
interface Album {
  id: number;
  title: string;
  artPath: string | null;
  artistId: number | null;
  artistName: string; // Assume artist name is always joined
}

// Define Track type for player store queue
interface TrackForQueue {
  id: number;
  title: string;
  artistName?: string; // Match player store needs
}

const playerStore = usePlayerStore(); // Get player store instance

// Search State
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimer: NodeJS.Timeout | null = null;

// Genre Filter State
const selectedGenre = ref<string | null>(null);

// Fetch Genres
const { data: genres, pending: pendingGenres, error: genresError } = useFetch<string[]>('/api/genres', {
  lazy: true,
  server: false
});

watch(searchQuery, (newValue) => {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debouncedSearchQuery.value = newValue.trim();
  }, 300); // 300ms debounce
});

// Computed API URL based on search and genre query
const apiUrl = computed(() => {
  const params = new URLSearchParams();
  if (debouncedSearchQuery.value) {
    params.set('title', debouncedSearchQuery.value);
  }
  if (selectedGenre.value) {
    params.set('genre', selectedGenre.value);
  }
  const queryString = params.toString();
  return `/api/albums${queryString ? '?' + queryString : ''}`;
});

// Fetch Albums - Now using the computed apiUrl
const { 
  data: albums, 
  pending: pendingAlbums, 
  error: albumsError, 
  refresh: refreshAlbums // Get refresh function
} = useFetch<Album[]>(apiUrl, { // Use computed apiUrl
  lazy: true,
  server: false, // Fetch on client-side only
  watch: [debouncedSearchQuery, selectedGenre] // Re-fetch when debounced query or selectedGenre changes
});

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

// Fallback for image loading errors
function setDefaultCover(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = '/images/icons/placeholder-music.svg'; // Default on error
}

// --- Play Album Functionality ---
async function playAlbum(albumId: number) {
  console.log(`Playing album ID: ${albumId}`);
  try {
    // Fetch all tracks for the given album
    // Ensure the API returns data matching TrackForQueue structure or adapt mapping
    const tracksToQueue = await $fetch<TrackForQueue[]>(`/api/tracks?albumId=${albumId}`);
    
    if (tracksToQueue && tracksToQueue.length > 0) {
      // Map fetched data if needed, though $fetch might return the correct fields
      // Example explicit mapping:
      // const queueData = tracksToQueue.map(t => ({
      //   id: t.id,
      //   title: t.title,
      //   artistName: t.artistName
      // }));
      playerStore.loadQueue(tracksToQueue); // Load the fetched tracks into the store
    } else {
      console.warn(`No tracks found for album ID: ${albumId}`);
      // Optional: Show a notification to the user
    }
  } catch (error) {
    console.error(`Error fetching tracks for album ${albumId}:`, error);
    // Optional: Show an error notification to the user
  }
}

// Define page meta if needed
// definePageMeta({ middleware: 'auth' }); // Uncomment if auth middleware is ready

</script>

<style scoped>
/* Add scrollbar styling if needed */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--b3)) transparent; /* Adjust colors as needed */
}
/* For Webkit browsers */
.scrollbar-thin::-webkit-scrollbar {
  width: 8px;
  height: 8px; /* For horizontal scroll */
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: oklch(var(--b3)); /* Adjust color */
  border-radius: 4px;
  border: 2px solid transparent; /* Creates padding around thumb */
  background-clip: content-box;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: oklch(var(--b1)); /* Adjust hover color */
}
</style>
