<template>
  <div :class="['modal', { 'modal-open': open }]" @keydown.esc="closeModal">
    <div class="modal-box w-11/12 max-w-2xl relative">
      <button class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2 z-10" @click="closeModal" :disabled="isLoading || isGenerating" aria-label="Close modal">✕</button>
      <h3 v-if="track" class="font-bold text-lg mb-4">Edit Lyrics for {{ track.title }}</h3>
      <h3 v-else class="font-bold text-lg mb-4">Edit Lyrics</h3>

      <!-- Initial Loading State -->
      <div v-if="isLoading && !initialFetchDone" class="text-center py-10">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2">Loading lyrics...</p>
      </div>

      <!-- Error Display -->
      <div v-if="errorMessage && !isGenerating" class="alert alert-error mb-4">
        <svg xmlns="http://www.w3.org/2000/svg" class="stroke-current shrink-0 h-6 w-6" fill="none" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 14l2-2m0 0l2-2m-2 2l-2 2m2-2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        <span>{{ errorMessage }}</span>
      </div>

      <!-- Generating Lyrics State -->
      <div v-if="isGenerating" class="text-center py-10">
        <span class="loading loading-spinner loading-lg"></span>
        <p class="mt-2">Generating lyrics, please wait...</p>
      </div>

      <!-- Main Content: Edit or Generate -->
      <div v-if="initialFetchDone && !isLoading && !isGenerating" class="flex flex-col flex-grow min-h-0">
        <!-- No Lyrics Exist: Show Generate Button -->
        <div v-if="!hasLyrics" class="text-center py-10 my-auto">
          <p class="mb-4">No lyrics found for this track.</p>
          <button
            type="button"
            class="btn btn-primary mb-4"
            @click="handleGenerateLyrics"
            :disabled="isGenerating || isLoading">
            <span v-if="isGenerating" class="loading loading-spinner loading-xs mr-2"></span>
            Generate Lyrics (AI)
          </button>
          <p class="text-sm text-base-content/70 mb-2">Alternatively, add lines manually:</p>
          <button type="button" class="btn btn-sm btn-outline" @click="addNewLyricLine">
            <Icon name="material-symbols:add" class="w-4 h-4 mr-1" /> Add First Line
          </button>
        </div>

        <!-- Lyrics Exist: Show Editor -->
        <form v-else @submit.prevent="handleSubmit" class="flex flex-col flex-grow min-h-0">
          <div class="space-y-2 mb-4 max-h-[50vh] overflow-y-auto pr-2 flex-grow">
            <div v-for="(line, index) in editableLyricsLines" :key="index" class="flex items-center space-x-2">
              <input
                type="text"
                v-model="line.time"
                placeholder="MM:SS.mmm"
                class="input input-bordered input-sm w-28 font-mono text-xs flex-shrink-0"
                :disabled="isLoading || isGenerating" />
              <input
                type="text"
                v-model="line.text"
                placeholder="Lyric text..."
                class="input input-bordered input-sm flex-grow"
                :disabled="isLoading || isGenerating" />
              <button
                type="button"
                class="btn btn-xs btn-ghost text-error"
                @click="removeLyricLine(index)"
                :disabled="isLoading || isGenerating"
                aria-label="Remove line">
                <Icon name="material-symbols:delete-outline-rounded" class="w-4 h-4" />
              </button>
            </div>
          </div>
          <button
            type="button"
            class="btn btn-sm btn-outline mb-4 self-start"
            @click="addNewLyricLine"
            :disabled="isLoading || isGenerating">
            <Icon name="material-symbols:add" class="w-4 h-4 mr-1" /> Add Line
          </button>

          <div class="modal-action mt-auto pt-4 border-t border-base-300">
            <button
              type="button"
              class="btn btn-ghost"
              @click="closeModal"
              :disabled="isLoading || isGenerating">
              Cancel
            </button>
            <button
              type="submit"
              class="btn btn-primary"
              :disabled="isLoading || isGenerating || !hasLyrics">
              <span v-if="isLoading && !isGenerating" class="loading loading-spinner loading-xs mr-2"></span>
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
    <div class="modal-backdrop" @click="(!isLoading && !isGenerating) ? closeModal() : null"></div>
  </div>
</template>

