<template>
  <div class="w-full h-full p-4 overflow-y-auto bg-base-200">
    <div class="flex justify-between items-center mb-6">
      <h1 class="text-3xl font-bold">Podcasts</h1>
      <button @click="showSubscribeModal = true" class="btn btn-primary">
        <Icon name="ph:plus" class="mr-1" /> Subscribe
      </button>
    </div>
    
    <!-- Subscribe Modal -->
    <div class="modal" :class="{ 'modal-open': showSubscribeModal }">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">Subscribe to Podcast</h3>
        <div class="form-control">
          <label class="label">
            <span class="label-text">Podcast RSS Feed URL</span>
          </label>
          <div class="flex gap-2">
            <input 
              v-model="feedUrl" 
              type="text" 
              placeholder="https://example.com/feed.xml" 
              class="input input-bordered flex-grow" 
              :class="{ 'input-error': subscribeError }" 
            />
            <button 
              class="btn btn-primary" 
              @click="subscribe" 
              :disabled="subscribing || !feedUrl"
            >
              <span v-if="subscribing" class="loading loading-spinner loading-sm mr-1"></span>
              Subscribe
            </button>
          </div>
          <label v-if="subscribeError" class="label">
            <span class="label-text-alt text-error">{{ subscribeError }}</span>
          </label>
        </div>
        <div class="modal-action">
          <button @click="showSubscribeModal = false" class="btn">Close</button>
        </div>
      </div>
    </div>
    
    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error">
      <Icon name="ph:warning" class="w-6 h-6" />
      <span>Failed to load podcasts. Please try again later.</span>
    </div>
    
    <!-- Empty State -->
    <div v-else-if="!podcasts || podcasts.length === 0" class="flex flex-col items-center justify-center py-12 text-center">
      <Icon name="ph:podcast-logo" class="w-16 h-16 text-base-content/30 mb-4" />
      <h3 class="text-xl font-bold mb-2">No podcasts yet</h3>
      <p class="text-base-content/70 mb-4">Subscribe to podcasts to start listening</p>
      <button @click="showSubscribeModal = true" class="btn btn-primary btn-sm">
        <Icon name="ph:plus" class="mr-1" /> Add Your First Podcast
      </button>
    </div>
    
    <!-- Podcast Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      <NuxtLink 
        v-for="podcast in podcasts" 
        :key="podcast.podcastId" 
        :to="`/podcasts/${podcast.podcastId}`"
        class="card bg-base-100 shadow-lg hover:shadow-xl transition-shadow overflow-hidden group"
      >
        <figure class="relative aspect-square bg-base-300">
          <img 
            v-if="podcast.imageUrl" 
            :src="podcast.imageUrl" 
            :alt="podcast.title" 
            class="w-full h-full object-cover"
          />
          <div v-else class="w-full h-full flex items-center justify-center bg-primary/10">
            <Icon name="ph:podcast-logo" class="w-16 h-16 text-primary/50" />
          </div>
          <div class="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
            <button class="btn btn-circle btn-primary btn-sm">
              <Icon name="ph:play-fill" class="w-4 h-4" />
            </button>
          </div>
        </figure>
        <div class="card-body p-4">
          <h2 class="card-title text-base line-clamp-1">{{ podcast.title }}</h2>
          <p class="text-sm text-base-content/70 line-clamp-2">{{ podcast.description || 'No description available' }}</p>
          <div class="flex items-center text-xs text-base-content/50 mt-1">
            <Icon name="ph:microphone-stage" class="w-3 h-3 mr-1" />
            <span>{{ podcast.author || 'Unknown author' }}</span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Podcast } from '~/types/podcast';

definePageMeta({ layout: 'sidebar-layout' });

/**
 * Fetch all subscribed podcasts
 */
const { data: podcasts, pending, error, refresh } = await useLazyFetch<Podcast[]>('/api/podcasts');

/**
 * State for podcast subscription
 */
const feedUrl = ref('');
const subscribing = ref(false);
const subscribeError = ref<string | null>(null);
const showSubscribeModal = ref(false);

/**
 * Subscribe to a new podcast via RSS feed
 */
const subscribe = async (): Promise<void> => {
  if (!feedUrl.value) return;
  
  subscribing.value = true;
  subscribeError.value = null;
  
  try {
    await $fetch('/api/podcasts', { 
      method: 'POST', 
      body: { feedUrl: feedUrl.value } 
    });
    
    feedUrl.value = '';
    showSubscribeModal.value = false;
    await refresh();
  } catch (err) {
    console.error('Failed to subscribe', err);
    subscribeError.value = 'Failed to subscribe to this podcast feed. Please check the URL and try again.';
  } finally {
    subscribing.value = false;
  }
};

/**
 * Reset form when modal is closed
 */
watch(showSubscribeModal, (isOpen) => {
  if (!isOpen) {
    feedUrl.value = '';
    subscribeError.value = null;
  }
});
</script>

<style scoped>
.line-clamp-1 {
  display: -webkit-box;
  -webkit-line-clamp: 1;
  line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
