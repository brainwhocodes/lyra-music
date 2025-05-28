
<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track'; // Assuming Track type exists and has necessary fields

const route = useRoute();
const playerStore = usePlayerStore();
const artistId = computed(() => route.params.id as string);

// Define the structure for albums within the artist details
interface ArtistAlbum {
  id: string;
  title: string;
  year: number | null;
  cover_path: string | null;
  artist_id: string; // Included for consistency, though might not be strictly needed here
}

// Define the structure expected from the API endpoint /api/artists/[id].get.ts
interface ArtistDetails {
  id: string;
  name: string;
  artistImage: string | null;
  albums: ArtistAlbum[];
}

const { data: artist, pending, error } = await useLazyFetch<ArtistDetails>(`/api/artists/${artistId.value}`, {
  server: false,
});

const getCoverUrl = (coverPath: string | null | undefined): string => {
  return coverPath ? `/api/covers${coverPath}` : '/images/icons/default-album-art.webp';
};

// Function to get artist image URL with fallback
const getArtistImageUrl = (imagePath: string | null): string => {
  const defaultImage = '/images/icons/default-artist-art.webp';
  if (!imagePath) return defaultImage;
  
  // Check if the path is already a full URL
  if (imagePath.startsWith('http')) return imagePath;
  
  // Check if the path is a relative path to the API
  if (imagePath.startsWith('/')) {
    return `/api/covers${imagePath}`;
  }
  
  // Otherwise, assume it's a relative path to the images directory
  return `/images/covers/${imagePath}`;
};

// Function to play a specific album by this artist
// Fetches album details (which includes tracks) and loads the queue
const playAlbum = async (albumId: string): Promise<void> => {
  try {
    // Fetch the full album details, which should include tracks
    const albumDetails = await $fetch(`/api/albums/${albumId}`); // Assumes this endpoint returns tracks
    if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
      // Ensure the tracks have the necessary info for the player store
      const tracksForPlayer: Track[] = albumDetails.tracks.map((t: any) => ({
         trackId: t.trackId, // API now returns trackId directly
         trackNumber: t.trackNumber,
         title: t.title,
         artistName: t.artistName ?? artist.value?.name ?? 'Unknown Artist', 
         albumTitle: t.albumTitle ?? albumDetails.title ?? 'Unknown Album', 
         filePath: t.filePath, // API now returns filePath directly
         duration: t.duration,
         coverPath: albumDetails.coverPath, // Album cover for all tracks in this context
         albumId: albumDetails.albumId, 
         artistId: t.artistId, // Use track's specific artistId from API
         genre: t.genre, // Added from API
         year: t.year, // Added from API (trackSpecificYear, aliased to year)
         diskNumber: t.diskNumber, // Added from API
         createdAt: t.createdAt, // Added from API
         updatedAt: t.updatedAt, // Added from API
         explicit: t.explicit ?? null, // Add explicit field, defaulting to null if not present
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
      <div class="flex flex-col md:flex-row gap-6 items-center mb-6">
        <!-- Artist Image -->
        <div class="w-48 h-48 rounded-full overflow-hidden bg-base-200 flex-shrink-0">
          <img 
            v-if="artist.artistImage" 
            :src="getArtistImageUrl(artist.artistImage)" 
            :alt="artist.name" 
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center">
            <Icon name="material-symbols:person" class="w-24 h-24 text-base-content/30" />
          </div>
        </div>
        
        <!-- Artist Info -->
        <div>
          <h1 class="text-4xl font-bold">{{ artist.name }}</h1>
          <p v-if="artist.albums" class="text-base-content/70 mt-2">
            {{ artist.albums.length }} {{ artist.albums.length === 1 ? 'album' : 'albums' }}
          </p>
        </div>
      </div>

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