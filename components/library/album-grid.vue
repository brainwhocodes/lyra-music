<template>
  <UiLoadingSkeleton v-if="pending" label="Loading albums…" />
  <p v-else-if="error" role="alert">Could not load albums. Please try again.</p>
  <div v-else-if="albums.length" class="collection-grid">
    <AlbumCard
      v-for="album in albums"
      :key="album.albumId"
      :album="album"
      :is-playing-this-album="
        player.isPlaying && player.currentTrack?.albumId === album.albumId
      "
      :is-loading-this-album="
        albumIdLoading === album.albumId && currentAlbumLoading
      "
      :available-actions="['add', 'edit']"
      @play="$emit('play', album)"
      @add-to-playlist="$emit('add-to-playlist', album)"
      @edit-album="$emit('edit-album', album)"
    />
  </div>
  <p v-else>
    No albums in your library yet.
    <NuxtLink to="/settings">Add a music folder</NuxtLink> to get started.
  </p>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import AlbumCard from "~/components/album/album-card.vue";
import type { Album } from "~/types/album";
withDefaults(
  defineProps<{
    albums: Album[];
    pending?: boolean;
    error?: Error | null;
    albumIdLoading?: string | null;
    currentAlbumLoading?: boolean;
  }>(),
  {
    pending: false,
    error: null,
    albumIdLoading: null,
    currentAlbumLoading: false,
  },
);
defineEmits<{
  (e: "play" | "add-to-playlist" | "edit-album", album: Album): void;
}>();
const player = usePlayerStore();
</script>