<script setup lang="ts">
import type { Track } from '~/types/track';
import type { Lyrics, TimestampedLyric } from '~/types/lyrics';

const props = defineProps<{
  open: boolean;
  track: Track | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'lyricsUpdated', updatedLyrics: Lyrics): void;
  (e: 'updateError', message: string): void;
}>();

const editableLyricsLines = ref<TimestampedLyric[]>([]);
const isLoading = ref<boolean>(false);
const isGenerating = ref<boolean>(false);
const errorMessage = ref<string | null>(null);
const initialFetchDone = ref<boolean>(false);

const hasLyrics = computed((): boolean => editableLyricsLines.value.length > 0);

const fetchLyrics = async (trackId: string): Promise<void> => {
  isLoading.value = true;
  errorMessage.value = null;
  initialFetchDone.value = false;
  try {
    const fetchedLyrics = await $fetch<Lyrics>(`/api/tracks/${trackId}/lyrics`, { cache: 'no-cache' });
    if (fetchedLyrics && fetchedLyrics.lyricsJson) {
      editableLyricsLines.value = Array.isArray(fetchedLyrics.lyricsJson) ? JSON.parse(JSON.stringify(fetchedLyrics.lyricsJson)) : [];
    } else {
      editableLyricsLines.value = [];
    }
  } catch (error: any) {
    console.error('Error fetching lyrics:', error);
    if (error.response?.status === 404) {
      editableLyricsLines.value = [];
    } else {
      errorMessage.value = 'Failed to load lyrics. ' + (error.data?.message || error.message || 'Unknown error');
      editableLyricsLines.value = [];
    }
  }
  isLoading.value = false;
  initialFetchDone.value = true;
};

watch(() => props.open, (newVal: boolean) => {
  if (newVal && props.track) {
    fetchLyrics(props.track.trackId);
  } else if (!newVal) {
    editableLyricsLines.value = [];
    errorMessage.value = null;
    isLoading.value = false;
    isGenerating.value = false;
    initialFetchDone.value = false;
  }
});

const handleGenerateLyrics = async (): Promise<void> => {
  if (!props.track) return;
  isGenerating.value = true;
  errorMessage.value = null;
  try {
    await $fetch(`/api/tracks/${props.track.trackId}/lyrics/generate`, {
      method: 'POST',
    });
    await fetchLyrics(props.track.trackId);
  } catch (error: any) {
    console.error('Error generating lyrics:', error);
    errorMessage.value = 'Failed to generate lyrics. ' + (error.data?.message || error.message || 'Unknown error');
    if (!initialFetchDone.value) initialFetchDone.value = true; 
  }
  isGenerating.value = false;
};

const handleSubmit = async (): Promise<void> => {
  if (!props.track) return;
  isLoading.value = true;
  errorMessage.value = null;
  try {
    const response = await $fetch<{ message: string; updatedLyrics: Lyrics }>(
      `/api/tracks/${props.track.trackId}/lyrics`,
      {
        method: 'PUT',
        body: { lyricsJson: toRaw(editableLyricsLines.value) },
      }
    );
    emit('lyricsUpdated', response.updatedLyrics);
    emit('close');
  } catch (error: any) {
    console.error('Error updating lyrics:', error);
    const message = error.data?.message || error.message || 'Unknown error';
    errorMessage.value = `Failed to save lyrics: ${message}`;
    emit('updateError', message);
  }
  isLoading.value = false;
};

const addNewLyricLine = (): void => {
  editableLyricsLines.value.push({ time: '00:00.000', text: '' });
};

const removeLyricLine = (index: number): void => {
  editableLyricsLines.value.splice(index, 1);
};

const closeModal = (): void => {
  if (isLoading.value || isGenerating.value) return;
  emit('close');
};

</script>

<style scoped>
.modal-box {
  max-height: 80vh; /* Ensure modal doesn't get too tall */
  display: flex;
  flex-direction: column;
}
form {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}

.modal-box {
  max-height: 80vh;
  display: flex;
  flex-direction: column;
}
form {
  flex-grow: 1;
  display: flex;
  flex-direction: column;
}
.form-control textarea {
  flex-grow: 1;
  resize: vertical; /* Allow vertical resize, but usually constrained by modal height */
}
</style>
