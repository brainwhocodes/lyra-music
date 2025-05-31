<template>
  <tr
    class="hover:bg-base-200 group cursor-pointer"
    :class="{'font-semibold bg-base-300': isCurrentTrack}"
    @click="onPlayTrack"
  >
    <td class="w-12 text-center text-sm color-primary-content">{{ trackNumber }}</td>
    <td class="w-12 text-center">
      <Icon
        v-if="isCurrentTrack && isPlaying"
        name="material-symbols:pause-rounded"
        class="w-5 h-5 text-primary"
      />
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
        <div :class="['font-medium', isCurrentTrack ? 'text-primary' : '']">{{ track.title }}</div>
        <div v-if="track.artistName" class="text-sm text-base-content/70">{{ track.artistName }}</div>
      </div>
    </td>
    <td class="text-right text-sm color-primary-content">{{ formattedDuration }}</td>
    <td class="w-16 text-center relative" @click.stop>
      <OptionsMenu>
        <template #default>
          <button
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center w-full"
            @click.stop="openAddToPlaylistModal"
          >
            <Icon name="material-symbols:playlist-add" class="w-5 h-5 mr-2" />
            Add to Playlist
          </button>
          <button
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center w-full"
            @click.stop="emit('track-options', { action: 'edit-track', track })"
          >
            <Icon name="material-symbols:edit" class="w-5 h-5 mr-2" />
            Edit Track
          </button>
          <button
            v-if="inPlaylist"
            class="px-4 py-2 text-left hover:bg-base-300 flex items-center w-full text-error"
            @click.stop="emit('track-options', { action: 'remove-from-playlist', track })"
          >
            <Icon name="material-symbols:playlist-remove" class="w-5 h-5 mr-2" />
            Remove from Playlist
          </button>
        </template>
      </OptionsMenu>
    </td>
  </tr>

  <AddToPlaylistModal
    v-model:open="isAddToPlaylistModalOpen"
    :track="track"
    @add-track="handleAddTrackToPlaylist"
  />
</template>

<script setup lang="ts">
// In Nuxt 3, these are auto-imported
// No need to explicitly import ref and computed
import { usePlayerStore } from '~/stores/player';
import type { Track } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import OptionsMenu from '~/components/options-menu.vue';
import AddToPlaylistModal from '~/components/modals/add-to-playlist-modal.vue';
import { formatTrackDuration } from '~/utils/formatters'; // Assuming this is the correct path

const props = defineProps({
  playlists: {
    type: Array as () => Playlist[],
    required: true,
  },
  track: {
    type: Object as () => Track,
    required: true,
  },
  trackNumber: {
    type: Number,
    required: true,
  },
  inPlaylist: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(['play-track', 'track-options', 'add-to-playlist']);
const isAddToPlaylistModalOpen = ref(false);
const playerStore = usePlayerStore();

const isCurrentTrack = computed(() => {
  return playerStore.currentTrack?.trackId === props.track.trackId;
});

const isPlaying = computed(() => playerStore.isPlaying);

const formattedDuration = computed(() => {
  return formatTrackDuration(props.track.duration);
});

const onPlayTrack = (): void => {
  emit('play-track', props.track);
};

const openAddToPlaylistModal = (): void => {
  isAddToPlaylistModalOpen.value = true;
};

const handleAddTrackToPlaylist = (payload: { trackId: string; playlistId: string }): void => {
  emit('add-to-playlist', payload);
  // Modal closes itself via v-model:open, so no need to set isAddToPlaylistModalOpen.value = false here
};
</script>


