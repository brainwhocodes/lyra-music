<template>
  <div :class="['modal', { 'modal-open': open }]" role="dialog">
    <div class="modal-box w-11/12 max-w-lg">
      <h3 class="font-bold text-lg">{{ isEditing ? 'Edit Radio Station' : 'Add Radio Station' }}</h3>
      
      <form @submit.prevent="submitForm" class="space-y-4 pt-4">
        <div>
          <label for="name" class="label">
            <span class="label-text">Name</span>
          </label>
          <input v-model="formData.name" id="name" type="text" placeholder="Station Name" class="input input-bordered w-full" required />
        </div>

        <div>
          <label for="artists" class="label">
            <span class="label-text">Seed Artists</span>
          </label>
          <select multiple v-model="formData.artistIds" id="artists" class="select select-bordered w-full h-48">
            <option v-for="artist in allArtists" :key="artist.artistId" :value="artist.artistId">
              {{ artist.name }}
            </option>
          </select>
          <div class="label">
            <span class="label-text-alt">Hold Ctrl/Cmd to select multiple</span>
          </div>
        </div>

        <div>
          <label for="genres" class="label">
            <span class="label-text">Seed Genres</span>
          </label>
          <select multiple v-model="formData.genreIds" id="genres" class="select select-bordered w-full h-48">
            <option v-for="genre in allGenres" :key="genre.genreId" :value="genre.genreId">
              {{ genre.name }}
            </option>
          </select>
           <div class="label">
            <span class="label-text-alt">Hold Ctrl/Cmd to select multiple</span>
          </div>
        </div>

        <div class="modal-action">
          <button type="button" class="btn" @click="closeModal">Cancel</button>
          <button type="submit" class="btn btn-primary" :disabled="isSubmitting">
            <span v-if="isSubmitting" class="loading loading-spinner"></span>
            {{ isEditing ? 'Save Changes' : 'Create Station' }}
          </button>
        </div>
      </form>
    </div>
    <div class="modal-backdrop" @click="closeModal"></div>
  </div>
</template>

<script setup lang="ts">
import type { RadioChannel } from '~/server/db/schema/radio-channels';
import type { Artist } from '~/server/db/schema/artists';
import type { Genre } from '~/server/db/schema/genres';

interface Station extends RadioChannel {
  radioChannelArtists: { artist: Artist }[];
  radioChannelGenres: { genre: Genre }[];
}

const props = defineProps<{ 
  open: boolean;
  station: Station | null;
}>();

const emit = defineEmits(['close', 'station-updated']);

const isSubmitting = ref(false);
const allArtists = ref<Artist[]>([]);
const allGenres = ref<Genre[]>([]);
const formData = ref({
  name: '',
  artistIds: [] as string[],
  genreIds: [] as string[],
});

const isEditing = computed(() => !!props.station);

async function fetchLookups() {
  try {
    [allArtists.value, allGenres.value] = await Promise.all([
      $fetch<Artist[]>('/api/artists'),
      $fetch<Genre[]>('/api/genres'),
    ]);
  } catch (error) {
    console.error('Failed to fetch artists or genres', error);
  }
}

watch(() => props.open, (isOpen: boolean) => {
  if (isOpen) {
    fetchLookups();
    if (props.station) {
      formData.value.name = props.station.name;
      formData.value.artistIds = props.station.radioChannelArtists.map((a: { artist: Artist }) => a.artist.artistId);
      formData.value.genreIds = props.station.radioChannelGenres.map((g: { genre: Genre }) => g.genre.genreId);
    } else {
      resetForm();
    }
  }
});

async function submitForm() {
  isSubmitting.value = true;

  try {
    const url = isEditing.value ? `/api/radio-stations/${props.station!.channelId}` : '/api/radio-stations';
    const method = isEditing.value ? 'PUT' : 'POST';

    await $fetch(url, {
      method,
      body: {
        name: formData.value.name,
        artistIds: formData.value.artistIds,
        genreIds: formData.value.genreIds,
      },
    });

    emit('station-updated');
    closeModal();
  } catch (error) {
    console.error('Failed to save radio station:', error);
    // TODO: Add user-facing error notification
  } finally {
    isSubmitting.value = false;
  }
}

function resetForm() {
  formData.value = {
    name: '',
    artistIds: [],
    genreIds: [],
  };
}

function closeModal() {
  resetForm();
  emit('close');
}
</script>
