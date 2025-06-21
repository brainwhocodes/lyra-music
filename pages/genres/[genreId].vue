<script setup lang="ts">
import { ref, useSeoMeta } from '#imports';
import { useRoute, useRouter } from 'vue-router';
import type { Album } from '~/types/album'; 
import type { Track, TrackArtistDetail } from '~/types/track'; 
import { usePlayerStore, type QueueContext } from '~/stores/player'; 
import AlbumCard from '~/components/album/album-card.vue'; 
import { useCoverArt } from '~/composables/use-cover-art';
import { useTrackArtists } from '~/composables/useTrackArtists';

interface GenreBasicInfo {
  genreId: string;
  name: string;
  albumCount?: number;
  description?: string;
}

const route = useRoute();
const router = useRouter(); 
const playerStore = usePlayerStore(); 
const genreId = route.params.genreId as string;
const genreName = ref<string | null>(null);
const loadingAlbumIdForPlay = ref<string | null>(null);



const { getCoverArtUrl } = useCoverArt();

const { data: albums, pending, error } = await useLazyFetch<Album[]>(`/api/genres/${genreId}/albums`, {
  transform: (fetchedAlbums: Album[]) => {
    return fetchedAlbums.map(album => ({
      ...album,
      coverPath: album.coverPath // The API already applies getCoverArtUrl
    }));
  }
});

const { data: allGenres } = await useLazyFetch<GenreBasicInfo[]>(`/api/genres`); 

if (allGenres.value && genreId) {
    const genre = allGenres.value.find((g: GenreBasicInfo) => g.genreId === genreId);
    if (genre) {
      useSeoMeta({
        title: `${genre.name} | Albums - Otogami Music`
      });
    }
  }
watch(allGenres.value, (newGenres: GenreBasicInfo[] | null) => {
  if (newGenres) {
    genreName.value = newGenres.find((g: GenreBasicInfo) => g.genreId === genreId)?.name;
    useSeoMeta({
      title: `${genreName.value} | Albums - Otogami Music`
    });
    allGenres.value = newGenres;
  }
});

if (allGenres.value) {
  genreName.value = allGenres.value.find((g: GenreBasicInfo) => g.genreId === genreId)?.name;
  useSeoMeta({
    title: usePageTitle(`${genreName.value} | Albums`)
  });
}



watch(albums.value, (newAlbums: Album[] | null) => {
  if (newAlbums) {
    pending.value = false;
    useSeoMeta({
      title: `${allGenres.value?.find((g: GenreBasicInfo) => g.genreId === genreId)?.name} | Albums - Otogami Music`
    });
    albums.value = newAlbums;
  }
});

// Computed property to check if the player's current album context matches the given album ID
const isAlbumContextLoaded = (albumId: string): boolean => {
  return playerStore.queueContext?.type === 'album' && playerStore.queueContext?.id === albumId;
};

// This is defined later in the file

// Navigation handler to go to album detail page
const navigateToAlbumDetail = (albumId: string): void => {
  router.push(`/albums/${albumId}`);
};

// Function to get the genre name for display
const getGenreName = (g: GenreBasicInfo | null): string => {
  if (!g) return 'Unknown Genre';
  return g.name || 'Unknown Genre';
};

// Function to get the genre description for display
const getGenreDescription = (g: GenreBasicInfo | null): string => {
  if (!g) return '';
  return g.description || `Browse albums in the ${g.name} genre`;
};

// Play album function
const playAlbum = async (albumIdToPlay: string): Promise<void> => {
  if (!albumIdToPlay) {
    return;
  }

  // Check if the context of the clicked album is already loaded in the player
  if (isAlbumContextLoaded(albumIdToPlay)) {
    playerStore.togglePlayPause();
    return; 
  }
  
  // If context is not for this album, or no album context, then load this album.
  loadingAlbumIdForPlay.value = albumIdToPlay;
  try {
    const albumDetails = await $fetch<Album>(`/api/albums/${albumIdToPlay}`); 
    
    if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
      const { getFormattedTrackArtists } = useTrackArtists();
      const currentAlbumId = albumDetails.albumId;
      
      // Process tracks with proper artist handling
      const tracksToPlay = albumDetails.tracks.map((t: any): Track => {
        // Get primary artist name from track artists if available
        const primaryArtistName = t.artists && t.artists.length > 0
          ? t.artists.find((a: TrackArtistDetail) => a.isPrimaryArtist)?.name || t.artists[0].name
          : 'Unknown Artist';
          
        return {
          ...t, 
          albumId: currentAlbumId,
          artistName: primaryArtistName,
          albumTitle: albumDetails.title || 'Unknown Album',
          coverPath: t.coverPath || albumDetails.coverPath,
          formattedArtists: getFormattedTrackArtists(t.artists || []),
        };
      });

      const context: QueueContext = { type: 'album', id: albumDetails.albumId, name: albumDetails.title };
      playerStore.loadQueue(tracksToPlay, context, true, 0);
    }
  } catch (err) {
    console.error(`Error playing album ${albumIdToPlay}:`, err);
  } finally {
    loadingAlbumIdForPlay.value = null;
  }
};

// Handler for the play button click on an album card
const handlePlayAlbumEvent = (album: Album): void => {
  if (album && album.albumId) {
    playAlbum(album.albumId);
  }
};

definePageMeta({
  layout: 'sidebar-layout',
  middleware: 'session'
});

</script>

<template>
  <div class="w-full h-full px-4 py-8 overflow-y-auto bg-base-200">
    <div class="mb-6">
      <NuxtLink to="/genres" class="btn btn-ghost btn-sm mb-4">&larr; Back to Genres</NuxtLink>
      <h1 class="text-3xl font-bold">{{ genreName || 'Genre' }} Albums</h1>
    </div>

    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="text-center text-error">
      <p>Error loading albums for this genre: {{ error.message }}</p>
    </div>
    <div v-else-if="!albums || albums.length === 0" class="text-center">
      <p>No albums found for this genre.</p>
    </div>
    <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
      <AlbumCard 
        v-for="albumItem in albums" 
        :key="albumItem.albumId" 
        :album="albumItem"
        :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === albumItem.albumId"
        :is-loading-this-album="loadingAlbumIdForPlay === albumItem.albumId"
        @cardClick="navigateToAlbumDetail(albumItem.albumId)" 
        @play="handlePlayAlbumEvent(albumItem)" 
      />
    </div>
  </div>
</template>
