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
      
      <!-- Album options button -->
      <div class="absolute top-2 right-2 z-20" @click.stop>
        <button 
          class="btn btn-ghost btn-sm btn-circle bg-base-300/80 backdrop-blur-sm hover:bg-base-300 opacity-0 group-hover:opacity-100 focus:opacity-100"
          @click.stop="toggleMenu"
          title="Album options"
        >
          <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
        </button>
        
        <!-- Album options dropdown menu -->
        <div 
          v-if="showMenu" 
          class="absolute right-0 top-full mt-1 w-52 bg-base-200 rounded-lg shadow-lg z-30 py-2 border border-base-300"
          @click.stop
        >
          <div class="flex flex-col">
            <button 
              class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
              @click.stop="addToPlaylist"
            >
              <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
              Add to Playlist
            </button>
            <button 
              class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
              @click.stop="editAlbum"
            >
              <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
              Edit Album
            </button>
          </div>
        </div>
      </div>
    </figure>
    <div class="card-body p-3 md:p-4">
      <h2 
        class="card-title text-sm font-semibold truncate" 
        :title="album.title || 'Unknown Album'"
      >
        <slot name="title">{{ album.title || 'Unknown Album' }}</slot>
      </h2>
      <p 
        class="text-xs text-neutral-content/70 truncate"
        :title="album.artistName || 'Unknown Artist'"
      >
        <slot name="artist">{{ album.artistName || 'Unknown Artist' }}</slot>
      </p>
      <div class="card-actions justify-end mt-1">
        <slot name="actions"></slot>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// In Nuxt 3, these functions are auto-imported
// but we'll import them explicitly from #imports to fix TypeScript errors
import { computed, ref, onMounted } from '#imports';
import type { Album } from '~/types/album';

const props = defineProps<{
  album: Album;
}>();

const emit = defineEmits(['cardClick', 'addToPlaylist', 'editAlbum']);


const imageError = ref(false);
const showMenu = ref(false);

// Close menu when clicking outside
onMounted(() => {
  document.addEventListener('click', () => {
    showMenu.value = false;
  });
});

// Toggle the album options menu
const toggleMenu = (): void => {
  showMenu.value = !showMenu.value;
};

// Emit event to add the album to a playlist
const addToPlaylist = (): void => {
  emit('addToPlaylist', props.album);
  showMenu.value = false;
};

// Emit event to edit the album
const editAlbum = (): void => {
  emit('editAlbum', props.album);
  showMenu.value = false;
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
