<template>
  <div class="w-full h-[calc(100vh+5rem)] p-4 bg-base-200 overflow-y-auto">
    <div class="flex justify-between items-center mb-2 sticky top-0 bg-base-200/80 backdrop-blur py-2 z-10">
      <div class="form-control">
        <input type="text" placeholder="Search Discovery Playlists..." class="input input-bordered w-72 md:w-96" v-model="searchQuery" />
      </div>
    </div>

    <div v-if="pending" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>

    <div v-else-if="error" class="alert alert-error mt-4">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Failed to load playlists. Please try again later.</span>
    </div>

    <div v-else-if="!playlists || playlists.length === 0" class="flex flex-col items-center justify-center py-16 text-center">
      <Icon name="material-symbols:lightbulb-outline" class="w-20 h-20 text-primary mb-4" />
      <h3 class="text-xl font-bold mb-2">No Discovery Playlists Yet</h3>
      <p class="text-base-content/70 mb-6 max-w-md">Generate discovery playlists to find new music.</p>
    </div>

    <div v-else class="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 mt-4">
      <div v-for="playlist in filteredPlaylists" :key="playlist.discoveryPlaylistId" class="card bg-base-100 shadow-xl hover:shadow-2xl transition-all duration-300 cursor-pointer group" @click="navigateToPlaylist(playlist.discoveryPlaylistId)">
        <figure class="relative pt-[100%] bg-base-300 overflow-hidden">
          <div class="absolute inset-0 flex items-center justify-center">
            <div class="grid grid-cols-2 w-full h-full">
              <div class="bg-base-200 aspect-square"></div>
              <div class="bg-base-300 aspect-square"></div>
              <div class="bg-base-200 aspect-square"></div>
              <div class="bg-base-300 aspect-square"></div>
            </div>
          </div>
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-all duration-300 flex items-center justify-center opacity-0 group-hover:opacity-100">
            <button class="btn btn-circle btn-primary" @click.stop="playPlaylist(playlist.discoveryPlaylistId)">
              <Icon name="material-symbols:play-arrow" class="w-8 h-8" />
            </button>
          </div>
        </figure>

        <div class="card-body p-4">
          <h2 class="card-title text-base truncate">{{ playlist.title }}</h2>
          <p class="text-sm text-base-content/70">{{ formatTrackCount(playlist.trackCount) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { DiscoveryPlaylist } from '~/types/discovery-playlist';
import { usePageTitle } from '~/composables/page-defaults';

useSeoMeta({
  title: usePageTitle('Discover')
});

const searchQuery = ref('');
const { data: playlists, pending, error, refresh } = useLazyFetch<DiscoveryPlaylist[]>('/api/discovery-playlists');

const playerStore = usePlayerStore();

const filteredPlaylists = computed(() => {
  if (!playlists.value) return [];
  if (!searchQuery.value.trim()) return playlists.value;
  const query = searchQuery.value.toLowerCase();
  return playlists.value.filter(p => p.title.toLowerCase().includes(query));
});

const navigateToPlaylist = (id: string) => {
  navigateTo(`/discovery/${id}`);
};

const playPlaylist = async (id: string) => {
  try {
    const playlistWithTracks = await $fetch<any>(`/api/discovery-playlists/${id}`);
    if (!playlistWithTracks.tracks || playlistWithTracks.tracks.length === 0) return;
    playerStore.loadQueue(playlistWithTracks.tracks);
    playerStore.playFromQueue(0);
  } catch (err) {
    console.error('Error playing discovery playlist:', err);
  }
};

const formatTrackCount = (count: number): string => {
  return count === 1 ? '1 track' : `${count} tracks`;
};

onMounted(() => {
  refresh();
});

definePageMeta({
  layout: 'sidebar-layout'
});
</script>
