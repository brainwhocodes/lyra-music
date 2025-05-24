
<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/stores/player'; // Assuming Track type exists and has necessary fields

const route = useRoute();
const playerStore = usePlayerStore();
const artistId = computed(() => parseInt(route.params.id as string));

// Define the structure for albums within the artist details
interface ArtistAlbum {
  id: number;
  title: string;
  year: number | null;
  cover_path: string | null;
  artist_id: number; // Included for consistency, though might not be strictly needed here
}

// Define the structure expected from the API endpoint /api/artists/[id].get.ts
interface ArtistDetails {
  id: number;
  name: string;
  albums: ArtistAlbum[];
}

const { data: artist, pending, error } = await useAsyncData<ArtistDetails>(
  `artist-${artistId.value}`,
  () => $fetch(`/api/artists/${artistId.value}`),
  { watch: [artistId] } // Refetch if the artist ID changes
);

const getCoverUrl = (coverPath: string | null | undefined): string => {
  return coverPath ? `/api/covers${coverPath}` : '/images/covers/default-album-art.webp';
};

// Function to play a specific album by this artist
// Fetches album details (which includes tracks) and loads the queue
const playAlbum = async (albumId: number): Promise<void> => {
  try {
    // Fetch the full album details, which should include tracks
    const albumDetails = await $fetch(`/api/albums/${albumId}`); // Assumes this endpoint returns tracks
    if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
      // Ensure the tracks have the necessary info for the player store
      const tracksForPlayer: Track[] = albumDetails.tracks.map((t: any) => ({
         id: t.id,
         title: t.title,
         artistName: t.artist_name ?? artist.value?.name ?? 'Unknown Artist', // Prioritize track artist, fallback to album artist
         albumTitle: t.album_title ?? albumDetails.title ?? 'Unknown Album', // Prioritize track album, fallback to fetched album
         filePath: t.file_path,
         duration: t.duration,
         coverPath: albumDetails.cover_path, // Add album cover to track
         albumId: albumDetails.id, // Add albumId to track
         artistId: albumDetails.artist_id, // Add artistId to track
      }));
      playerStore.loadQueue(tracksForPlayer);
    } else {
      console.warn(`No tracks found for album ${albumId} or album details missing tracks.`);
      // Optionally show a user notification
    }
  } catch (err) {
    console.error(`Error fetching or playing album ${albumId}:`, err);
    // Optionally show a user notification
  }
};

// Set page title
useHead(() => ({
  title: artist.value ? artist.value.name : 'Artist Details'
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
        <span>Error loading artist details: {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="artist">
      <h1 class="text-4xl font-bold mb-6">{{ artist.name }}</h1>

      <h2 class="text-2xl font-semibold mb-4">Albums</h2>
      <div v-if="artist.albums && artist.albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
        <div
          v-for="album in artist.albums"
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
              <button @click.stop="playAlbum(album.id)" title="Play Album" class="btn btn-primary btn-circle btn-lg">
                <Icon name="material-symbols:play-arrow-rounded" class="w-8 h-8" />
              </button>
            </div>
          </figure>
          <div class="card-body p-3">
            <NuxtLink :to="`/albums/${album.id}`" class="hover:text-primary transition-colors duration-200" title="View Album">
              <h2 class="card-title text-sm truncate" :title="album.title">{{ album.title }}</h2>
            </NuxtLink>
            <p v-if="album.year" class="text-xs text-neutral-content">{{ album.year }}</p>
          </div>
        </div>
      </div>
      <div v-else>
        <p class="text-neutral-content italic">No albums found for this artist.</p>
      </div>

    </div>
     <div v-else>
       <p class="text-center text-neutral-content italic">Artist not found.</p>
     </div>
  </div>
</template>