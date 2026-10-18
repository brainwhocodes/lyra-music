<template>
  <div class="utility-page">
    <header>
      <h1 class="page-heading">Podcasts.</h1>
      <p class="page-intro utility-subtitle">
        Follow a feed and settle into a conversation.
      </p>
    </header>
    <form class="utility-panel" @submit.prevent="subscribe">
      <div class="utility-form-line">
        <label for="podcast-feed"
          >RSS feed URL<input
            id="podcast-feed"
            v-model="feedUrl"
            class="input"
            type="url"
            required
            placeholder="https://example.com/feed.xml"
            :aria-invalid="!!subscribeError" /></label
        ><button
          class="btn btn-primary"
          :disabled="subscribing || !feedUrl.trim()"
        >
          {{ subscribing ? "Subscribing…" : "Subscribe" }}
        </button>
      </div>
      <p v-if="subscribeError" role="alert" class="text-error mt-4">
        {{ subscribeError }}
      </p>
      <p v-if="subscribed" role="status" class="mt-4">
        Podcast added to your subscriptions.
      </p>
    </form>
    <h2 class="mb-4">Your podcasts</h2>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading podcasts…"
      variant="rows"
      :count="3"
    />
    <div v-else-if="error" role="alert" class="utility-status">
      Could not load your subscriptions.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <div v-else-if="!podcasts?.length" class="utility-empty">
      <h2>Your next conversation starts here.</h2>
      <p>Paste an RSS feed URL above to subscribe.</p>
    </div>
    <div v-else class="utility-list">
      <article
        v-for="podcast in podcasts"
        :key="podcast.podcastId"
        class="utility-row"
      >
        <UtilityArt :src="podcast.imageUrl" />
        <div>
          <h2>
            <NuxtLink :to="`/podcasts/${podcast.podcastId}`">{{
              podcast.title
            }}</NuxtLink>
          </h2>
          <p>{{ podcast.author || "Independent podcast" }}</p>
          <p v-if="podcast.description" class="podcast-description">
            {{ podcast.description }}
          </p>
        </div>
        <div class="utility-actions">
          <NuxtLink
            :to="`/podcasts/${podcast.podcastId}`"
            class="btn btn-outline"
            :aria-label="`Open podcast ${podcast.title}`"
            >Open podcast →</NuxtLink
          >
        </div>
      </article>
    </div>
  </div>
</template>
<script setup lang="ts">
import type { Podcast } from "~/types/podcast";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Podcasts") });
const {
  data: podcasts,
  pending,
  error,
  refresh,
} = useLazyFetch<Podcast[]>("/api/podcasts");
const feedUrl = ref(""),
  subscribing = ref(false),
  subscribeError = ref(""),
  subscribed = ref(false);
async function subscribe() {
  if (subscribing.value || !feedUrl.value.trim()) return;
  subscribing.value = true;
  subscribeError.value = "";
  subscribed.value = false;
  try {
    await $fetch("/api/podcasts", {
      method: "POST",
      body: { feedUrl: feedUrl.value.trim() },
    });
    feedUrl.value = "";
    await refresh();
    subscribed.value = true;
  } catch (err: any) {
    subscribeError.value =
      err?.data?.statusMessage ||
      "Could not subscribe to this feed. Check the URL and try again.";
  } finally {
    subscribing.value = false;
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
<style scoped>
.podcast-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
