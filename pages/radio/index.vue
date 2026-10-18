<template>
  <div class="radio-page">
    <header class="radio-poster">
      <div class="radio-poster-copy">
        <h1>Find your frequency.</h1>
        <p class="radio-lead">A mix from your own collection.</p>
      </div>
      <img
        class="radio-poster-art"
        src="/images/lyra-radio/rooftop-dj.webp"
        alt=""
        width="1536"
        height="1024"
      />
    </header>
    <section aria-labelledby="your-stations">
      <div class="radio-toolbar">
        <h2 id="your-stations">Your stations</h2>
        <label
          >Search stations<input
            v-model="query"
            class="input"
            type="search"
            placeholder="Find a station"
        /></label>
        <label
          >Filter by genre<select v-model="genre" class="select">
            <option value="">All genres</option>
            <option v-for="name in genres" :key="name">{{ name }}</option>
          </select></label
        >
        <NuxtLink to="/settings/radio" class="btn btn-outline"
          >Manage stations</NuxtLink
        >
      </div>
      <UiLoadingSkeleton
        v-if="pending"
        label="Loading stations…"
        variant="rows"
        :count="3"
      />
      <div v-else-if="error" role="alert" class="radio-status">
        <p>Could not load radio stations.</p>
        <button class="btn btn-outline" @click="refresh()">Try again</button>
      </div>
      <div v-else-if="!stations?.length" class="radio-empty">
        <h3>A station of your own.</h3>
        <p>Create a station from artists and genres in your library.</p>
        <NuxtLink to="/settings/radio" class="btn btn-primary"
          >Create a station</NuxtLink
        >
      </div>
      <p v-else-if="!filtered.length" role="status" class="radio-empty">
        No stations match these filters.
      </p>
      <div v-else class="radio-station-list">
        <article
          v-for="station in filtered"
          :key="station.channelId"
          class="radio-station-row"
        >
          <img
            class="radio-station-art"
            :src="station.logoImagePath || '/images/lyra-radio/mark.webp'"
            alt=""
            width="256"
            height="256"
            @error="fallbackStationArt"
          />
          <div class="radio-station-copy">
            <h3>
              <NuxtLink :to="`/radio/${station.channelId}`">{{
                station.name
              }}</NuxtLink>
            </h3>
            <p>
              {{
                station.radioChannelGenres
                  .map((s) => s.genre.name)
                  .join(" · ") || "A mix from your library"
              }}
            </p>
            <p v-if="station.radioChannelArtists.length">
              With
              {{
                station.radioChannelArtists.map((s) => s.artist.name).join(", ")
              }}
            </p>
          </div>
          <div class="radio-actions">
            <button
              class="btn btn-primary"
              :disabled="busyId === station.channelId"
              :aria-busy="busyId === station.channelId"
              :aria-label="`${stationAction(station)} ${station.name}`"
              @click="play(station)"
            >
              <Icon
                :name="
                  isCurrent(station) && player.isPlaying
                    ? 'material-symbols:pause-rounded'
                    : 'material-symbols:play-arrow-rounded'
                "
                aria-hidden="true"
              />{{ stationAction(station) }}
            </button>
            <NuxtLink
              :to="`/radio/${station.channelId}`"
              class="btn btn-outline"
              >Open <span aria-hidden="true">↗</span></NuxtLink
            >
          </div>
          <p
            v-if="busyId === station.channelId"
            role="status"
            class="radio-row-status"
          >
            Loading station tracks…
          </p>
        </article>
      </div>
      <p v-if="playError" role="alert" class="radio-status">{{ playError }}</p>
      <p v-if="stations?.length" class="radio-footnote">
        Stations play matching tracks from your library.
      </p>
    </section>
  </div>
</template>
<script setup lang="ts">
import type { RadioStation } from "~/types/radio";
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { useRadioPlayback } from "~/composables/useRadioPlayback";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Radio") });
const {
  data: stations,
  pending,
  error,
  refresh,
} = useLazyFetch<RadioStation[]>("/api/radio-stations");
const query = ref(""),
  genre = ref("");
const player = usePlayerStore();
const { busyId, playError, playStation, cancel } = useRadioPlayback(
  (url, options) => $fetch<Track[]>(url, options),
  (tracks, context) => player.loadQueue(tracks, context),
);
function isCurrent(station: RadioStation) {
  return (
    Boolean(player.currentTrack) &&
    player.currentQueueContext.type === "radio" &&
    player.currentQueueContext.id === `radio-${station.channelId}`
  );
}
function stationAction(station: RadioStation) {
  return isCurrent(station)
    ? player.isPlaying
      ? "Pause station"
      : "Resume station"
    : "Play station";
}
function play(station: RadioStation) {
  if (isCurrent(station)) {
    cancel();
    player.togglePlayPause();
    return;
  }
  return playStation(station);
}
const genres = computed(() =>
  [
    ...new Set(
      (stations.value || []).flatMap((s) =>
        s.radioChannelGenres.map((g) => g.genre.name),
      ),
    ),
  ].sort(),
);
const filtered = computed(() =>
  (stations.value || []).filter(
    (s) =>
      s.name.toLowerCase().includes(query.value.trim().toLowerCase()) &&
      (!genre.value ||
        s.radioChannelGenres.some((g) => g.genre.name === genre.value)),
  ),
);
function fallbackStationArt(event: Event) {
  const image = event.target as HTMLImageElement;
  if (!image.src.endsWith("/images/lyra-radio/mark.webp"))
    image.src = "/images/lyra-radio/mark.webp";
}
</script>
<style src="~/assets/radio-pages.css"></style>
