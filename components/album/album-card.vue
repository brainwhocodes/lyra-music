<template>
  <div 
    class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out group"
    @click="$emit('cardClick', album)"
  >
    <figure class="relative aspect-square overflow-hidden">
      <img 
        :src="album.coverPath" 
        :alt="album.title || 'Album cover'" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
        @error="handleImageError"
      />
      <button 
        @click.stop="$emit('play', album)" 
        :title="buttonTitle"
        class="bg-primary w-12 h-12 absolute flex items-center justify-center rounded-full focus:outline-none shadow-lg hover:bg-primary-focus transition-colors duration-200"
        style="bottom: 0.5rem; right: 0.5rem; z-index: 10;"
      >
        <Icon v-if="isLoadingThisAlbum" name="material-symbols:progress-activity" class="w-7 h-7 animate-spin text-primary-content" />
        <Icon v-else-if="isPlayingThisAlbum" name="material-symbols:pause-rounded" class="w-7 h-7 text-primary-content" />
        <Icon v-else name="material-symbols:play-arrow-rounded" class="w-7 h-7 text-primary-content" />
      </button>
      
      <div class="absolute top-2 right-2 z-20">
        <OptionsMenu>
          <template #default>
            <button
              class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
              @click.stop="$emit('addToPlaylist', album)"
            >
              <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
              Add to Playlist
            </button>
            <button
              class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
              @click.stop="$emit('editAlbum', album)"
            >
              <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
              Edit Album
            </button>
          </template>
        </OptionsMenu>
      </div>
    </figure>
    <div class="card-body p-3 md:p-4">
      <h2 
        class="card-title text-sm font-semibold truncate" 
        :title="album.title || 'Unknown Album'"
      >
        {{ album.title || 'Unknown Album' }}
      </h2>
      <p 
        class="text-xs color-primary-content truncate"
        :title="album.artistName || 'Unknown Artist'"
      >
        {{ album.artistName || 'Unknown Artist' }}
      </p>
      <p 
        class="text-xs color-primary-content truncate"
        :title="album.year || 'Unknown Year'"
      >
        {{ album.year || 'Unknown Year' }}
      </p>
      <div class="card-actions justify-end mt-1">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Album } from '~/types/album';

const props = defineProps<{
  album: Album;
  isPlayingThisAlbum?: boolean; // Is this album currently playing?
  isLoadingThisAlbum?: boolean; // Is this album currently being loaded for playback?
}>();

const emit = defineEmits(['cardClick', 'addToPlaylist', 'editAlbum', 'play']);

const imageError = ref(false);

const buttonTitle = computed(() => {
  if (props.isLoadingThisAlbum) return 'Loading...';
  if (props.isPlayingThisAlbum) return 'Pause Album';
  return 'Play Album';
});

const handleImageError = () => {
  console.warn(`Error loading image for album: ${props.album.title}, falling back to default.`);
  imageError.value = true;
};
</script>

<style scoped>
.card {
  cursor: pointer;
}
figure img {
  max-width: 100%;
  max-height: 100%;
}
</style>
