<template>
  <div 
    class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out group"
    @click="$emit('cardClick')"
  >
    <figure class="relative aspect-square overflow-hidden">
      <img 
        :src="album.coverPath" 
        :alt="album.title || 'Album cover'" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
        @error="handleImageError"
      />
      <div class="absolute inset-0 pointer-events-none">
        <slot name="image-overlay"></slot>
      </div>
      
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
}>();

const emit = defineEmits(['cardClick', 'addToPlaylist', 'editAlbum']);

const imageError = ref(false);

// Emit event to add the album to a playlist
const addToPlaylist = (): void => {
  emit('addToPlaylist', props.album);
};

// Emit event to edit the album
const editAlbum = (): void => {
  emit('editAlbum', props.album);
};

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
/* Ensure overlay slot content can receive pointer events if needed */
::v-slotted([name="image-overlay"]) > * {
  pointer-events: auto;
}
</style>
