<template>
  <div class="container mx-auto px-4 py-8 space-y-8 overflow-y-auto">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg flex items-center gap-2">
      <Icon name="material-symbols:error-outline" class="w-6 h-6" />
      <span>Failed to load playlist. Please try again later.</span>
    </div>
    <div v-else-if="playlist">
      <div class="flex flex-col md:flex-row gap-8 items-start">
        <div class="flex-shrink-0 w-48 h-48 md:w-64 md:h-64 relative group bg-base-300 rounded-lg overflow-hidden">
          <div class="grid grid-cols-2 w-full h-full">
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
            <div class="bg-base-200 aspect-square"></div>
            <div class="bg-base-300 aspect-square"></div>
          </div>
        </div>
        <div class="flex-1 flex flex-col justify-between gap-4">
          <div>
            <h1 class="text-3xl font-bold mb-2">{{ playlist.title }}</h1>
            <p class="text-base-content/70">{{ formatTrackCount(playlist.tracks.length) }}</p>
          </div>
          <div class="flex gap-2 mt-4">
            <button class="btn btn-primary gap-2" @click="playPlaylist" :disabled="!playlist.tracks.length">
              <Icon name="material-symbols:play-arrow" class="w-6 h-6" />
              Play
            </button>
          </div>
        </div>
      </div>
      <div v-if="!playlist.tracks.length" class="flex flex-col items-center justify-center py-16 text-center">
        <Icon name="material-symbols:music-note" class="w-16 h-16 text-primary mb-4" />
        <h3 class="text-xl font-bold mb-2">No Tracks Yet</h3>
      </div>
      <div v-else>
        <h2 class="text-2xl font-semibold my-4">Tracks</h2>
        <div class="overflow-x-auto">
          <table class="table w-full">
            <tbody>
              <TrackItem v-for="(pt, index) in playlist.tracks" :key="pt.discoveryPlaylistTrackId" :track="mapPlaylistTrack(pt)" :track-number="index + 1" :playlists="[]" @play-track="playTrackFromList" />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useRoute } from 'vue-router';
import { usePlayerStore } from '~/stores/player';
import TrackItem from '~/components/track/track-item.vue';
import type { DiscoveryPlaylist, DiscoveryPlaylistTrack } from '~/types/discovery-playlist';
import type { Track } from '~/types/track';
import { usePageTitle } from '~/composables/page-defaults';

definePageMeta({ layout: 'sidebar-layout' });

const playerStore = usePlayerStore();
const route = useRoute();
const playlistId = computed((): string => route.params.id as string);

const pending = ref(true);
const error = ref(false);

const { data: playlist, error: playlistError } = await useLazyFetch<DiscoveryPlaylist>(`/api/discovery-playlists/${playlistId.value}`);

if (playlistError.value) {
  error.value = true;
  console.error('Failed to fetch discovery playlist:', playlistError.value);
}

watch(playlist.value, (newPlaylist: DiscoveryPlaylist | null) => {
  if (newPlaylist) {
    pending.value = false;
    useSeoMeta({ title: usePageTitle('Discover | ' + newPlaylist.title) });
  }
});

if (playlist.value) {
  pending.value = false;
  useSeoMeta({ title: usePageTitle('Discover | ' + playlist.value.title) });
}

function formatTrackCount(count: number): string {
  return count === 1 ? '1 track' : `${count} tracks`;
}

function mapPlaylistTrack(pt: DiscoveryPlaylistTrack): Track {
  return pt.track;
}

function playPlaylist(): void {
  if (!playlist.value?.tracks.length) return;
  const tracks = playlist.value.tracks.map(mapPlaylistTrack);
  if (!tracks.length) return;
  playerStore.loadQueue(tracks, { type: 'discovery', id: playlistId.value });
  playerStore.playFromQueue(0);
}

function playTrackFromList(track: Track): void {
  if (!playlist.value?.tracks.length) return;
  const tracks = playlist.value.tracks.map(mapPlaylistTrack);
  const idx = tracks.findIndex(t => t.trackId === track.trackId);
  if (idx !== -1) {
    playerStore.loadQueue(tracks, { type: 'discovery', id: playlistId.value });
    playerStore.playFromQueue(idx);
  }
}
</script>
