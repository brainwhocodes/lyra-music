<template>
  <section class="lyrics-view" aria-label="Track lyrics">
    <header>
      <div>
        <h2>Lyrics</h2>
        <p>{{ player.currentTrack?.title || "No track selected" }}</p>
      </div>
      <button
        class="btn btn-outline"
        aria-label="Close lyrics"
        @click="$emit('close')"
      >
        Close
      </button>
    </header>
    <p v-if="loading" role="status">Loading lyrics…</p>
    <p v-if="error" role="alert" class="lyrics-error">{{ error }}</p>
    <div v-if="!loading && !lines.length" class="lyrics-empty">
      <h3>No lyrics found</h3>
      <p>This track doesn't have any lyrics yet.</p>
    </div>
    <div ref="linesContainer" class="lyrics-lines">
      <button
        v-for="(line, index) in lines"
        :key="index"
        class="lyric-line"
        :class="{ active: index === activeIndex }"
        :aria-current="index === activeIndex ? 'true' : undefined"
        :aria-label="`Jump to ${line.time.split('.')[0]} ${line.text}`"
        @click="player.seek(toSeconds(line.time))"
      >
        <span class="lyric-time">{{ line.time.split(".")[0] }}</span
        >{{ " " }}<span>{{ line.text }}</span>
      </button>
    </div>
    <footer>
      <button
        class="btn btn-outline"
        :aria-pressed="autoScroll"
        @click="autoScroll = !autoScroll"
      >
        Auto-scroll {{ autoScroll ? "on" : "off" }}</button
      ><button
        class="btn btn-primary"
        :disabled="generating || loading || !player.currentTrack?.trackId"
        @click="generate"
      >
        {{
          generating
            ? "Generating…"
            : lines.length
              ? "Regenerate"
              : "Generate Lyrics"
        }}
      </button>
    </footer>
    <p class="lyrics-note">
      Generated words need review. Music and singing can be harder to recognise
      than speech.
    </p>
  </section>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import type { TimestampedLyric } from "~/types/lyrics";
defineEmits<{ close: [] }>();
const player = usePlayerStore();
const lines = ref<TimestampedLyric[]>([]);
const loading = ref(false);
const generating = ref(false);
const error = ref("");
const autoScroll = ref(true);
const linesContainer = ref<HTMLElement | null>(null);
let version = 0;
let controller: AbortController | undefined;
const toSeconds = (time: string) =>
  time.split(":").reduce((sum, part) => sum * 60 + Number(part), 0);
const activeIndex = computed(() => {
  for (let i = lines.value.length - 1; i >= 0; i--)
    if (toSeconds(lines.value[i].time) <= player.currentTime) return i;
  return -1;
});
const accept = (value: unknown): TimestampedLyric[] =>
  Array.isArray(value)
    ? value.filter(
        (v): v is TimestampedLyric =>
          !!v &&
          typeof v.time === "string" &&
          typeof v.text === "string" &&
          Number.isFinite(toSeconds(v.time)),
      )
    : [];
watch(
  () => player.currentTrack?.trackId,
  async (trackId) => {
    const request = ++version;
    controller?.abort();
    controller = new AbortController();
    lines.value = [];
    error.value = "";
    generating.value = false;
    loading.value = !!trackId;
    if (!trackId) return;
    try {
      const result = await $fetch<{ lyricsJson: unknown }>(
        `/api/tracks/${encodeURIComponent(trackId)}/lyrics`,
        { signal: controller.signal },
      );
      if (request === version) lines.value = accept(result.lyricsJson);
    } catch (e: any) {
      if (
        request === version &&
        e?.statusCode !== 404 &&
        e?.response?.status !== 404 &&
        e?.name !== "AbortError"
      )
        error.value =
          "Could not load lyrics. Please close and reopen to try again.";
    } finally {
      if (request === version) loading.value = false;
    }
  },
  { immediate: true },
);
async function generate() {
  const trackId = player.currentTrack?.trackId;
  if (!trackId || generating.value) return;
  const request = version;
  generating.value = true;
  error.value = "";
  try {
    const result = await $fetch<{ lyricsJson: unknown }>(
      `/api/tracks/${encodeURIComponent(trackId)}/lyrics/generate`,
      { method: "POST", timeout: 910000 },
    );
    if (request === version) lines.value = accept(result.lyricsJson);
  } catch (e: any) {
    if (request === version)
      error.value =
        e?.data?.statusMessage ||
        "Could not generate lyrics. Existing lyrics were kept.";
  } finally {
    if (request === version) generating.value = false;
  }
}
watch(activeIndex, async () => {
  if (!autoScroll.value) return;
  await nextTick();
  const active = linesContainer.value?.querySelector(".active");
  active?.scrollIntoView({
    block: "nearest",
    behavior: window.matchMedia("(prefers-reduced-motion:reduce)").matches
      ? "auto"
      : "smooth",
  });
});
onUnmounted(() => {
  version++;
  controller?.abort();
});
</script>
<style scoped>
.lyrics-view {
  display: flex;
  flex-direction: column;
  min-height: 60vh;
  max-height: 100%;
  color: var(--ink);
}
header {
  display: flex;
  align-items: start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}
h2 {
  font-size: 3rem;
  margin: 0 0 0.5rem;
}
header p {
  margin: 0;
  color: var(--muted);
}
.lyrics-lines {
  overflow-y: auto;
  min-height: 0;
  flex: 1;
}
.lyric-line {
  display: flex;
  align-items: baseline;
  gap: 1rem;
  text-align: left;
  width: 100%;
  border: 0;
  border-bottom: 1px solid transparent;
  background: none;
  color: var(--ink);
  padding: 1rem 0.25rem;
  font: 700 clamp(1.75rem, 4vw, 2.75rem) / 1.4 var(--font-display);
}
.lyric-line.active {
  color: var(--copper);
  border-bottom-color: var(--copper);
}
.lyric-time {
  font: 400 0.875rem var(--font-body);
  color: var(--muted);
}
footer {
  display: flex;
  gap: 1rem;
  justify-content: space-between;
  flex-wrap: wrap;
  border-top: 1px solid var(--rule);
  padding-top: 1.25rem;
  margin-top: 2rem;
}
.lyrics-note {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 1rem 0 0;
}
.lyrics-empty {
  padding: 2rem 0;
  text-align: center;
}
.lyrics-empty p {
  color: var(--muted);
}
.lyrics-error {
  color: #9a2723;
}
@media (max-width: 400px) {
  .lyric-line {
    gap: 0.5rem;
  }
  .lyrics-view {
    min-height: 70vh;
  }
  h2 {
    font-size: 2.5rem;
  }
}
</style>
