<template>
  <div>
    <template v-if="station">
      <!-- Main container with background -->
      <div 
        class="relative min-h-screen flex flex-col items-center justify-center p-4 text-white overflow-hidden"
        :style="{ 
          backgroundImage: station.backgroundImagePath ? `url(${station.backgroundImagePath})` : 'none',
          backgroundColor: !station.backgroundImagePath ? 'var(--b1)' : 'transparent'
        }"
        style="background-size: cover; background-position: center; background-attachment: fixed;"
      >
        <!-- Dark overlay for readability -->
        <div class="absolute inset-0 bg-black/60 z-0"></div>

        <!-- Back button in the corner -->
        <NuxtLink to="/radio" class="absolute top-4 left-4 z-20 btn btn-ghost">
          <Icon name="ph:arrow-left" class="w-6 h-6" /> Back
        </NuxtLink>

        <!-- Edit button in the corner -->
        <NuxtLink v-if="isStationOwner" :to="`/settings/radio/${channelId}`" class="absolute top-4 right-4 z-20 btn btn-sm btn-outline">
          <Icon name="ph:pencil-simple" class="mr-1" /> Edit Station
        </NuxtLink>

        <!-- Centered content container -->
        <div class="relative z-10 flex flex-col items-center text-center max-w-2xl w-full">
          <!-- Logo -->
          <div v-if="station.logoImagePath" class="w-48 h-48 rounded-full overflow-hidden mb-6 border-4 border-primary shadow-2xl">
            <img :src="station.logoImagePath" :alt="`${station.name} Logo`" class="w-full h-full object-cover" />
          </div>
          <div v-else class="w-48 h-48 rounded-full bg-base-300/50 flex items-center justify-center mb-6 border-4 border-primary shadow-2xl">
            <Icon name="ph:radio-solid" class="w-24 h-24 text-white/70" />
          </div>

          <!-- Station Info -->
          <h1 class="text-5xl font-bold tracking-tight sm:text-6xl drop-shadow-lg">{{ station.name }}</h1>
          <p class="mt-3 text-xl text-white/80 drop-shadow-md">AI-powered radio station</p>

          <!-- Controls -->
          <div class="flex justify-center items-center gap-6 my-8">
            <button @click="togglePlay" class="btn btn-primary btn-circle btn-lg w-24 h-24" :disabled="tracksPending">
              <Icon :name="isPlaying ? 'ph:pause-fill' : 'ph:play-fill'" class="w-12 h-12" />
            </button>
            <button @click="playNextTrack" class="btn btn-ghost btn-circle btn-lg transition-transform hover:scale-110">
              <Icon name="ph:skip-forward-fill" class="w-8 h-8" />
            </button>
          </div>

          <!-- Now Playing -->
          <div class="h-24">
            <div v-if="currentTrack" class="text-center">
              <p class="font-semibold text-2xl drop-shadow-md">{{ currentTrack.title }}</p>
              <p class="text-white/80 text-lg drop-shadow-sm">{{ currentTrack.artistName }} - {{ currentTrack.albumTitle }}</p>
            </div>
            <div v-else class="text-center">
              <p class="text-white/80 text-lg">Press play to start the music.</p>
            </div>
          </div>

          <!-- Seed Info -->
          <div class="mt-8 p-4 bg-black/30 rounded-box max-w-full backdrop-blur-sm">
            <h2 class="text-lg font-semibold mb-2">Station Seeds:</h2>
            <div class="flex flex-wrap gap-2 justify-center">
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
        </div>
      </div>
    </template>
    <div v-else-if="pending" class="flex items-center justify-center min-h-screen bg-base-100">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="flex items-center justify-center min-h-screen bg-base-100">
      <p class="text-error">Could not load radio station.</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import type { Artist } from '~/server/db/schema/artists';
import type { Genre } from '~/server/db/schema/genres';
import type { Track } from '~/types/track';
import { resolveFetchPolicyOptions } from '~/composables/use-fetch-policy';

// Define a more detailed type for the station data returned by the API
interface StationDetail extends RadioChannel {
  radioChannelArtists: { artist: Artist }[];
  radioChannelGenres: { genre: Genre }[];
  userId: string;
}

const route = useRoute();
const playerStore = usePlayerStore();
const channelId = route.params.id as string;

// Fetch station details and tracklist in parallel
const { data: station, pending, error } = await useLazyFetch<StationDetail>(`/api/radio-stations/${channelId}`);
const { data: tracks, pending: tracksPending, execute: loadTracks } = await useLazyFetch<Track[]>(`/api/radio-stations/${channelId}/tracks`, {
  ...resolveFetchPolicyOptions('user-triggered'),
  default: () => [],
});

const { data: user, execute: loadUser } = await useLazyFetch<{ userId: string; name: string; email: string }>('/api/auth/me', {
  method: 'POST',
  ...resolveFetchPolicyOptions('lazy-ok'),
});

// Determine if the current user is the station owner
const isStationOwner = computed((): boolean => {
  if (!user.value?.userId || !station.value?.userId) return false;
  return user.value.userId === station.value.userId;
});

// Watch for the station data to become available to set the page title
watch(station, (newStation: StationDetail | null) => {
  if (newStation) {
    const pageTitle = `${newStation.name} - Radio`;
    useHead({
      title: pageTitle,
    });
    useSeoMeta({
      title: pageTitle,
      description: `Listen to ${newStation.name}, an AI-powered radio station.`,
    });
  }
}, { immediate: true });



const currentTrack = computed(() => playerStore.currentTrack);
const isPlaying = computed(() => playerStore.isPlaying);

async function togglePlay() {
  // If the context is not this station, or no track is loaded, start a new playback session.
  if (playerStore.currentQueueContext.id !== `radio-${channelId}` || !currentTrack.value) {
    await startPlayback();
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
    loadTracks();
    // Don't automatically start playback - user must click play
  }
}

async function startPlayback(autoPlay: boolean = true) {
  // If tracks aren't loaded or the list is empty, fetch them.
  // loadTracks will not re-fetch if data is already fresh or a fetch is in flight.
  if (!tracks.value || tracks.value.length === 0) {
    await loadTracks();
  }

  if (tracks.value && tracks.value.length > 0) {
    playerStore.loadQueue(tracks.value, {
      type: 'radio',
      id: `radio-${channelId}`,
      name: station.value?.name || 'Radio',
    }, autoPlay);
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

onMounted(async () => {
  await loadUser();
});

onUnmounted(() => {
  // Optional: Decide if you want to stop playback when leaving the page.
  // playerStore.stop();
});


</script>
