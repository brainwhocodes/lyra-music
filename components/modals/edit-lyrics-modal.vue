<template>
  <UtilityDialog
    :open="open"
    :title="track ? 'Edit Lyrics for ' + track.title : 'Edit Lyrics'"
    @update:open="
      (value) => {
        if (!value) closeModal();
      }
    "
  >
    <UiLoadingSkeleton
      v-if="loading"
      label="Loading lyrics…"
      variant="text"
      :count="4"
    />
    <div v-else-if="loadError">
      <p role="alert" class="text-error">{{ loadError }}</p>
      <button class="btn btn-outline mt-3" @click="loadLyrics">
        Retry loading lyrics
      </button>
    </div>
    <form
      v-else-if="track"
      :id="formId"
      @submit.prevent="saveLyrics"
      :aria-busy="saving || generating"
    >
      <p v-if="!lines.length" class="mb-4">
        No lyrics found for this track. Add a line manually or generate lyrics
        locally.
      </p>
      <div class="lyrics-editor">
        <div
          v-for="(line, index) in lines"
          :key="index"
          class="lyric-editor-line"
        >
          <label
            ><span>Time for line {{ index + 1 }}</span
            ><input
              v-model="line.time"
              type="text"
              placeholder="MM:SS.mmm"
              class="input"
              :aria-label="'Time for line ' + (index + 1)"
              required
              pattern="(?:\d+:)?\d+:[0-5]\d(?:\.\d{1,3})?"
              :disabled="saving || generating"
          /></label>
          <label
            ><span>Lyrics for line {{ index + 1 }}</span
            ><input
              v-model="line.text"
              type="text"
              class="input"
              :aria-label="'Lyrics for line ' + (index + 1)"
              :disabled="saving || generating"
          /></label>
          <button
            type="button"
            class="btn btn-ghost"
            :aria-label="'Remove line ' + (index + 1)"
            :disabled="saving || generating"
            @click="lines.splice(index, 1)"
          >
            Remove
          </button>
        </div>
      </div>
      <div class="lyrics-tools">
        <button
          type="button"
          class="btn btn-outline"
          :disabled="saving || generating"
          @click="addLine"
        >
          {{ lines.length ? "Add Line" : "Add First Line" }}</button
        ><button
          type="button"
          class="btn btn-outline"
          :disabled="saving || generating"
          @click="generateLyrics"
        >
          {{ generating ? "Generating…" : "Generate Lyrics" }}
        </button>
      </div>
      <p v-if="generating" role="status" class="mt-4">
        Generating lyrics locally. This may take a few minutes.
      </p>
      <p v-if="saving" role="status" class="mt-4">Saving lyrics…</p>
      <p v-if="error" role="alert" class="text-error mt-4">{{ error }}</p>
      <p class="lyrics-note">
        Generated words need review. Music and singing can be harder to
        recognise than speech.
      </p>
    </form>
    <div class="modal-action">
      <button type="button" class="btn" autofocus @click="closeModal">
        Cancel</button
      ><button
        v-if="!loading && !loadError && track"
        type="submit"
        :form="formId"
        class="btn btn-primary"
        :disabled="saving || generating"
      >
        Save Changes
      </button>
    </div>
  </UtilityDialog>
</template>

<script setup lang="ts">
import type { Track } from "~/types/track";
import type { Lyrics, TimestampedLyric } from "~/types/lyrics";
import UtilityDialog from "~/components/utility/dialog.vue";

const props = defineProps<{ open: boolean; track: Track | null }>();
const emit = defineEmits<{
  close: [];
  lyricsUpdated: [lyrics: Lyrics];
  updateError: [message: string];
}>();
const formId = useId();
const lines = ref<TimestampedLyric[]>([]);
const loading = ref(false),
  saving = ref(false),
  generating = ref(false),
  loadError = ref(""),
  error = ref("");
let version = 0;
let controller: AbortController | undefined;
const timePattern = /^(?:\d+:)?\d+:[0-5]\d(?:\.\d{1,3})?$/;
const seconds = (time: string) =>
  time.split(":").reduce((total, value) => total * 60 + Number(value), 0);
const copyLines = (value: unknown): TimestampedLyric[] => {
  if (
    !Array.isArray(value) ||
    !value.every(
      (line) =>
        line && typeof line.time === "string" && typeof line.text === "string",
    )
  )
    throw new Error("Invalid lyrics response");
  return value.map((line) => ({ time: line.time, text: line.text }));
};

