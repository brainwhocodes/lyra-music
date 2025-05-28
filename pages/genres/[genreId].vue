<script setup lang="ts">
import { computed, ref, watchEffect } from '#imports';
import { useRoute, useRouter } from 'vue-router';
import type { Album } from '~/types/album'; 
import type { Track } from '~/types/track'; 
import { usePlayerStore, type QueueContext } from '~/stores/player'; 
import AlbumCard from '~/components/album/album-card.vue'; 
import { resolveCoverArtUrl } from '~/utils/formatters'; 

interface GenreBasicInfo {
  genreId: string;
  name: string;
  albumCount?: number; 
}

const route = useRoute();
const router = useRouter(); 
const playerStore = usePlayerStore(); 
const genreId = route.params.genreId as string;

const loadingAlbumIdForPlay = ref<string | null>(null);



const { data: albums, pending, error } = await useLazyFetch<Album[]>(`/api/genres/${genreId}/albums`, {
  server: false,
  transform: (fetchedAlbums: Album[]) => {
    return fetchedAlbums.map(album => ({
      ...album,
      coverPath: resolveCoverArtUrl(album.coverPath)
    }));
  }
});

const { data: allGenres } = await useFetch<GenreBasicInfo[]>(`/api/genres`); 
const currentGenre = computed(() => {
  if (allGenres.value && genreId) {
    return allGenres.value.find((g: GenreBasicInfo) => g.genreId === genreId);
  }
  return null;
});

const genrePageTitle = computed(() => currentGenre.value ? `${currentGenre.value.name} Albums` : 'Genre Albums');
useHead({ title: genrePageTitle });

definePageMeta({
  layout: 'sidebar-layout'
});

const navigateToAlbumDetail = (albumId: string) => {
  router.push(`/albums/${albumId}`);
};

// Helper computed to check if a specific album's context is loaded in the player
const isAlbumContextLoaded = (albumIdToCheck: string): boolean => {
  return playerStore.currentQueueContext.type === 'album' && 
         playerStore.currentQueueContext.id === albumIdToCheck;
};

const playAlbum = async (albumIdToPlay: string): Promise<void> => {
  console.log(`[GenrePage/${genreId}] playAlbum: Attempting to play/pause/load album ID: ${albumIdToPlay}`);
  if (!albumIdToPlay) {
    console.warn(`[GenrePage/${genreId}] playAlbum: albumIdToPlay is null or undefined.`);
    return;
  }

  // Check if the context of the clicked album is already loaded in the player
  if (isAlbumContextLoaded(albumIdToPlay)) {
    console.log(`[GenrePage/${genreId}] playAlbum: Album context for ${albumIdToPlay} is already loaded. Toggling play/pause.`);
    playerStore.togglePlayPause();
    // No need to set loadingAlbumIdForPlay here, as we are not fetching.
    return; 
  }
  
  // If context is not for this album, or no album context, then load this album.
  console.log(`[GenrePage/${genreId}] playAlbum: Album context for ${albumIdToPlay} not loaded. Fetching details.`);
  loadingAlbumIdForPlay.value = albumIdToPlay;
  try {
    const albumDetails = await $fetch<Album>(`/api/albums/${albumIdToPlay}`); 
    console.log(`[GenrePage/${genreId}] playAlbum: API response for ${albumIdToPlay}:`, albumDetails);

    if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
      const currentAlbumId = albumDetails.albumId;
      const tracksToPlay = albumDetails.tracks.map((t: any): Track => ({
        ...t, 
        albumId: currentAlbumId, 
        artistName: t.artistName ?? albumDetails.artistName ?? 'Unknown Artist',
        albumTitle: t.albumTitle ?? albumDetails.title ?? 'Unknown Album',
        coverPath: resolveCoverArtUrl(t.coverPath ?? albumDetails.coverPath), 
      }));

      console.log(`[GenrePage/${genreId}] playAlbum: Tracks prepared for playerStore.loadQueue:`, JSON.stringify(tracksToPlay, null, 2));

      const context: QueueContext = { type: 'album', id: albumDetails.albumId, name: albumDetails.title };
      playerStore.loadQueue(tracksToPlay, context, true, 0);
    } else {
      console.warn(`[GenrePage/${genreId}] playAlbum: No tracks found for album ${albumIdToPlay}`);
    }
  } catch (err) {
    console.error(`[GenrePage/${genreId}] playAlbum: Error playing album ${albumIdToPlay}:`, err);
  } finally {
    loadingAlbumIdForPlay.value = null;
  }
};

const handlePlayAlbumEvent = (album: Album): void => {
  console.log(`[GenrePage/${genreId}] handlePlayAlbumEvent: Received play event for album:`, album);
  if (album && album.albumId) {
    playAlbum(album.albumId);
  } else {
    console.warn(`[GenrePage/${genreId}] handlePlayAlbumEvent: Invalid album data received.`);
  }
};

</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div class="mb-6">
      <NuxtLink to="/genres" class="btn btn-ghost btn-sm mb-4">&larr; Back to Genres</NuxtLink>
      <h1 class="text-3xl font-bold">{{ currentGenre?.name || 'Genre' }} Albums</h1>
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
    <div v-else class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
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
