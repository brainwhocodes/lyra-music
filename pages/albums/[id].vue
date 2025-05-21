<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album';

const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => parseInt(route.params.id as string));

// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});



// Fetch album details
const { data: album, pending, error } = await useFetch<Album>(`/api/albums/${albumId.value}`);

// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value?.tracks) return [];
  // Provide a fallback for album.value.artist_name itself, though it's typed as string in AlbumDetails
  const albumArtist = album.value.artistName || 'Unknown Artist'; 
  return album.value.tracks.map(track => ({
    ...track,
    // Prioritize track's own artistName, then album's artist_name, then a final fallback.
    artistName: track.artistName || albumArtist,
  }));
});

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

// --- Check if this album is currently loaded ---
const isCurrentAlbumLoaded = computed(() => {
  return album.value?.id === playerStore.currentTrack?.albumId;
});

// --- Click handler for the main cover button ---
const playAlbum = (): void => {
  const trackIndex = 0;
  if (!album.value?.tracks?.[trackIndex]) return;
  
  const track = album.value.tracks[trackIndex];
  
  // If the clicked track is ALREADY the current track in the player, just toggle play/pause
  if (playerStore.currentTrack?.id === track.id) {
    playerStore.togglePlayPause();
    return;
  }
  
  // If the queue isn't this album (or no track is loaded), load the album queue
  // isCurrentAlbumLoaded checks if the *album* context is the same.
  if (!isCurrentAlbumLoaded.value) {
    playerStore.loadQueue(playerReadyTracks.value);
  }
  
  // Play the selected track (this will set it as current in the store)
  playerStore.playFromQueue(trackIndex);
};

// --- Play a specific track (existing function) ---
const playTrack = (trackIndex: number): void => {
  if (!album.value?.tracks?.[trackIndex]) return;
  
  const track = album.value.tracks[trackIndex];
  
  // If the clicked track is ALREADY the current track in the player, just toggle play/pause
  if (playerStore.currentTrack?.id === track.id) {
    playerStore.togglePlayPause();
    return;
  }
  
  // If the queue isn't this album (or no track is loaded), load the album queue
  // isCurrentAlbumLoaded checks if the *album* context is the same.
  if (!isCurrentAlbumLoaded.value) {
    playerStore.loadQueue(playerReadyTracks.value);
  }
  
  // Play the selected track (this will set it as current in the store)
  playerStore.playFromQueue(trackIndex);
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
  title: album.value ? `${album.value.title} by ${album.value.artistName}` : 'Album Details'
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
            :src="getCoverArtUrl(album?.coverPath)" 
            alt="Album Cover" 
            class="w-full h-full object-cover rounded-lg shadow-lg"
          />
        </div>
        
        <!-- Album Info -->
        <div class="flex-grow text-center md:text-left">
          <h1 class="text-4xl font-bold mb-2">{{ album?.title }}</h1>
          <NuxtLink 
            v-if="album?.artistId"
            :to="`/artists/${album.artistId}`" 
            class="text-2xl text-neutral-content hover:text-primary transition-colors"
            title="View Artist"
          >
              {{ album?.artistName ?? 'Unknown Artist' }}
          </NuxtLink>
          <span v-else class="text-2xl text-neutral-content">
            {{ album?.artistName ?? 'Unknown Artist' }}
          </span>
          <p v-if="album?.year" class="text-lg text-gray-500 mt-1">{{ album.year }}</p>
          <p v-if="album?.tracks" class="text-sm text-gray-400 mt-2">{{ album.tracks.length }} track{{ album.tracks.length !== 1 ? 's' : '' }}</p>
          <!-- This button still just plays the album from the start -->
          <button class="btn btn-primary mt-4" @click="playAlbum">
            <Icon name="material-symbols:play-arrow-rounded" class="w-5 h-5 mr-1" v-if="!playerStore.isPlaying" />
            <Icon name="material-symbols:pause-rounded" class="w-5 h-5 mr-1" v-else />
            {{  playerStore.isPlaying ? 'Pause Album' : 'Play Album' }}
          </button>
        </div>
      </div>

      <!-- Track List -->
      <div>
        <h2 class="text-2xl font-semibold my-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full">
            <tbody>
              <tr 
                v-for="(track, index) in album.tracks" 
                :key="track.id"
                class="hover:bg-base-200 group cursor-pointer"
                :class="{'text-primary font-semibold bg-base-300': playerStore.currentTrack?.id === track.id }"
                @click="playTrack(index)" 
              >
                <td class="w-12 text-center text-sm text-neutral-content">{{ index + 1 }}</td>
                <td class="w-12 text-center">
                    <!-- Show pause icon if this track is playing -->
                    <Icon 
                        v-if="playerStore.currentTrack?.id === track.id && playerStore.isPlaying"
                        name="material-symbols:pause-rounded"
                        class="w-5 h-5 text-primary"
                    />
                    <!-- Show play icon on hover if not playing, or if it's a different track -->
                    <Icon 
                        v-else
                        name="material-symbols:play-arrow-rounded"
                        class="w-5 h-5 text-base-content opacity-0 group-hover:opacity-100"
                        :class="{'opacity-100': playerStore.currentTrack?.id === track.id }" 
                    />
                </td>
                <td>{{ track.title }}</td>
                <td class="text-right text-sm text-neutral-content">{{ formatDuration(track.duration) }}</td>
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
