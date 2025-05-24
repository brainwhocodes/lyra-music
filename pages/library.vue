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
                <img alt="User Avatar" src="" />
              </div>
            </div>
            <ul tabindex="0" class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
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
          :key="album_item.albumId" 
          :album="{ 
            albumId: album_item.albumId, 
            title: album_item.title, 
            artistName: album_item.artistName, 
            coverPath: album_item.coverPath,
            year: album_item.year,
            artistId: album_item.artistId,
            tracks: album_item.tracks
          }"
          @card-click="navigateToAlbum(album_item.albumId)"
        >
          <template #image-overlay>
            <button 
              @click.stop="playAlbum(album_item.albumId)" 
              :title="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId ? 'Pause Album' : 'Play Album'" 
              class="album-play-button w-12 h-12 flex items-center justify-center rounded-full hover:brightness-90 focus:outline-none pointer-events-auto" 
              style="background-color: #FF6347; position: absolute; bottom: 0.5rem; right: 0.5rem; z-index: 10;" 
            >
              <Icon name="material-symbols:progress-activity" class="w-8! h-8! animate-spin text-white" v-if="albumIdLoading === album_item.albumId && currentAlbumLoading" />
              <Icon name="material-symbols:play-arrow-rounded" 
                v-else-if="!playerStore.isPlaying || playerStore.currentTrack?.albumId !== album_item.albumId" 
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
import type { Album } from '~/types/album';
// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});


const playerStore = usePlayerStore(); // Get player store instance

// Refs for play button loading state (similar to pages/albums/index.vue)
const currentAlbumLoading = ref<boolean>(false);
const albumIdLoading = ref<string | null>(null);

// Search State
const searchQuery = ref('');
const debouncedSearchQuery = ref('');
let debounceTimer: NodeJS.Timeout | null = null;

// Genre Filter State
const selectedGenre = ref<string | null>(null);

// Fetch Genres
const { data: genres, pending: pendingGenres, error: genresError } = useLazyFetch<string[]>('/api/genres', {
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
const playAlbum = async (albumId: string): Promise<void> => {
  // Case 1: The clicked album is already the current one in the player.
  // This means its tracks are in the queue, and one of them is currentTrack.
  if (playerStore.currentTrack?.albumId === albumId) {
    playerStore.togglePlayPause(); // Just toggle play/pause for the current track.
    return;
  }

  // Case 2: The clicked album's tracks are already loaded in the queue,
  // but it's not the currentTrack's album.
  // We want to play the *first* track of this album from the existing queue.
  if (playerStore.queue.length > 0 && playerStore.queue[0].albumId === albumId) {
    // If the currentTrack is null or from a different album, but the queue is for this album,
    // play the first track from the queue.
    if (!playerStore.currentTrack || playerStore.currentTrack.albumId !== albumId) {
        playerStore.playFromQueue(0); 
    } else {
        // This case implies currentTrack.albumId IS albumId, which should be caught by Case 1.
        // However, as a fallback or if logic gets more complex, explicitly toggle.
        playerStore.togglePlayPause();
    }
    return;
  }

  // Case 3: The album is not loaded in the player (neither currentTrack nor queue matches).
  // Proceed to fetch, load queue, and play.
  albumIdLoading.value = albumId;
  currentAlbumLoading.value = true;

  // Add a 2-second delay before fetching
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Find the album from the main list (used for quick display, not for player data if fetching)
  const albumListItem = albums.value?.find(album => album.albumId === albumId);
  if (!albumListItem) {
    console.error(`Album with ID ${albumId} not found in the current list.`);
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
    return;
  }

  try {
    // Fetch full album details including tracks directly from the album API endpoint
    const albumDetails = await $fetch<any>(`/api/albums/${albumId}`);

    if (!albumDetails || !albumDetails.tracks || albumDetails.tracks.length === 0) {
      console.warn(`No tracks found for album ${albumId}`);
      playerStore.loadQueue([]); // Clear queue or handle as appropriate
      albumIdLoading.value = null;
      currentAlbumLoading.value = false;
      return;
    }

    // Map the tracks from the album details to the format expected by the player
    const tracksForQueue: Track[] = albumDetails.tracks.map((track: any) => ({
      trackId: track.trackId,
      title: track.title ?? 'Unknown Track',
      artistName: track.artistName ?? albumDetails.artistName ?? 'Unknown Artist',
      albumTitle: track.albumTitle ?? albumDetails.title ?? 'Unknown Album',
      filePath: track.filePath,
      duration: track.duration ?? 0,
      albumId: albumDetails.albumId,
      trackNumber: track.trackNumber ?? null,
      artistId: track.artistId ?? albumDetails.artistId ?? '',
      coverPath: albumDetails.coverPath,
    }));

    // New album data fetched, load it into the queue and play the first track.
    playerStore.loadQueue(tracksForQueue);
    playerStore.playFromQueue(0);

  } catch (err) {
    console.error(`Error fetching or playing album ${albumId}:`, err);
    // Optionally, show a user-facing error notification
  } finally {
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
  }
};

// --- Navigate to Album Detail Page ---
const navigateToAlbum = (albumId: string): void => {
  navigateTo(`/albums/${albumId}`);
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