function closeModal() {
  emit("close");
}
async function loadLyrics() {
  const trackId = props.track?.trackId;
  if (!trackId || !props.open) return;
  const request = ++version;
  controller?.abort();
  controller = new AbortController();
  loading.value = true;
  loadError.value = "";
  try {
    const result = await $fetch<Lyrics>(
      "/api/tracks/" + encodeURIComponent(trackId) + "/lyrics",
      { signal: controller.signal, retry: 0 },
    );
    if (request === version) lines.value = copyLines(result.lyricsJson ?? []);
  } catch (cause: any) {
    if (request !== version || cause?.name === "AbortError") return;
    if (cause?.statusCode === 404 || cause?.response?.status === 404)
      lines.value = [];
    else loadError.value = "Could not load lyrics. Please try again.";
  } finally {
    if (request === version) loading.value = false;
  }
}

async function generateLyrics() {
  const trackId = props.track?.trackId;
  if (
    !trackId ||
    generating.value ||
    saving.value ||
    loading.value ||
    !props.open
  )
    return;
  const request = version;
  generating.value = true;
  error.value = "";
  try {
    const result = await $fetch<Lyrics>(
      "/api/tracks/" + encodeURIComponent(trackId) + "/lyrics/generate",
      { method: "POST", timeout: 910000, retry: 0 },
    );
    if (request === version) lines.value = copyLines(result.lyricsJson ?? []);
  } catch (cause: any) {
    if (request === version)
      error.value =
        cause?.data?.statusMessage ||
        "Could not generate lyrics. Existing lines were kept.";
  } finally {
    if (request === version) generating.value = false;
  }
}

async function saveLyrics() {
  const trackId = props.track?.trackId;
  if (
    !trackId ||
    saving.value ||
    generating.value ||
    loading.value ||
    !props.open
  )
    return;
  const payload = lines.value.map((line) => ({
    time: line.time.trim(),
    text: line.text,
  }));
  if (
    payload.some(
      (line, index) =>
        !timePattern.test(line.time) ||
        !Number.isFinite(seconds(line.time)) ||
        (index > 0 && seconds(line.time) < seconds(payload[index - 1].time)),
    )
  ) {
    error.value = "Use timestamps such as 00:12.500 in chronological order.";
    return;
  }
  const request = version;
  saving.value = true;
  error.value = "";
  try {
    const result = await $fetch<{ updatedLyrics: Lyrics }>(
      "/api/tracks/" + encodeURIComponent(trackId) + "/lyrics",
      { method: "PUT", body: { lyricsJson: payload }, retry: 0 },
    );
    if (request !== version || !props.open || props.track?.trackId !== trackId)
      return;
    emit("lyricsUpdated", result.updatedLyrics);
    closeModal();
  } catch (cause: any) {
    if (request !== version) return;
    error.value =
      cause?.data?.statusMessage ||
      cause?.data?.message ||
      "Could not save lyrics. Please try again.";
    emit("updateError", error.value);
  } finally {
    if (request === version) saving.value = false;
  }
}

function addLine() {
  lines.value.push({ time: lines.value.at(-1)?.time || "00:00.000", text: "" });
}
watch(
  [() => props.open, () => props.track?.trackId],
  ([open]) => {
    version++;
    controller?.abort();
    lines.value = [];
    loading.value = saving.value = generating.value = false;
    loadError.value = error.value = "";
    if (open) void loadLyrics();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  version++;
  controller?.abort();
});
</script>

<style scoped>
.lyrics-editor {
  max-height: 50vh;
  overflow: auto;
}
.lyric-editor-line {
  display: grid;
  grid-template-columns: 7.5rem minmax(0, 1fr) auto;
  gap: 0.5rem;
  align-items: end;
  margin-bottom: 1rem;
}
.lyric-editor-line label > span {
  display: block;
  font-size: 0.875rem;
  margin-bottom: 0.25rem;
}
.lyric-editor-line .input {
  width: 100%;
  min-width: 0;
}
.lyrics-tools {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-top: 1rem;
}
.lyrics-note {
  font-size: 0.875rem;
  color: var(--muted);
  margin-top: 1rem;
}
@media (max-width: 500px) {
  .lyric-editor-line {
    grid-template-columns: 7.5rem minmax(0, 1fr);
  }
  .lyric-editor-line .btn {
    grid-column: 1/-1;
    justify-self: end;
  }
}
</style>
