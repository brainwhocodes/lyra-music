<template>
  <div class="w-full h-full p-4 overflow-y-auto bg-base-200">
    <h1 class="text-3xl font-bold mb-6">Podcasts</h1>
    <div class="flex gap-2 mb-4">
      <input v-model="feedUrl" type="text" placeholder="Podcast RSS feed" class="input input-bordered flex-grow" />
      <button class="btn btn-primary" @click="subscribe" :disabled="subscribing">Subscribe</button>
    </div>
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="text-center text-error">
      Failed to load podcasts.
    </div>
    <div v-else-if="podcasts && podcasts.length" class="space-y-2">
      <div v-for="podcast in podcasts" :key="podcast.podcastId" class="p-4 bg-base-100 rounded shadow">
        <h2 class="font-bold">{{ podcast.title }}</h2>
        <p class="text-sm text-base-content/70">{{ podcast.description }}</p>
      </div>
    </div>
    <div v-else class="text-center text-base-content/70">No podcasts subscribed yet.</div>
  </div>
</template>

<script setup lang="ts">
import type { Podcast } from '~/types/podcast';

definePageMeta({ layout: 'sidebar-layout' });

const { data: podcasts, pending, error, refresh } = await useLazyFetch<Podcast[]>('/api/podcasts');

const feedUrl = ref('');
const subscribing = ref(false);

const subscribe = async () => {
  if (!feedUrl.value) return;
  subscribing.value = true;
  try {
    await $fetch('/api/podcasts', { method: 'POST', body: { feedUrl: feedUrl.value } });
    feedUrl.value = '';
    await refresh();
  } catch (err) {
    console.error('Failed to subscribe', err);
  } finally {
    subscribing.value = false;
  }
};
</script>
