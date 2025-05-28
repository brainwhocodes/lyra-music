<template>
  <tr 
    class="hover:bg-base-200 group cursor-pointer"
    :class="{'text-primary font-semibold bg-base-300': isCurrentTrack}"
    @click="onPlayTrack"
  >
    <td class="w-12 text-center text-sm color-primary-content">{{ trackNumber }}</td>
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
    <td class="text-right text-sm color-primary-content">{{ formattedDuration }}</td>
    <td class="w-16 text-center relative" @click.stop>
      <OptionsMenu>
        <template #default>
          <button
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
            @click.stop="emit('track-options', { action: 'add-to-playlist', track })"
          >
            <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
            Add to Playlist
          </button>
          <button
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center"
            @click.stop="emit('track-options', { action: 'edit-track', track })"
          >
            <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
            Edit Track
          </button>
        </template>
      </OptionsMenu>
    </td>
  </tr>
</template>

<!-- Add click-outside directive if not already available -->
<script setup lang="ts">
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track';
import OptionsMenu from '~/components/options-menu.vue';

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

const isCurrentTrack = computed(() => {
  return playerStore.currentTrack?.trackId === props.track.trackId;
});

const isPlaying = computed(() => playerStore.isPlaying);

const formattedDuration = computed(() => {
  return formatTrackDuration(props.track.duration);
});

const onPlayTrack = () => {
  emit('play-track', props.track);
};

const onAddToPlaylist = () => {
  emit('track-options', { action: 'add-to-playlist', track: props.track });
};

const onEditTrack = () => {
  emit('track-options', { action: 'edit-track', track: props.track });
};
</script>

<style scoped>
/* Add styles here */
</style>
