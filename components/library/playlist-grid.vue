<template>
  <div>
    <div v-if="pending" class="text-center py-10">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error">
      <Icon name="mdi:alert-circle-outline" class="w-6 h-6" />
      <span>Error loading playlists: {{ error.message }}</span>
    </div>
    <div v-else-if="playlists && playlists.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 md:gap-6">
      <PlaylistCard 
        v-for="playlist in playlists"
        :key="playlist.playlistId"
        :playlist="playlist"
        @click="navigateToPlaylist"
        @play="playPlaylist"
      />
    </div>
    <div v-else class="text-center text-gray-500 py-10">
      No playlists found. You can create new ones here.
    </div>
  </div>
</template>

<script setup lang="ts">
import PlaylistCard from '~/components/playlist/playlist-card.vue';
import { usePlaylists } from '~/composables/usePlaylists';
import { usePlayerStore } from '~/stores/player';
import type { Playlist } from '~/types/playlist';

const { playlists, pending, error, fetchPlaylists } = usePlaylists();
const playerStore = usePlayerStore();

fetchPlaylists();

const navigateToPlaylist = (playlistId: string) => {
  navigateTo(`/playlists/${playlistId}`);
};

const playPlaylist = async (playlistId: string) => {
  try {
    const playlistWithTracks = await $fetch<any>(`/api/playlists/${playlistId}`);
    if (!playlistWithTracks.tracks || playlistWithTracks.tracks.length === 0) {
      console.warn('No tracks in this playlist');
      return;
    }
    playerStore.loadQueue(playlistWithTracks.tracks);
    playerStore.playFromQueue(0);
  } catch (err) {
    console.error('Error playing playlist:', err);
  }
};
</script>
