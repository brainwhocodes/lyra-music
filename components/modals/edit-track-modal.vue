<template>
  <UtilityDialog
    :open="open"
    title="Edit Track Details"
    @update:open="
      (value) => {
        if (!value) closeModal();
      }
    "
  >
    <form
      v-if="track?.trackId"
      @submit.prevent="updateTrack"
      :aria-busy="saving"
    >
      <div class="track-fields">
        <div>
          <label :for="id + '-title'" class="label">Title</label
          ><input
            :id="id + '-title'"
            v-model="draft.title"
            class="input w-full"
            required
            autofocus
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-artists'" class="label">Artist(s)</label
          ><input
            :id="id + '-artists'"
            v-model="draft.artistName"
            class="input w-full"
            placeholder="Artist Name, Another Artist"
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-album'" class="label">Album Title</label
          ><input
            :id="id + '-album'"
            v-model="draft.albumTitle"
            class="input w-full"
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-genre'" class="label">Genre</label
          ><input
            :id="id + '-genre'"
            v-model="draft.genre"
            class="input w-full"
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-track'" class="label">Track Number</label
          ><input
            :id="id + '-track'"
            v-model="draft.trackNumber"
            type="number"
            min="0"
            step="1"
            class="input w-full"
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-disc'" class="label">Disk Number</label
          ><input
            :id="id + '-disc'"
            v-model="draft.diskNumber"
            type="number"
            min="0"
            step="1"
            class="input w-full"
            :disabled="saving"
          />
        </div>
        <div>
          <label :for="id + '-year'" class="label">Year</label
          ><input
            :id="id + '-year'"
            v-model="draft.year"
            type="number"
            min="1000"
            max="3000"
            step="1"
            class="input w-full"
            :disabled="saving"
          />
        </div>
        <label class="explicit-field"
          ><input
            v-model="draft.explicit"
            type="checkbox"
            class="checkbox"
            :disabled="saving"
          />Explicit Content</label
        >
      </div>
      <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
      <p v-if="saving" role="status" class="mt-4">Saving track…</p>
      <div class="modal-action">
        <button type="button" class="btn" @click="closeModal">Cancel</button
        ><button
          type="submit"
          class="btn btn-primary"
          :disabled="saving || !draft.title.trim()"
        >
          Save Changes
        </button>
      </div>
    </form>
    <p v-else>No track selected.</p>
  </UtilityDialog>
</template>

<script setup lang="ts">
import type { Track } from "~/types/track";
import UtilityDialog from "~/components/utility/dialog.vue";

const props = defineProps<{ track: Track; open: boolean }>();
const emit = defineEmits<{
  close: [];
  trackUpdated: [track: Track];
  updateError: [message: string];
}>();
const id = useId();
const empty = () => ({
  title: "",
  artistName: "",
  albumTitle: "",
  genre: "",
  trackNumber: "",
  diskNumber: "",
  year: "",
  explicit: false,
});
const draft = ref(empty());
let original = empty();
const saving = ref(false),
  error = ref("");
let version = 0;

watch(
  [() => props.open, () => props.track?.trackId],
  ([open]) => {
    version++;
    saving.value = false;
    error.value = "";
    if (!open || !props.track) return;
    const track = props.track;
    original = {
      title: track.title || "",
      artistName:
        track.artists?.map((artist) => artist.name).join(", ") ||
        track.artistName ||
        "",
      albumTitle: track.albumTitle || "",
      genre: track.genre || "",
      trackNumber: track.trackNumber == null ? "" : String(track.trackNumber),
      diskNumber: track.diskNumber == null ? "" : String(track.diskNumber),
      year: track.year == null ? "" : String(track.year),
      explicit: track.explicit ?? false,
    };
    draft.value = { ...original };
  },
  { immediate: true },
);

function closeModal() {
  emit("close");
}
async function updateTrack() {
  const trackId = props.track?.trackId;
  if (!trackId || saving.value || !props.open) return;
  if (!draft.value.title.trim()) {
    error.value = "Enter a track title.";
    return;
  }
  const payload: Record<string, string | number | boolean | null> = {};
  // Preserve untouched credits and album membership when editing another field.
  for (const field of ["title", "artistName", "albumTitle", "genre"] as const) {
    if (draft.value[field] !== original[field])
      payload[field] = draft.value[field].trim();
  }
  for (const field of ["trackNumber", "diskNumber", "year"] as const) {
    if (draft.value[field] === original[field]) continue;
    const value = draft.value[field] === "" ? null : Number(draft.value[field]);
    if (
      value !== null &&
      (!Number.isSafeInteger(value) ||
        value < (field === "year" ? 1000 : 0) ||
        (field === "year" && value > 3000))
    ) {
      error.value =
        "Use whole numbers for track, disk and year, or leave them blank.";
      return;
    }
    payload[field] = value;
  }
  if (draft.value.explicit !== original.explicit)
    payload.explicit = draft.value.explicit;
  if (!Object.keys(payload).length) {
    closeModal();
    return;
  }
  const request = version;
  saving.value = true;
  error.value = "";
  try {
    const result = await $fetch<Track>(
      "/api/tracks/" + encodeURIComponent(trackId),
      { method: "PUT", body: payload, retry: 0 },
    );
    if (request !== version || !props.open || props.track?.trackId !== trackId)
      return;
    emit("trackUpdated", result);
    closeModal();
  } catch (cause: any) {
    if (request !== version) return;
    error.value =
      cause?.data?.statusMessage ||
      cause?.data?.message ||
      "Could not save the track. Please try again.";
    emit("updateError", error.value);
  } finally {
    if (request === version) saving.value = false;
  }
}
onBeforeUnmount(() => {
  version++;
});
</script>

<style scoped>
.track-fields {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.75rem 1rem;
}
.explicit-field {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  min-height: 44px;
  margin-top: 2rem;
}
@media (max-width: 550px) {
  .track-fields {
    grid-template-columns: 1fr;
  }
  .explicit-field {
    margin-top: 0.5rem;
  }
}
</style>
