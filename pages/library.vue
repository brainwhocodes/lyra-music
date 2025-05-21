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
     <div v-else-if="albums && albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
        <AlbumCard 
          v-for="album_item in albums" 
          :key="album_item.id" 
          :album="{ 
            id: album_item.id, 
            title: album_item.title, 
            artistName: album_item.artistName, 
            coverArtUrl: album_item.coverPath 
          }"
          @card-click="navigateToAlbum(album_item.id)"
        >
          <template #image-overlay>
            <button 
              @click.stop="playAlbum(album_item.id)" 
              :title="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.id ? 'Pause Album' : 'Play Album'" 
              class="album-play-button w-12 h-12 flex items-center justify-center rounded-full hover:brightness-90 focus:outline-none pointer-events-auto" 
              style="background-color: #FF6347; position: absolute; bottom: 0.5rem; right: 0.5rem; z-index: 10;" 
            >
              <Icon name="material-symbols:progress-activity" class="w-8! h-8! animate-spin text-white" v-if="albumIdLoading === album_item.id && currentAlbumLoading" />
              <Icon name="material-symbols:play-arrow-rounded" 
                v-else-if="!playerStore.isPlaying || playerStore.currentTrack?.albumId !== album_item.id" 
                class="w-8! h-8! text-white" />
              <Icon name="material-symbols:pause-rounded" v-else class="w-8! h-8! text-white" />
            </button>
          </template>
          <template #artist>
            <p class="text-xs truncate" :title="album_item.artistName || 'Unknown Artist'">{{ album_item.artistName || 'Unknown Artist' }}</p>
          </template>
          <template #actions>
            <p class="text-xs text-gray-500 w-full text-left">{{ album_item.year || '' }}</p>
          </template>
        </AlbumCard>
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
import { usePlayerStore, type Track } from '~/stores/player'; // Import Track type
import AlbumCard from '~/components/album/album-card.vue'; // Import AlbumCard
import { useRouter } from 'vue-router'; // Import useRouter

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define interfaces
interface Album {
  id: number;
  title: string;
  coverPath: string | null;
  artistId: number | null;
  artistName: string; // Assume artist name is always joined
  year: number | null; // Added for consistency
}

const playerStore = usePlayerStore(); // Get player store instance

// Refs for play button loading state (similar to pages/albums/index.vue)
const currentAlbumLoading = ref<boolean>(false);
const albumIdLoading = ref<number | null>(null);

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

const router = useRouter(); // Initialize router

// --- Play Album Functionality ---
const playAlbum = async (albumId: number): Promise<void> => {
  albumIdLoading.value = albumId;
  currentAlbumLoading.value = true;

  // Find the album from the current list to get its details, including coverPath
  const selectedAlbum = albums.value?.find(album => album.id === albumId);

  if (!selectedAlbum) {
    console.error(`Album with ID ${albumId} not found in the current list.`);
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
    return;
  }

  try {
    // Fetch tracks for the selected album
    // Note: The /api/tracks endpoint might return a simpler track structure
    const rawTracks = await $fetch<any[]>(`/api/tracks?albumId=${albumId}`);

    if (!rawTracks || rawTracks.length === 0) {
      console.warn(`No tracks found for album ${albumId}`);
      playerStore.loadQueue([]); // Clear queue or handle as appropriate
      albumIdLoading.value = null;
      currentAlbumLoading.value = false;
      return;
    }

    // Augment tracks with album details like artistName, albumTitle, and coverPath
    const tracksForQueue: Track[] = rawTracks.map(track => ({
      id: track.id,
      title: track.title ?? 'Unknown Track',
      artistName: selectedAlbum.artistName ?? 'Unknown Artist',
      albumTitle: selectedAlbum.title ?? 'Unknown Album',
      filePath: track.filePath, // Assuming filePath is directly on the raw track object
      duration: track.duration ?? 0,
      albumId: selectedAlbum.id,
      trackNumber: track.trackNumber ?? null,
      artistId: selectedAlbum.artistId ?? null,
      coverPath: selectedAlbum.coverPath, // Add the coverPath from the album
    }));

    // If the current playing track is from the same album, just toggle play/pause
    // Otherwise, load the new queue and play from the beginning.
    const trackToPlay = tracksForQueue[0];
    if (playerStore.currentTrack?.albumId === selectedAlbum.id && playerStore.currentTrack?.id === trackToPlay.id) {
      playerStore.togglePlayPause();
    } else {
      playerStore.loadQueue(tracksForQueue);
      playerStore.playFromQueue(0); // Play the first track
    }
  } catch (err) {
    console.error(`Error fetching or playing album ${albumId}:`, err);
    // Optionally, show a user-facing error notification
  } finally {
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
  }
};

// --- Navigate to Album Detail Page ---
const navigateToAlbum = (albumId: number): void => {
  router.push(`/albums/${albumId}`);
};

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
