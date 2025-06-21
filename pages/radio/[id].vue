<template>
  <div v-if="station" class="p-4 sm:p-6 lg:p-8">
    <NuxtLink to="/radio" class="btn btn-ghost btn-lg w-80">
      <Icon name="ph:arrow-left" class="w-8 h-8" /> Back to Radio Stations
    </NuxtLink>
    <div class="max-w-4xl mx-auto">
      <!-- Header -->
      <div class="mb-8 text-center">
        <h1 class="text-4xl font-bold tracking-tight sm:text-5xl">{{ station.name }}</h1>
        <p class="mt-2 text-lg text-base-content/70">AI-powered radio station</p>
      </div>

      <!-- Seed Info -->
      <div class="mb-8 p-4 border rounded-box">
        <h2 class="text-lg font-semibold mb-2">Station Seeds:</h2>
        <div class="flex flex-wrap gap-2">
          <div v-for="artist in station.radioChannelArtists" :key="artist.artistId" class="badge badge-primary badge-lg">
            <Icon name="ph:microphone-stage-duotone" class="mr-1" />
            {{ artist.artist.name }}
          </div>
          <div v-for="genre in station.radioChannelGenres" :key="genre.genreId" class="badge badge-secondary badge-lg">
             <Icon name="ph:music-notes-duotone" class="mr-1" />
            {{ genre.genre.name }}
          </div>
        </div>
      </div>

      <!-- Controls -->
      <div class="flex justify-center items-center gap-4 mb-8">
        <button @click="togglePlay" class="btn btn-primary btn-circle btn-lg">
          <Icon :name="isPlaying ? 'ph:pause-fill' : 'ph:play-fill'" class="w-8 h-8" />
        </button>
        <button @click="playNextTrack" class="btn btn-ghost btn-circle btn-lg">
          <Icon name="ph:skip-forward-fill" class="w-7 h-7" />
        </button>
      </div>

      <!-- Now Playing -->
      <div v-if="currentTrack" class="text-center h-20">
        <p class="font-semibold text-lg">{{ currentTrack.title }}</p>
        <p class="text-base-content/70">{{ currentTrack.artistName }} - {{ currentTrack.albumTitle }}</p>
      </div>
       <div v-else class="text-center h-20">
        <p class="text-base-content/70">Press play to start the music.</p>
      </div>

    </div>
  </div>
  <div v-else-if="pending" class="flex items-center justify-center min-h-screen">
    <span class="loading loading-spinner loading-lg"></span>
  </div>
  <div v-else-if="error" class="flex items-center justify-center min-h-screen">
    <p class="text-error">Could not load radio station.</p>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import type { Artist } from '~/server/db/schema/artists';
import type { Genre } from '~/server/db/schema/genres';
import type { Track } from '~/types/track';

// Define a more detailed type for the station data returned by the API
interface StationDetail extends RadioChannel {
  radioChannelArtists: { artist: Artist }[];
  radioChannelGenres: { genre: Genre }[];
}

const route = useRoute();
const playerStore = usePlayerStore();
const channelId = route.params.id as string;

// Fetch station details and tracklist in parallel
const { data: station, pending, error } = await useLazyFetch<StationDetail>(`/api/radio-stations/${channelId}`);
const { data: tracks, refresh: refreshTracks } = await useLazyFetch<Track[]>(`/api/radio-stations/${channelId}/tracks`);

watch(station.value, (newStation: StationDetail | null) => {
  if (newStation) {
    pending.value = false;
    useSeoMeta({
      title: usePageTitle(newStation.name)
    });
    station.value = newStation;
  }
});

if (station.value) {
  useSeoMeta({
    title: usePageTitle(station.value.name)
  });
  station.value = station.value;
}

watch(tracks.value, (newTracks: Track[] | null) => {
  if (newTracks) {
    pending.value = false;
    tracks.value = newTracks;
  }
});

if (tracks.value) {
  useSeoMeta({
    title: usePageTitle(tracks.value)
  });
  tracks.value = tracks.value;
}

const currentTrack = computed(() => playerStore.currentTrack);
const isPlaying = computed(() => playerStore.isPlaying);

function togglePlay() {
  // If the context is not this station, or no track is loaded, start a new playback session.
  if (playerStore.currentQueueContext.id !== `radio-${channelId}` || !currentTrack.value) {
    startPlayback();
  } else {
    // Otherwise, just toggle play/pause.
    playerStore.togglePlayPause();
  }
}

function playNextTrack() {
  // If this station is playing, just go to the next track
  if (playerStore.currentQueueContext.id === `radio-${channelId}` && tracks.value && tracks.value.length > 0) {
    playerStore.playNext();
  } else {
    // If another station is playing or nothing is, just refresh tracks without auto-starting
    refreshTracks();
    // Don't automatically start playback - user must click play
  }
}

function startPlayback(autoPlay: boolean = true) {
  if (tracks.value && tracks.value.length > 0) {
    playerStore.loadQueue(tracks.value, {
      type: 'radio',
      id: `radio-${channelId}`,
      name: station.value?.name || 'Radio',
    }, autoPlay); // Pass autoPlay parameter to control whether playback starts automatically
  }
}

// Only update the queue if this is not the current playing station
// This prevents resetting playback when navigating back to this page
watch(tracks, (newTracks: Track[] | null) => {
  // Only update the queue if:
  // 1. We have tracks AND
  // 2. Either this is not the current context OR the queue is empty
  if (newTracks && newTracks.length > 0 && 
      (playerStore.currentQueueContext.id !== `radio-${channelId}` || playerStore.queue.length === 0)) {
    // Update queue without starting playback
    startPlayback(false);
  }
});

onUnmounted(() => {
  // Optional: Decide if you want to stop playback when leaving the page.
  // playerStore.stop();
});

useHead({
  title: station.value ? `${station.value.name} - Radio` : 'Radio',
});
</script>
