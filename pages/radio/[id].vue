<template>
  <div class="radio-page radio-detail">
    <NuxtLink to="/radio" class="radio-back">← Radio</NuxtLink>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading station…"
      variant="detail"
    />
    <div v-else-if="error" role="alert" class="radio-status">
      <p>Could not load this station.</p>
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <template v-else-if="station">
      <div class="radio-desk">
        <div class="radio-desk-main">
          <header class="radio-identity">
            <img
              class="radio-station-art"
              :src="station.logoImagePath || '/images/lyra-radio/mark.webp'"
              alt=""
              width="256"
              height="256"
              @error="fallbackStationArt"
            />
            <div class="radio-identity-copy">
              <h1>{{ station.name }}</h1>
              <p class="radio-lead">A fresh mix from your own collection.</p>
              <p>Start with these artists and genres, then follow the music.</p>
              <div class="radio-actions">
                <button
                  class="btn btn-primary"
                  :disabled="loadingTracks"
                  :aria-busy="loadingTracks"
                  @click="togglePlay"
                >
                  <Icon
                    :name="
                      isPlaying
                        ? 'material-symbols:pause-rounded'
                        : 'material-symbols:play-arrow-rounded'
                    "
                    aria-hidden="true"
                  />{{ isPlaying ? "Pause station" : "Play station" }}
                </button>
                <button
                  class="btn btn-outline"
                  :disabled="
                    !isCurrentStation ||
                    player.currentQueueIndex >= player.queue.length - 1
                  "
                  @click="player.playNext()"
                >
                  <Icon
                    name="material-symbols:skip-next-rounded"
                    aria-hidden="true"
                  />Next track
                </button>
                <NuxtLink
                  v-if="isOwner"
                  :to="`/settings/radio/${id}`"
                  class="radio-edit-link"
                  >Edit station</NuxtLink
                >
              </div>
              <p v-if="loadingTracks" role="status" class="radio-loading">
                Loading station tracks…
              </p>
            </div>
          </header>
          <section
            v-if="isCurrentStation && player.currentTrack"
            class="radio-now-playing"
            aria-labelledby="station-playing"
          >
            <h2 id="station-playing">Now playing</h2>
            <p class="radio-current-title">{{ player.currentTrack.title }}</p>
            <p>
              {{ player.currentTrack.artistName
              }}<span v-if="player.currentTrack.albumTitle">
                · {{ player.currentTrack.albumTitle }}</span
              >
            </p>
          </section>
        </div>
        <RadioArtwork
          class="radio-desk-art"
          name="night-transmission"
          :active="isPlaying && !player.isLoading"
          sizes="(max-width: 1050px) calc(100vw - 48px), max(27vw, 45rem)"
          priority
        />
      </div>
      <p v-if="playError" role="alert" class="radio-status">{{ playError }}</p>
      <div class="radio-seed-columns">
        <section>
          <h2>Seed artists</h2>
          <p>Artists that shape this station’s mix.</p>
          <div v-if="station.radioChannelArtists.length" class="radio-seeds">
            <NuxtLink
              v-for="seed in station.radioChannelArtists"
              :key="seed.artist.artistId"
              :to="`/artists/${seed.artist.artistId}`"
              >{{ seed.artist.name }}<span aria-hidden="true">→</span></NuxtLink
            >
          </div>
          <p v-else>No artist seeds selected.</p>
        </section>
        <section>
          <h2>Seed genres</h2>
          <p>Genres that guide the queue.</p>
          <div v-if="station.radioChannelGenres.length" class="radio-seeds">
            <NuxtLink
              v-for="seed in station.radioChannelGenres"
              :key="seed.genre.genreId"
              :to="`/genres/${seed.genre.genreId}`"
              >{{ seed.genre.name }}<span aria-hidden="true">→</span></NuxtLink
            >
          </div>
          <p v-else>No genre seeds selected.</p>
        </section>
      </div>
      <img
        v-if="station.backgroundImagePath"
        :src="station.backgroundImagePath"
        alt=""
        class="radio-uploaded-background"
      />
    </template>
  </div>
</template>
<script setup lang="ts">
import type { RadioStation } from "~/types/radio";
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { useRadioPlayback } from "~/composables/useRadioPlayback";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute(),
  player = usePlayerStore();
const id = computed(() => String(route.params.id));
const {
  data: station,
  pending,
  error,
  refresh,
} = useLazyFetch<RadioStation>(() => `/api/radio-stations/${id.value}`);
const { data: user } = useLazyFetch<{ userId: string }>("/api/auth/me", {
  method: "POST",
});
useSeoMeta({ title: () => usePageTitle(station.value?.name || "Radio") });
const isOwner = computed(
  () => !!user.value?.userId && user.value.userId === station.value?.userId,
);
const isCurrentStation = computed(
  () =>
    player.currentQueueContext.type === "radio" &&
    player.currentQueueContext.id === `radio-${id.value}`,
);
const isPlaying = computed(() => isCurrentStation.value && player.isPlaying);
const { busyId, playError, playStation, cancel } = useRadioPlayback(
  (url, options) => $fetch<Track[]>(url, options),
  (tracks, context) => player.loadQueue(tracks, context),
);
const loadingTracks = computed(() => busyId.value === id.value);
watch(id, cancel, { flush: "sync" });
async function togglePlay() {
  if (isCurrentStation.value && player.currentTrack) {
    player.togglePlayPause();
    return;
  }
  if (loadingTracks.value) return;
  if (!station.value || station.value.channelId !== id.value) return;
  await playStation(station.value);
}
function fallbackStationArt(event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.src.endsWith("/images/lyra-radio/mark.webp"))
    image.src = "/images/lyra-radio/mark.webp";
}
</script>
<style src="~/assets/radio-pages.css"></style>
