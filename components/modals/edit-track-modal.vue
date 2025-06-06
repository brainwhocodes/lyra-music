<template>
  <dialog :class="['modal', isOpen ? 'modal-open' : '']">
    <div class="modal-box w-11/12 max-w-2xl">
      <h3 class="font-bold text-lg mb-6">Edit Track Details</h3>
      <form v-if="editableTrack.trackId" @submit.prevent="updateTrack">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-x-4 gap-y-2">
          <div>
            <label for="title" class="label">
              <span class="label-text">Title</span>
            </label>
            <input v-model="editableTrack.title" type="text" id="title" class="input input-bordered w-full" required />
          </div>

          <div>
            <label for="artistName" class="label">
              <span class="label-text">Artist(s)</span>
            </label>
            <input v-model="editableTrack.artistName" type="text" id="artistName" class="input input-bordered w-full" placeholder="Artist Name, Another Artist" />
          </div>

          <div>
            <label for="albumTitle" class="label">
              <span class="label-text">Album Title</span>
            </label>
            <input v-model="editableTrack.albumTitle" type="text" id="albumTitle" class="input input-bordered w-full" />
          </div>

          <div>
            <label for="genre" class="label">
              <span class="label-text">Genre</span>
            </label>
            <input v-model="editableTrack.genre" type="text" id="genre" class="input input-bordered w-full" />
          </div>

          <div class="form-control">
            <label for="trackNumber" class="label">
              <span class="label-text">Track Number</span>
            </label>
            <input v-model.number="editableTrack.trackNumber" type="number" id="trackNumber" class="input input-bordered w-full" min="0" />
          </div>

          <div class="form-control">
            <label for="diskNumber" class="label">
              <span class="label-text">Disk Number</span>
            </label>
            <input v-model.number="editableTrack.diskNumber" type="number" id="diskNumber" class="input input-bordered w-full" min="0" />
          </div>

          <div class="form-control">
            <label for="year" class="label">
              <span class="label-text">Year</span>
            </label>
            <input v-model.number="editableTrack.year" type="number" id="year" class="input input-bordered w-full" min="1000" max="3000" />
          </div>

          <div class="form-control items-start mt-4 md:mt-8">
            <label class="label cursor-pointer">
              <input type="checkbox" v-model="editableTrack.explicit" id="explicit" class="checkbox checkbox-primary mr-2" />
              <span class="label-text">Explicit Content</span>
            </label>
          </div>
        </div>

        <div class="modal-action mt-8">
          <button type="button" class="btn" @click="closeModal">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="isLoading">
            <span v-if="isLoading" class="loading loading-spinner"></span>
            Save Changes
          </button>
        </div>
      </form>
      <div v-else class="text-center py-8">
        <p>No track data loaded.</p>
      </div>
    </div>
  </dialog>
</template>

<script setup lang="ts">
import type { Track, TrackArtistDetail } from '~/types/track';

const props = defineProps<{ track: Track, open: boolean }>();
const emit = defineEmits(['close', 'trackUpdated', 'updateError']);

const isOpen = ref(props.open);
const isLoading = ref(false);
const userToken = document ? ref(localStorage.getItem('auth_token')) : useCookie('auth_token');

// Initialize with a structure that includes all editable fields plus artistName
const editableTrack = ref<Partial<Track> & { artistName?: string }>({});

const getArtistNameString = (artists: TrackArtistDetail[] | undefined): string => {
  if (!artists || artists.length === 0) return '';
  const primaryArtists = artists.filter(a => a.isPrimaryArtist);
  const artistsToDisplay = primaryArtists.length > 0 ? primaryArtists : artists;
  return artistsToDisplay.map(a => a.name).join(', ');
};

const initializeEditableTrack = (trackData: Track) => {
  if (!trackData) {
    editableTrack.value = {}; // Reset if no track data
    return;
  }
  const trackCopy = JSON.parse(JSON.stringify(toRaw(trackData)));
  editableTrack.value = {
    ...trackCopy,
    artistName: getArtistNameString(trackCopy.artists),
    // Ensure numeric fields are numbers or null, not empty strings
    trackNumber: trackCopy.trackNumber !== undefined ? Number(trackCopy.trackNumber) : null,
    diskNumber: trackCopy.diskNumber !== undefined ? Number(trackCopy.diskNumber) : null,
    year: trackCopy.year !== undefined ? Number(trackCopy.year) : null,
    explicit: trackCopy.explicit ?? false,
  };
};

watch(() => props.open, (newValue: boolean) => {
  isOpen.value = newValue;
  if (newValue && props.track) {
    initializeEditableTrack(props.track);
  } else if (!newValue) {
    // Optional: Reset editableTrack when modal closes if desired
    // initializeEditableTrack({} as Track); // Or a default empty state
  }
});

watch(() => props.track, (newTrack: Track) => {
  if (newTrack && isOpen.value) {
    initializeEditableTrack(newTrack);
  }
}, { deep: true });

const closeModal = () => {
  isOpen.value = false;
  emit('close');
};

const updateTrack = async () => {
  if (!editableTrack.value.trackId) {
    console.error('Track ID is missing for update.');
    emit('updateError', 'Track ID is missing.');
    return;
  }

  isLoading.value = true;

  // Construct payload, ensuring numeric fields are numbers or null
  const payload: Record<string, any> = {
    title: editableTrack.value.title,
    artistName: editableTrack.value.artistName, // Backend will need to parse this
    albumTitle: editableTrack.value.albumTitle,
    trackNumber: editableTrack.value.trackNumber ? Number(editableTrack.value.trackNumber) : null,
    diskNumber: editableTrack.value.diskNumber ? Number(editableTrack.value.diskNumber) : null,
    genre: editableTrack.value.genre,
    year: editableTrack.value.year ? Number(editableTrack.value.year) : null,
    explicit: editableTrack.value.explicit ?? false,
  };

  try {
    const updatedTrackData = await $fetch<Track>(`/api/tracks/${editableTrack.value.trackId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${userToken.value}`,
        'Content-Type': 'application/json',
      },
      body: payload,
    });
    emit('trackUpdated', updatedTrackData);
    closeModal();
  } catch (error: any) {
    console.error('Failed to update track:', error);
    const errorMessage = error.data?.message || error.message || 'Failed to update track.';
    emit('updateError', errorMessage);
  } finally {
    isLoading.value = false;
  }
};

// Initial population if modal is open on mount and track is provided
if (props.open && props.track) {
  initializeEditableTrack(props.track);
}

</script>

<style scoped>
/* Add any specific styles if needed */
</style>