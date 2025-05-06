<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/stores/player';

const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => parseInt(route.params.id as string));


// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

// Define the expected structure from the API endpoint
interface AlbumDetails {
  id: number;
  title: string;
  year: number | null;
  cover_path: string | null;
  artist_id: number;
  artist_name: string;
  tracks: Track[];
}


const { data: album, pending, error } = await useFetch<AlbumDetails>(`/api/albums/${albumId.value}`);

console.log(album.value);
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


const playAlbum = (): void => {
  if (album.value?.tracks) {
    playerStore.loadQueue(album.value.tracks);
  }
};

const playTrack = (track: Track): void => {
  if (album.value?.tracks) {
    // If the track clicked is part of the currently loaded album, 
    // check if the queue is already this album to avoid reloading
    // (This logic could be refined based on desired behavior)
    const isCurrentAlbumQueue = playerStore.queue.length === album.value.tracks.length && 
                              playerStore.queue[0]?.album_id === albumId.value; // Need album_id on track type

    if (!isCurrentAlbumQueue) {
      playerStore.loadQueue(album.value.tracks);
    }
    // Find index and play
    const index = album.value.tracks.findIndex(t => t.id === track.id);
    if (index !== -1) {
      playerStore.playFromQueue(index);
    }
  }
};

// Format duration helper
const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

// Set page title
useHead(() => ({
  title: album.value ? `${album.value.title} by ${album.value.artist_name}` : 'Album Details'
}));

</script>

<template>
  <div class="container mx-auto px-4 py-8 space-y-8">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg">
      <div>
        <Icon name="material-symbols:error-outline-rounded" class="w-6 h-6"/>
        <span>Error loading album details: {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="album">
      <div class="flex flex-col md:flex-row gap-8 items-start">
        <!-- Album Cover & Play Button -->
        <div class="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 relative group">
          <img 
            :src="getCoverArtUrl(album.cover_path)" 
            alt="Album Cover" 
            class="w-full h-full object-cover rounded-lg shadow-lg"
          />
          <button 
              class="absolute inset-0 flex items-center justify-center bg-black bg-opacity-50 rounded-lg opacity-0 hover:opacity-100 transition-opacity duration-300"
              @click="playAlbum"
              title="Play Album"
            >
              <Icon name="material-symbols:play-arrow-rounded" class="w-20 h-20 text-white" />
            </button>
        </div>
        
        <!-- Album Info -->
        <div class="flex-grow text-center md:text-left">
          <h1 class="text-4xl font-bold mb-2">{{ album.title }}</h1>
          <NuxtLink 
            :to="`/artists/${album.artist_id}`" 
            class="text-2xl text-neutral-content hover:text-primary transition-colors"
            title="View Artist"
          >
             {{ album.artist_name }}
          </NuxtLink>
          <p v-if="album.year" class="text-lg text-gray-500 mt-1">{{ album.year }}</p>
          <p class="text-sm text-gray-400 mt-2">{{ album.tracks.length }} track{{ album.tracks.length !== 1 ? 's' : '' }}</p>
          <button class="btn btn-primary mt-4" @click="playAlbum">
            <Icon name="material-symbols:play-arrow-rounded" class="w-5 h-5 mr-1" />
            Play Album
          </button>
        </div>
      </div>

      <!-- Track List -->
      <div>
        <h2 class="text-2xl font-semibold mb-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full">
            <tbody>
              <tr 
                v-for="track in album.tracks" 
                :key="track.id" 
                class="hover group"
                :class="{'text-primary font-semibold bg-base-200': playerStore.currentTrack?.id === track.id}"
              >
                <!-- Play/Pause Button Column -->
                <td class="w-12">
                  <button 
                    @click="playTrack(track)" 
                    class="btn btn-ghost btn-sm btn-circle opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
                    :class="{'opacity-100': playerStore.currentTrack?.id === track.id}" 
                    :title="playerStore.currentTrack?.id === track.id && playerStore.isPlaying ? 'Pause' : 'Play'"
                  >
                    <Icon 
                      v-if="playerStore.currentTrack?.id === track.id && playerStore.isPlaying" 
                      name="material-symbols:pause-rounded" 
                      class="w-5 h-5"
                    />
                    <Icon 
                      v-else 
                      name="material-symbols:play-arrow-rounded" 
                      class="w-5 h-5"
                    />
                  </button>
                </td>
                <!-- Track Number Column -->
                <td class="w-12 text-right text-neutral-content text-sm">
                  <span v-if="playerStore.currentTrack?.id !== track.id">{{ track.track_number }}</span>
                  <!-- Show speaker icon if it's the current track -->
                  <Icon v-else name="material-symbols:volume-up" class="w-5 h-5 text-primary"/>
                </td>
                <!-- Track Title Column -->
                <td>{{ track.title }}</td>
                <!-- Track Duration Column -->
                <td class="text-right text-neutral-content text-sm">
                  {{ formatDuration(track.duration) }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
        <!-- Message if no tracks -->
        <div v-if="!album.tracks || album.tracks.length === 0" class="mt-4">
           <p class="text-neutral-content italic">No tracks found for this album.</p>
        </div>
      </div>
    </div>
  </div>
</template>
