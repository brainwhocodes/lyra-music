<template>
  <div>
    <div v-if="pending" class="text-center py-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error">
      <Icon name="mdi:alert-circle-outline" class="w-6 h-6" />
      <span>Error loading albums: {{ error.message }}</span>
    </div>
    <div v-else-if="albums && albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      <AlbumCard
        v-for="album_item in albums"
        :key="album_item.albumId"
        :album="album_item"
        :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === album_item.albumId"
        :is-loading-this-album="albumIdLoading === album_item.albumId && currentAlbumLoading"
        @card-click="navigateToAlbum(album_item.albumId)"
        @add-to-playlist="openAddToPlaylistModal(album_item)"
        @edit-album="handleEditAlbum(album_item)"
        @play="handleAlbumPlayEvent(album_item)"
      />
    </div>
    <div v-else class="text-center text-gray-500 py-10">
      No albums found in the library. Add media folders in Settings.
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Album } from '~/types/album';
import AlbumCard from '~/components/album/album-card.vue';

const playerStore = usePlayerStore();

defineProps<{
  albums: Album[];
  pending: boolean;
  error: Error | null;
  albumIdLoading: string | null;
  currentAlbumLoading: boolean;
}>();

const emit = defineEmits<{
  (e: 'play', album: Album): void;
  (e: 'add-to-playlist', album: Album): void;
  (e: 'edit-album', album: Album): void;
  (e: 'navigate-to-album', albumId: string): void;
}>();

const handleAlbumPlayEvent = (album: Album) => emit('play', album);
const openAddToPlaylistModal = (album: Album) => emit('add-to-playlist', album);
const handleEditAlbum = (album: Album) => emit('edit-album', album);
const navigateToAlbum = (albumId: string) => emit('navigate-to-album', albumId);
</script>
