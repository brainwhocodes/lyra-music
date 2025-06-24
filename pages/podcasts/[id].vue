<template>
  <div class="w-full h-full overflow-y-auto bg-base-200">
    <!-- Loading State -->
    <div v-if="pending" class="flex justify-center items-center py-12">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    
    <!-- Error State -->
    <div v-else-if="error" class="alert alert-error m-4">
      <Icon name="ph:warning" class="w-6 h-6" />
      <span>Failed to load podcast. Please try again later.</span>
      <NuxtLink to="/podcasts" class="btn btn-sm">Back to Podcasts</NuxtLink>
    </div>
    
    <!-- Podcast Detail -->
    <template v-else-if="podcast">
      <!-- Header with Cover Image -->
      <div 
        class="relative w-full h-64 md:h-80 bg-cover bg-center"
        :style="{ backgroundImage: podcast.imageUrl ? `url(${podcast.imageUrl})` : 'none' }"
      >
        <div class="absolute inset-0 bg-gradient-to-b from-black/60 to-black/90"></div>
        
        <!-- Back Button -->
        <NuxtLink to="/podcasts" class="absolute top-4 left-4 z-10 btn btn-ghost text-white">
          <Icon name="ph:arrow-left" class="w-5 h-5 mr-1" /> Back
        </NuxtLink>
        
        <!-- Unsubscribe Button -->
        <button 
          @click="confirmUnsubscribe = true" 
          class="absolute top-4 right-4 z-10 btn btn-sm btn-ghost text-white"
        >
          <Icon name="ph:trash" class="w-4 h-4 mr-1" /> Unsubscribe
        </button>
        
        <!-- Podcast Info -->
        <div class="absolute bottom-0 left-0 w-full p-6 flex items-end gap-4 z-10">
          <div class="w-24 h-24 md:w-32 md:h-32 rounded-lg overflow-hidden shadow-lg flex-shrink-0">
            <img 
              v-if="podcast.imageUrl" 
              :src="podcast.imageUrl" 
              :alt="podcast.title" 
              class="w-full h-full object-cover"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-primary/30">
              <Icon name="ph:podcast-logo" class="w-12 h-12 text-white/70" />
            </div>
          </div>
          
          <div class="flex-grow">
            <h1 class="text-2xl md:text-3xl font-bold text-white line-clamp-2">{{ podcast.title }}</h1>
            <div class="flex items-center text-white/70 mt-1">
              <Icon name="ph:user" class="w-4 h-4 mr-1" />
              <span>{{ podcast.author || 'Unknown author' }}</span>
            </div>
          </div>
          
          <!-- Play All Button -->
          <button 
            v-if="episodes && episodes.length > 0"
            @click="playLatestEpisode" 
            class="btn btn-primary btn-circle btn-lg"
          >
            <Icon name="ph:play-fill" class="w-6 h-6" />
          </button>
        </div>
      </div>
      
      <!-- Content Area -->
      <div class="p-4 md:p-6">
        <!-- Description -->
        <div class="mb-8">
          <h2 class="text-xl font-semibold mb-2">About this podcast</h2>
          <p class="text-base-content/80 whitespace-pre-line">{{ podcast.description || 'No description available' }}</p>
        </div>
        
        <!-- Episodes -->
        <div>
          <div class="flex justify-between items-center mb-4">
            <h2 class="text-xl font-semibold">Episodes</h2>
            <button @click="refreshEpisodes" class="btn btn-ghost btn-sm" :disabled="refreshingEpisodes">
              <Icon name="ph:arrows-clockwise" class="w-4 h-4 mr-1" :class="{ 'animate-spin': refreshingEpisodes }" />
              Refresh
            </button>
          </div>
          
          <!-- Episodes Loading -->
          <div v-if="episodesPending" class="flex justify-center items-center py-8">
            <span class="loading loading-spinner loading-md"></span>
          </div>
          
          <!-- Episodes Error -->
          <div v-else-if="episodesError" class="alert alert-warning">
            <Icon name="ph:warning" class="w-5 h-5" />
            <span>Failed to load episodes. Please try refreshing.</span>
          </div>
          
          <!-- No Episodes -->
          <div v-else-if="!episodes || episodes.length === 0" class="py-8 text-center">
            <Icon name="ph:broadcast" class="w-12 h-12 text-base-content/20 mx-auto mb-2" />
            <p class="text-base-content/60">No episodes available</p>
          </div>
          
          <!-- Episodes List -->
          <div v-else class="space-y-2">
            <div 
              v-for="episode in episodes" 
              :key="episode.episodeId"
              class="card bg-base-100 shadow hover:shadow-md transition-shadow"
            >
              <div class="card-body p-4">
                <div class="flex gap-3">
                  <!-- Episode Image -->
                  <div class="w-16 h-16 rounded overflow-hidden bg-base-300 flex-shrink-0">
                    <img 
                      v-if="episode.imageUrl || podcast.imageUrl" 
                      :src="episode.imageUrl || podcast.imageUrl" 
                      :alt="episode.title" 
                      class="w-full h-full object-cover"
                    />
                    <div v-else class="w-full h-full flex items-center justify-center">
                      <Icon name="ph:broadcast" class="w-8 h-8 text-base-content/30" />
                    </div>
                  </div>
                  
                  <!-- Episode Info -->
                  <div class="flex-grow min-w-0">
                    <h3 class="font-medium line-clamp-1">{{ episode.title }}</h3>
                    <p class="text-sm text-base-content/70 line-clamp-2">{{ episode.description || 'No description available' }}</p>
                    <div class="flex items-center gap-3 mt-1 text-xs text-base-content/50">
                      <span v-if="episode.pubDate">{{ formatDate(episode.pubDate) }}</span>
                      <span v-if="episode.duration">{{ formatDuration(episode.duration) }}</span>
                    </div>
                  </div>
                  
                  <!-- Play Button -->
                  <button @click="playEpisode(episode)" class="btn btn-circle btn-sm self-center flex-shrink-0">
                    <Icon name="ph:play-fill" class="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
  
  <!-- Unsubscribe Confirmation Modal -->
  <div class="modal" :class="{ 'modal-open': confirmUnsubscribe }">
    <div class="modal-box">
      <h3 class="font-bold text-lg">Unsubscribe from podcast?</h3>
      <p class="py-4">Are you sure you want to unsubscribe from "{{ podcast?.title }}"? This will remove the podcast and all its episodes from your library.</p>
      <div class="modal-action">
        <button @click="confirmUnsubscribe = false" class="btn">Cancel</button>
        <button 
          @click="unsubscribe" 
          class="btn btn-error" 
          :disabled="unsubscribing"
        >
          <span v-if="unsubscribing" class="loading loading-spinner loading-sm mr-1"></span>
          Unsubscribe
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Podcast, PodcastEpisode } from '~/types/podcast';
import { usePlayerStore } from '~/stores/player';

