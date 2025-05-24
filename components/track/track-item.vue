<template>
  <tr 
    class="hover:bg-base-200 group cursor-pointer"
    :class="{'text-primary font-semibold bg-base-300': isCurrentTrack}"
    @click="onPlayTrack"
  >
    <td class="w-12 text-center text-sm text-neutral-content">{{ trackNumber }}</td>
    <td class="w-12 text-center">
      <!-- Show pause icon if this track is playing -->
      <Icon 
        v-if="isCurrentTrack && isPlaying"
        name="material-symbols:pause-rounded"
        class="w-5 h-5 text-primary"
      />
      <!-- Show play icon on hover if not playing, or if it's a different track -->
      <Icon 
        v-else
        name="material-symbols:play-arrow-rounded"
        class="w-5 h-5 text-base-content opacity-0 group-hover:opacity-100"
        :class="{'opacity-100': isCurrentTrack}" 
      />
    </td>
    <td class="flex items-center">
      <img 
        v-if="track.coverPath" 
        :src="track.coverPath" 
        :alt="`${track.title} cover`"
        class="w-10 h-10 rounded mr-3 object-cover"
      />
      <div>
        <div class="font-medium">{{ track.title }}</div>
        <div v-if="track.artistName" class="text-sm text-base-content/70">{{ track.artistName }}</div>
      </div>
    </td>
    <td class="text-right text-sm text-neutral-content">{{ formattedDuration }}</td>
    <td class="w-16 text-center relative" @click.stop>
      <button 
        class="btn btn-ghost btn-sm p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
        @click.stop="toggleMenu"
      >
        <Icon name="i-material-symbols:more-vert" class="w-5 h-5" />
      </button>
      
      <!-- Custom dropdown menu -->
      <div 
        v-if="isMenuOpen" 
        class="absolute right-0 top-full mt-1 w-52 bg-base-200 rounded-lg shadow-lg z-[10] py-2 border border-base-300"
        @click.stop
      >
        <div class="flex flex-col">
          <button 
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
            @click.stop="onAddToPlaylist"
          >
            <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
            Add to Playlist
          </button>
          <button 
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
            @click.stop="onEditTrack"
          >
            <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
            Edit Track
          </button>
        </div>
      </div>
    </td>
  </tr>
</template>

<!-- Add click-outside directive if not already available -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track';

const props = defineProps({
  track: {
    type: Object as () => Track,
    required: true,
  },
  trackNumber: {
    type: Number,
    required: true,
  },
});

const emit = defineEmits(['play-track', 'track-options']);
const playerStore = usePlayerStore();
const isMenuOpen = ref(false);

const isCurrentTrack = computed(() => {
  return playerStore.currentTrack?.trackId === props.track.trackId;
});

const isPlaying = computed(() => playerStore.isPlaying);

const formattedDuration = computed(() => {
  if (props.track.duration === undefined || props.track.duration === null) {
    return '--:--';
  }
  const totalSeconds = Math.floor(props.track.duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
});

const toggleMenu = (event: Event) => {
  event.stopPropagation();
  isMenuOpen.value = !isMenuOpen.value;
};

const closeMenu = () => {
  isMenuOpen.value = false;
};

const onPlayTrack = () => {
  closeMenu();
  emit('play-track', props.track);
};

const onAddToPlaylist = () => {
  closeMenu();
  emit('track-options', { action: 'add-to-playlist', track: props.track });
};

const onEditTrack = () => {
  closeMenu();
  emit('track-options', { action: 'edit-track', track: props.track });
};

// Close menu when clicking outside
const handleClickOutside = (event: MouseEvent) => {
  if (isMenuOpen.value) {
    isMenuOpen.value = false;
  }
};

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* Add styles here */
</style>
