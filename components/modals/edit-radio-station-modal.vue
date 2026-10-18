<template>
  <UtilityDialog
    :open="open"
    :title="station ? 'Edit Radio Station' : 'Add Radio Station'"
    @update:open="
      (value) => {
        if (!value) emit('close');
      }
    "
  >
    <form @submit.prevent="submit">
      <label class="label" for="station-editor-name">Station Name</label
      ><input
        id="station-editor-name"
        v-model="name"
        class="input w-full"
        required
        maxlength="200"
        autofocus
      />
      <p class="mt-4">
        Choose artists or genres from your library to shape the queue.
      </p>
      <p v-if="loading" role="status" class="mt-4">
        Loading artists and genres…
      </p>
      <div v-else class="seed-columns">
        <fieldset>
          <legend>Seed Artists</legend>
          <div class="seed-options">
            <label v-for="artist in artists" :key="artist.artistId"
              ><input
                v-model="artistIds"
                :value="artist.artistId"
                type="checkbox"
                class="checkbox"
              />{{ artist.name }}</label
            >
            <p v-if="!artists.length">No artists in your library yet.</p>
          </div>
        </fieldset>
        <fieldset>
          <legend>Seed Genres</legend>
          <div class="seed-options">
            <label v-for="genre in genres" :key="genre.genreId"
              ><input
                v-model="genreIds"
                :value="genre.genreId"
                type="checkbox"
                class="checkbox"
              />{{ genre.name }}</label
            >
            <p v-if="!genres.length">No genres in your library yet.</p>
          </div>
        </fieldset>
      </div>
      <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
      <div class="modal-action">
        <button type="button" class="btn" @click="emit('close')">Cancel</button
        ><button
          class="btn btn-primary"
          :disabled="saving || loading || !name.trim()"
        >
          {{ station ? "Save Changes" : "Create Station" }}
        </button>
      </div>
    </form>
  </UtilityDialog>
</template>
<script setup lang="ts">
import type { RadioStation } from "~/types/radio";
import { useRadioStationEditor } from "~/composables/useRadioStationEditor";
const props = defineProps<{ open: boolean; station: RadioStation | null }>();
const emit = defineEmits<{
  close: [];
  "station-updated": [station: RadioStation];
}>();
const {
  name,
  artistIds,
  genreIds,
  artists,
  genres,
  error,
  loading,
  saving,
  submit,
} = useRadioStationEditor(
  props,
  $fetch,
  (station) => emit("station-updated", station),
  () => emit("close"),
);
</script>
<style scoped>
.seed-columns {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 1.5rem;
  margin-top: 1.5rem;
}
.seed-options {
  max-height: 15rem;
  overflow: auto;
}
.seed-options label {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  padding: 0.6rem 0.25rem;
  border-bottom: 1px solid var(--rule);
}
legend {
  font-weight: 600;
  margin-bottom: 0.5rem;
}
@media (max-width: 500px) {
  .seed-columns {
    grid-template-columns: 1fr;
  }
}
</style>
