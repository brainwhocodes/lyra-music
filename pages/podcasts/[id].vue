<template>
  <div class="utility-page">
    <NuxtLink to="/podcasts" class="utility-back">← Podcasts</NuxtLink>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading podcast…"
      variant="detail"
    />
    <div v-else-if="error" role="alert" class="utility-status">
      Could not load this podcast.
      <button class="btn btn-outline" @click="refreshPodcast()">
        Try again
      </button>
    </div>
    <template v-else-if="podcast">
      <header class="detail-hero">
        <UtilityArt :src="podcast.imageUrl" />
        <div>
          <h1 class="page-heading">{{ podcast.title }}</h1>
          <p class="page-intro">
            {{ podcast.author || "Independent podcast" }}
          </p>
          <p v-if="podcast.description" class="page-intro">
            {{ podcast.description }}
          </p>
          <div class="utility-actions">
            <button
              class="btn btn-primary"
              :disabled="!episodes?.some((e) => e.audioUrl)"
              @click="playLatest"
            >
              Play latest episode</button
            ><button
              class="btn btn-outline"
              :disabled="episodesPending"
              @click="refreshEpisodes()"
            >
              {{ episodesPending ? "Updating…" : "Update feed" }}</button
            ><button class="btn btn-ghost text-error" @click="openUnsubscribe">
              Unsubscribe
            </button>
          </div>
        </div>
      </header>
      <h2 class="mb-4">Episodes</h2>
      <UiLoadingSkeleton
        v-if="episodesPending"
        label="Loading episodes…"
        variant="rows"
        :count="3"
      />
      <div v-else-if="episodesError" role="alert" class="utility-status">
        Could not load episodes. Use Update feed to try again.
      </div>
      <p v-else-if="!episodes?.length" class="utility-empty">
        No episodes are available from this feed.
      </p>
      <div v-else class="utility-list">
        <article
          v-for="episode in episodes"
          :key="episode.episodeId"
          class="utility-row"
        >
          <UtilityArt :src="episode.imageUrl || podcast.imageUrl" />
          <div>
            <h3>{{ episode.title }}</h3>
            <p>
              {{ episode.pubDate ? formatDate(episode.pubDate) : ""
              }}<span v-if="episode.duration">
                · {{ formatTrackDuration(episode.duration) }}</span
              >
            </p>
            <p v-if="episode.description">{{ episode.description }}</p>
          </div>
          <div class="utility-actions">
            <button
              class="btn btn-primary"
              :aria-label="`Play episode ${episode.title}`"
              :disabled="!episode.audioUrl"
              @click="playEpisode(episode)"
            >
              Play episode</button
            ><span v-if="!episode.audioUrl" class="text-sm"
              >Audio unavailable</span
            >
          </div>
        </article>
      </div>
    </template>
    <UtilityDialog
      v-model:open="unsubscribeOpen"
      title="Unsubscribe from podcast?"
      ><p>Remove “{{ podcast?.title }}” from your subscriptions?</p>
      <p v-if="unsubscribeError" role="alert" class="text-error mt-4">
        {{ unsubscribeError }}
      </p>
      <div class="modal-action">
        <button class="btn" autofocus @click="unsubscribeOpen = false">
          Cancel</button
        ><button
          class="btn btn-error"
          :disabled="unsubscribing"
          @click="unsubscribe"
        >
          Unsubscribe
        </button>
      </div></UtilityDialog
    >
  </div>
</template>
<script setup lang="ts">
import type { Podcast, PodcastEpisode } from "~/types/podcast";
import { usePlayerStore } from "~/stores/player";
import { formatTrackDuration } from "~/utils/formatters";
definePageMeta({ layout: "sidebar-layout" });
const route = useRoute(),
  player = usePlayerStore();
const id = computed(() => String(route.params.id));
const {
  data: podcast,
  pending,
  error,
  refresh: refreshPodcast,
} = useLazyFetch<Podcast>(() => `/api/podcasts/${id.value}`);
const {
  data: episodes,
  pending: episodesPending,
  error: episodesError,
  refresh: refreshEpisodes,
} = useLazyFetch<PodcastEpisode[]>(() => `/api/podcasts/${id.value}/episodes`);
useSeoMeta({ title: () => usePageTitle(podcast.value?.title || "Podcast") });
const unsubscribeOpen = ref(false),
  unsubscribing = ref(false),
  unsubscribeError = ref("");
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : new Intl.DateTimeFormat("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      }).format(date);
}
function playEpisode(episode: PodcastEpisode) {
  if (podcast.value && episode.audioUrl)
    player.playPodcastEpisode(episode, podcast.value.title, id.value);
}
function playLatest() {
  const episode = episodes.value?.find((e) => e.audioUrl);
  if (episode) playEpisode(episode);
}
function openUnsubscribe() {
  unsubscribeError.value = "";
  unsubscribeOpen.value = true;
}
async function unsubscribe() {
  if (unsubscribing.value) return;
  unsubscribing.value = true;
  unsubscribeError.value = "";
  try {
    await $fetch(`/api/podcasts/${id.value}`, { method: "DELETE" });
    unsubscribeOpen.value = false;
    await navigateTo("/podcasts");
  } catch {
    unsubscribeError.value = "Could not unsubscribe. Please try again.";
  } finally {
    unsubscribing.value = false;
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