definePageMeta({ layout: 'sidebar-layout' });

const route = useRoute();
const router = useRouter();
const playerStore = usePlayerStore();
const podcastId = route.params.id as string;

/**
 * Fetch podcast details
 */
const { 
  data: podcast, 
  pending, 
  error 
} = await useLazyFetch<Podcast>(`/api/podcasts/${podcastId}`);

/**
 * Fetch podcast episodes
 */
const { 
  data: episodes, 
  pending: episodesPending, 
  error: episodesError,
  refresh: refreshEpisodes 
} = await useLazyFetch<PodcastEpisode[]>(`/api/podcasts/${podcastId}/episodes`);

/**
 * State for unsubscribe functionality
 */
const confirmUnsubscribe = ref(false);
const unsubscribing = ref(false);
const refreshingEpisodes = ref(false);

/**
 * Format a date string to a readable format
 */
const formatDate = (dateString: string): string => {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  } catch (error) {
    return dateString;
  }
};

/**
 * Format duration in seconds to a readable format
 */
const formatDuration = (duration: number): string => {
  if (!duration) return '';
  
  const hours = Math.floor(duration / 3600);
  const minutes = Math.floor((duration % 3600) / 60);
  const seconds = Math.floor(duration % 60);
  
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Play a specific episode
 */
const playEpisode = (episode: PodcastEpisode): void => {
  if (!podcast.value || !episode.audioUrl) return;
  
  // Use the dedicated podcast episode player method
  playerStore.playPodcastEpisode(
    episode,
    podcast.value.title,
    podcastId
  );
};

/**
 * Play the latest episode
 */
const playLatestEpisode = (): void => {
  if (episodes.value && episodes.value.length > 0) {
    playEpisode(episodes.value[0]);
  }
};

/**
 * Refresh episodes with loading state
 */
const handleRefreshEpisodes = async (): Promise<void> => {
  refreshingEpisodes.value = true;
  try {
    await refreshEpisodes();
  } finally {
    refreshingEpisodes.value = false;
  }
};

/**
 * Unsubscribe from the podcast
 */
const unsubscribe = async (): Promise<void> => {
  if (!podcast.value) return;
  
  unsubscribing.value = true;
  try {
    await $fetch(`/api/podcasts/${podcastId}`, { 
      method: 'DELETE' as any // Type assertion to avoid TypeScript error
    });
    router.push('/podcasts');
  } catch (error) {
    console.error('Failed to unsubscribe from podcast', error);
    // Show error toast or notification here
  } finally {
    unsubscribing.value = false;
    confirmUnsubscribe.value = false;
  }
};
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
