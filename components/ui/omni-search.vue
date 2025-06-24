<template>
  <div class="relative w-full max-w-md" ref="searchContainer">
    <div class="form-control">
      <div class="relative">
        <input 
          type="text" 
          placeholder="Search for artists, albums, playlists..." 
          class="input input-bordered w-full pr-10" 
          v-model="searchQuery"
          @focus="isFocused = true"
        />
        <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
          <Icon name="material-symbols:search" class="w-5 h-5 text-gray-400" />
        </div>
      </div>
    </div>

    <div v-if="isFocused && (isLoading || (results && (results.albums.length > 0 || results.artists.length > 0 || results.playlists.length > 0)))" class="absolute z-10 w-full mt-1 bg-base-200 rounded-box shadow-lg">
      <ul class="menu p-2">
        <li v-if="isLoading" class="menu-title"><span>Loading...</span></li>
        
        <!-- Albums -->
        <li v-if="results?.albums?.length > 0" class="menu-title"><span>Albums</span></li>
        <li v-for="album in results.albums" :key="album.albumId">
          <NuxtLink :to="`/albums/${album.albumId}`" @click="reset">{{ album.title }}</NuxtLink>
        </li>

        <!-- Artists -->
        <li v-if="results?.artists?.length > 0" class="menu-title"><span>Artists</span></li>
        <li v-for="artist in results.artists" :key="artist.artistId">
          <NuxtLink :to="`/artists/${artist.artistId}`" @click="reset">{{ artist.name }}</NuxtLink>
        </li>

        <!-- Playlists -->
        <li v-if="results?.playlists?.length > 0" class="menu-title"><span>Playlists</span></li>
        <li v-for="playlist in results.playlists" :key="playlist.playlistId">
          <NuxtLink :to="`/playlists/${playlist.playlistId}`" @click="reset">{{ playlist.name }}</NuxtLink>
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, computed } from '#imports';
import type { SearchResults } from '~/types/search';

const props = defineProps<{ modelValue: string }>();
const emit = defineEmits(['update:modelValue']);

const { showNotification } = useNotification();

const searchQuery = computed({
  get: () => props.modelValue,
  set: (value: string) => emit('update:modelValue', value),
});

const results = ref<SearchResults | null>(null);
const isLoading = ref(false);
const isFocused = ref(false);
const searchContainer = ref<HTMLDivElement | null>(null);

let debounceTimer: NodeJS.Timeout;

watch(searchQuery, (newQuery: string) => {
  clearTimeout(debounceTimer);
  if (newQuery.trim().length > 1) {
    isLoading.value = true;
    debounceTimer = setTimeout(async () => {
      try {
        const response = await $fetch<SearchResults>('/api/search', { params: { q: newQuery } });
        results.value = response;
      } catch (error) {
        showNotification('Error fetching search results', 'error');
        results.value = null;
      } finally {
        isLoading.value = false;
      }
    }, 300);
  } else {
    results.value = null;
  }
});

const reset = () => {
  searchQuery.value = '';
  results.value = null;
  isFocused.value = false;
};

const handleClickOutside = (event: MouseEvent) => {
  if (searchContainer.value && !searchContainer.value.contains(event.target as Node)) {
    isFocused.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>
