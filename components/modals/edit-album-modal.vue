<template>
  <UtilityDialog
    :open="open"
    title="Edit Album"
    @update:open="
      (value) => {
        if (!value) closeModal();
      }
    "
  >
    <form @submit.prevent="updateAlbum" :aria-busy="saving">
      <div class="album-cover">
        <img
          :src="
            previewUrl ||
            (album.coverPath
              ? getCoverArtUrl(album.coverPath)
              : '/images/lyra-radio/mark.webp')
          "
          alt="Album cover preview"
          width="128"
          height="128"
        />
      </div>
      <label class="label" :for="id + '-cover'">Cover image</label>
      <input
        :id="id + '-cover'"
        ref="fileInput"
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        class="file-input w-full"
        :disabled="saving"
        @change="selectCover"
      />
      <p class="field-hint">PNG, JPEG, WebP or GIF, up to 5 MB.</p>
      <label class="label" :for="id + '-title'">Title</label
      ><input
        :id="id + '-title'"
        v-model="draft.title"
        class="input w-full"
        autofocus
        required
        :disabled="saving"
      />
      <label class="label" :for="id + '-artists'">Artist(s)</label
      ><input
        :id="id + '-artists'"
        v-model="draft.artistName"
        class="input w-full"
        :disabled="saving"
      />
      <label class="label" :for="id + '-year'">Year</label
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
      <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
      <p v-if="saving" role="status" class="mt-4">Saving album…</p>
      <div class="modal-action">
        <button type="button" class="btn" @click="closeModal">Cancel</button
        ><button
          type="submit"
          class="btn btn-primary"
          :disabled="saving || !draft.title.trim()"
        >
          Save
        </button>
      </div>
    </form>
  </UtilityDialog>
</template>

<script setup lang="ts">
import type { Album } from "~/types/album";
import { useCoverArt } from "~/composables/use-cover-art";
import UtilityDialog from "~/components/utility/dialog.vue";

const props = defineProps<{ album: Album; open: boolean }>();
const emit = defineEmits<{
  close: [];
  albumUpdated: [album: Album];
  updateError: [message: string];
}>();
const { getCoverArtUrl } = useCoverArt();
const id = useId();
const draft = ref({ title: "", artistName: "", year: "" });
let original = { ...draft.value };
const selectedFile = ref<File | null>(null),
  previewUrl = ref<string | null>(null),
  fileInput = ref<HTMLInputElement | null>(null);
const saving = ref(false),
  error = ref("");
let version = 0;
function clearPreview() {
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  selectedFile.value = null;
  if (fileInput.value) fileInput.value.value = "";
}
watch(
  [() => props.open, () => props.album?.albumId],
  ([open]) => {
    version++;
    clearPreview();
    saving.value = false;
    error.value = "";
    if (!open || !props.album) return;
    original = {
      title: props.album.title || "",
      artistName:
        props.album.artists?.map((artist) => artist.name).join(", ") || "",
      year: props.album.year == null ? "" : String(props.album.year),
    };
    draft.value = { ...original };
  },
  { immediate: true },
);
function closeModal() {
  emit("close");
}
function selectCover(event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
  previewUrl.value = null;
  selectedFile.value = null;
  error.value = "";
  if (!file) return;
  if (
    !["image/png", "image/jpeg", "image/webp", "image/gif"].includes(
      file.type,
    ) ||
    file.size > 5 * 1024 * 1024
  ) {
    error.value = "Choose a PNG, JPEG, WebP or GIF image up to 5 MB.";
    if (fileInput.value) fileInput.value.value = "";
    return;
  }
  selectedFile.value = file;
  previewUrl.value = URL.createObjectURL(file);
}
async function updateAlbum() {
  const albumId = props.album?.albumId;
  if (!albumId || saving.value || !props.open) return;
  if (!draft.value.title.trim()) {
    error.value = "Enter an album title.";
    return;
  }
  if (
    draft.value.artistName !== original.artistName &&
    !draft.value.artistName.trim()
  ) {
    error.value = "Enter at least one artist.";
    return;
  }
  const year = draft.value.year === "" ? null : Number(draft.value.year);
  if (
    year !== null &&
    (!Number.isSafeInteger(year) || year < 1000 || year > 3000)
  ) {
    error.value = "Use a whole year between 1000 and 3000, or leave it blank.";
    return;
  }
  const body = new FormData();
  if (draft.value.title !== original.title)
    body.append("title", draft.value.title.trim());
  if (draft.value.artistName !== original.artistName)
    body.append("artistName", draft.value.artistName.trim());
  if (draft.value.year !== original.year)
    body.append("year", year === null ? "" : String(year));
  if (selectedFile.value) body.append("coverImage", selectedFile.value);
  if (![...body.keys()].length) {
    closeModal();
    return;
  }
  const request = version;
  saving.value = true;
  error.value = "";
  try {
    const result = await $fetch<Album>(
      "/api/albums/" + encodeURIComponent(albumId),
      { method: "PUT", body, retry: 0 },
    );
    if (request !== version || !props.open || props.album?.albumId !== albumId)
      return;
    emit("albumUpdated", result);
    closeModal();
  } catch (cause: any) {
    if (request !== version) return;
    error.value =
      cause?.data?.statusMessage ||
      cause?.data?.message ||
      "Could not save the album. Please try again.";
    emit("updateError", error.value);
  } finally {
    if (request === version) saving.value = false;
  }
}
onBeforeUnmount(() => {
  version++;
  clearPreview();
});
</script>

<style scoped>
.album-cover {
  width: 128px;
  height: 128px;
  border: 1px solid var(--rule);
  background: var(--paper);
}
.album-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.field-hint {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0.5rem 0 1rem;
}
</style>
