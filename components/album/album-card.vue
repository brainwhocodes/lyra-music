<template>
  <div 
    class="card bg-base-100 shadow-xl hover:shadow-2xl transition-shadow duration-300 ease-in-out group"
    @click="$emit('cardClick')"
  >
    <figure class="relative aspect-square overflow-hidden">
      <img 
        :src="albumArtUrl" 
        :alt="album.title || 'Album cover'" 
        class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ease-in-out"
        @error="handleImageError"
      />
      <div class="absolute inset-0 pointer-events-none">
        <slot name="image-overlay"></slot>
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
import { computed, ref } from 'vue';

export interface Album {
  id: number;
  title: string | null;
  artistName?: string | null; 
  coverArtUrl?: string | null; 
}

const props = defineProps<{
  album: Album;
}>();

const emit = defineEmits(['cardClick']);

const DEFAULT_ALBUM_ART = '/images/default-album-art.png'; 

const imageError = ref(false);

const albumArtUrl = computed(() => {
  if (imageError.value || !props.album.coverArtUrl) {
    return DEFAULT_ALBUM_ART;
  }
  return props.album.coverArtUrl; 
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
/* Ensure overlay slot content can receive pointer events if needed */
::v-slotted([name="image-overlay"]) > * {
  pointer-events: auto;
}
</style>
