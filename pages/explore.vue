<template>
  <div class="explore-page">
    <header class="explore-heading">
      <h1 class="page-heading">Explore your music.</h1>
      <p class="explore-subtitle">
        Describe a mood, an instrument, or a lyric.
      </p>
    </header>

    <section
      class="index-panel"
      aria-label="Local music index"
      :aria-busy="loadingStatus || indexing"
    >
      <div>
        <h2>Made from your collection</h2>
        <p>
          Local search uses track information and available lyrics. It does not
          analyze the sound of your recordings.
        </p>
        <p v-if="loadingStatus" role="status">Checking your library…</p>
        <p v-else-if="status" class="index-count" role="status">
          {{ status.indexedTracks }} of {{ status.totalTracks }} tracks
          indexed<span v-if="status.pendingTracks">
            · {{ status.pendingTracks }} need an update</span
          >.
          <span v-if="indexing">{{
            cancelRequested
              ? "Stopping after the current batch…"
              : "Indexing locally…"
          }}</span>
          <span v-else-if="indexNotice"> {{ indexNotice }}</span>
        </p>
        <progress
          v-if="indexing && status"
          :value="status.indexedTracks"
          :max="Math.max(status.totalTracks, 1)"
          aria-label="Library indexing progress"
        />
      </div>
      <div class="index-actions">
        <button
          v-if="indexing"
          class="quiet-button"
          :disabled="cancelRequested"
          @click="cancelRequested = true"
        >
          Stop after this batch
        </button>
        <button
          v-else-if="status?.pendingTracks"
          class="quiet-button"
          :disabled="modelBusy"
          @click="updateIndex"
        >
          {{
            status.indexedTracks ? "Update local index" : "Index your library"
          }}
        </button>
        <button
          v-else
          class="quiet-button"
          :disabled="modelBusy || loadingStatus"
          @click="refreshStatus"
        >
          {{ statusError ? "Retry loading library" : "Check for changes" }}
        </button>
      </div>
      <p v-if="statusError" class="error-message" role="alert">
        {{ statusError }}
      </p>
      <p v-if="indexError" class="error-message" role="alert">
        {{ indexError }}
      </p>
    </section>

    <form class="explore-search" @submit.prevent="search">
      <label class="sr-only" for="semantic-query"
        >Describe the music you want</label
      >
      <div class="search-field">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          aria-hidden="true"
        >
          <circle cx="10.5" cy="10.5" r="7" />
          <path d="m16 16 5 5" />
        </svg>
        <input
          id="semantic-query"
          v-model="query"
          type="search"
          maxlength="1000"
          required
          placeholder="Try “quiet cinematic music”"
          autocomplete="off"
          :disabled="indexing"
          aria-describedby="search-hint"
        />
      </div>
      <button
        class="primary-button"
        type="submit"
        :disabled="modelBusy || !status?.indexedTracks || !query.trim()"
      >
        {{ searching ? "Searching…" : "Search" }}
      </button>
    </form>
    <p id="search-hint" class="search-hint">
      {{
        status && !status.indexedTracks
          ? "Index your library to start exploring."
          : "Find connections in the music you already have."
      }}
    </p>

    <nav class="result-views" aria-label="Explore views">
      <button :aria-pressed="view === 'search'" @click="view = 'search'">
        Search results
      </button>
      <button
        :aria-pressed="view === 'recommendations'"
        :disabled="indexing"
        @click="showRecommendations"
      >
        For you
      </button>
    </nav>

    <section
      class="explore-results"
      :aria-label="
        view === 'search' ? 'Search results' : 'For you recommendations'
      "
      :aria-busy="searching || loadingRecommendations"
    >
      <UiLoadingSkeleton
        v-if="searching || loadingRecommendations"
        variant="tracks"
        :label="
          searching
            ? 'Finding connections in your library…'
            : 'Looking through your listening history…'
        "
      />
      <div v-else-if="activeError" class="result-error" role="alert">
        <p>{{ activeError }}</p>
        <button
          class="quiet-button"
          :disabled="modelBusy"
          @click="view === 'search' ? search() : loadRecommendations()"
        >
          Try again
        </button>
      </div>
      <template v-else>
        <p v-if="visibleTracks.length" class="results-intro">
          <template v-if="view === 'search'"
            >Closest matches for “{{ submittedQuery }}” in your
            collection.</template
          >
          <template v-else-if="recommendations?.basis === 'history'"
            >A few connections to the tracks you have been listening
            to.</template
          >
          <template v-else
            >Recently added to your collection. Listen to more tracks to make
            this personal.</template
          >
        </p>
        <div v-else class="empty-results">
          <h2>{{ emptyHeading }}</h2>
          <p>{{ emptyDescription }}</p>
          <NuxtLink
            v-if="status?.totalTracks === 0"
            to="/settings"
            class="text-link"
            >Open library settings</NuxtLink
          >
        </div>
        <article
          v-for="track in visibleTracks"
          :key="track.trackId"
          class="result-track"
          :aria-label="track.title"
        >
          <AlbumArt
            class="result-cover"
            :src="track.coverPath"
            aria-hidden="true"
          />
          <div class="track-information">
            <h2>{{ track.title }}</h2>
            <p>{{ track.artists.join(", ") || "Unknown artist" }}</p>
            <NuxtLink
              v-if="track.albumId"
              :to="`/albums/${track.albumId}`"
              class="album-link"
              :aria-label="`Open album ${track.albumTitle}`"
              >{{ track.albumTitle }}</NuxtLink
            >
            <p v-else-if="track.albumTitle">{{ track.albumTitle }}</p>
            <p v-if="track.genre">{{ track.genre }}</p>
          </div>
          <p class="track-reason">{{ track.reason }}</p>
          <button
            class="primary-button play-result"
            :aria-label="`${isPlaying(track) ? 'Pause' : 'Play'} ${track.title}`"
            @click="play(track)"
          >
            <span aria-hidden="true">{{ isPlaying(track) ? "Ⅱ" : "▶" }}</span>
            {{ isPlaying(track) ? "Pause" : "Play" }}
          </button>
          <div class="track-tags">
            <button
              class="tag-toggle"
              :aria-expanded="Boolean(openTags[track.trackId])"
              :aria-controls="`tags-${track.trackId}`"
              :disabled="modelBusy && pendingTag !== track.trackId"
              @click="toggleTags(track.trackId)"
            >
              <span aria-hidden="true">{{
                openTags[track.trackId] ? "−" : "+"
              }}</span>
              {{
                openTags[track.trackId]
                  ? "Hide suggested tags"
                  : "Show suggested tags"
              }}<span class="sr-only"> for {{ track.title }}</span>
            </button>
            <div
              v-if="openTags[track.trackId]"
              :id="`tags-${track.trackId}`"
              class="tag-details"
            >
              <p v-if="pendingTag === track.trackId" role="status">
                Comparing text categories…
              </p>
              <div v-else-if="tagErrors[track.trackId]" role="alert">
                <p class="error-message">{{ tagErrors[track.trackId] }}</p>
                <button
                  class="quiet-button"
                  :disabled="modelBusy"
                  @click="fetchTags(track.trackId)"
                >
                  Retry tags for {{ track.title }}
                </button>
              </div>
              <template v-else-if="tags[track.trackId]">
                <ul
                  v-if="tags[track.trackId]!.tags.length"
                  class="tag-list"
                  aria-label="Suggested tags"
                >
                  <li
                    v-for="tag in tags[track.trackId]!.tags"
                    :key="tag.id"
                    :title="`Text similarity ${tag.score.toFixed(3)}; not a confidence probability`"
                  >
                    {{ tag.label }}
                  </li>
                </ul>
                <p v-else>No clear category match for this track.</p>
                <p class="tag-provenance">
                  Suggested by EmbeddingGemma from
                  {{
                    tags[track.trackId]!.tags.some((tag) =>
                      tag.evidence.includes("lyrics"),
                    )
                      ? "metadata and lyrics"
                      : "metadata"
                  }}. Suggestions do not change your library.
                </p>
              </template>
            </div>
          </div>
        </article>
      </template>
    </section>
  </div>
</template>

<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import type { Track } from "~/types/track";
import AlbumArt from "~/components/album/album-art.vue";

definePageMeta({ layout: "sidebar-layout" });
useHead({ title: "Explore your music · Lyra" });

interface Counts {
  totalTracks: number;
  indexedTracks: number;
  pendingTracks: number;
}
interface IndexStatus extends Counts {
  ready: boolean;
  model: string;
  runtime: { loaded: boolean; busy: boolean };
}
interface ResultTrack {
  trackId: string;
  title: string;
  albumId: string;
  albumTitle: string;
  artists: string[];
  coverPath: string | null;
  duration: number | null;
  genre: string | null;
  score: number;
  reason: string;
}
interface Results extends Counts {
  tracks: ResultTrack[];
  basis?: "history" | "cold-start";
}
interface TagResult {
  tags: { id: string; label: string; score: number; evidence: string[] }[];
}

const player = usePlayerStore();
const route = useRoute();
const query = ref(typeof route.query.q === "string" ? route.query.q : "");
const submittedQuery = ref("");
const view = ref<"search" | "recommendations">("search");
const status = ref<IndexStatus | null>(null);
const searchResults = ref<Results | null>(null);
const recommendations = ref<Results | null>(null);
const loadingStatus = ref(true),
  indexing = ref(false),
  searching = ref(false),
  loadingRecommendations = ref(false);
const statusError = ref(""),
  indexError = ref(""),
  searchError = ref(""),
  recommendationsError = ref(""),
  indexNotice = ref("");
const cancelRequested = ref(false),
  pendingTag = ref<string | null>(null);
const tags = ref<Record<string, TagResult>>({}),
  tagErrors = ref<Record<string, string>>({}),
  openTags = ref<Record<string, boolean>>({});
let alive = true;
const modelBusy = computed(
  () => indexing.value || searching.value || pendingTag.value !== null,
);
const activeError = computed(() =>
  view.value === "search" ? searchError.value : recommendationsError.value,
);
const visibleTracks = computed(
  () =>
    (view.value === "search" ? searchResults.value : recommendations.value)
      ?.tracks ?? [],
);
const emptyHeading = computed(() => {
  if (status.value?.totalTracks === 0)
    return "A collection starts with one album.";
  if (!status.value?.indexedTracks) return "Make room for discovery.";
  if (view.value === "recommendations")
    return "More listening, more connections.";
  return submittedQuery.value
    ? "No indexed tracks to search yet."
    : "Where will your curiosity take you?";
});
const emptyDescription = computed(() => {
  if (status.value?.totalTracks === 0)
    return "Add a music folder in settings, then return to explore your collection.";
  if (!status.value?.indexedTracks)
    return "Build a local index of your track information and lyrics using the button above.";
  if (view.value === "recommendations")
    return "Play a few tracks, or explore with a search while your listening history grows.";
  return "Try a feeling, a place, or a few words you remember.";
});
function message(error: unknown) {
  const value = error as {
    data?: { statusMessage?: string; message?: string };
    message?: string;
  };
  return (
    value.data?.statusMessage ||
    value.data?.message ||
    value.message ||
    "Something went wrong. Please try again."
  );
}
function updateCounts(counts: Counts) {
  if (status.value)
    status.value = {
      ...status.value,
      ...counts,
      ready: counts.indexedTracks > 0,
    };
}
async function refreshStatus() {
  if (indexing.value) return;
  loadingStatus.value = true;
  statusError.value = "";
  try {
    const response = await $fetch<IndexStatus>("/api/intelligence/status", {
      retry: 0,
    });
    if (alive) status.value = response;
  } catch (error) {
    if (alive) statusError.value = message(error);
  } finally {
    if (alive) loadingStatus.value = false;
  }
}
async function updateIndex() {
  if (modelBusy.value || !status.value?.pendingTracks) return;
  indexing.value = true;
  cancelRequested.value = false;
  indexError.value = "";
  indexNotice.value = "";
  tags.value = {};
  openTags.value = {};
  searchResults.value = null;
  recommendations.value = null;
  try {
    while (alive && !cancelRequested.value && status.value.pendingTracks > 0) {
      const response = await $fetch<Counts & { indexedThisBatch: number }>(
        "/api/intelligence/index",
        { method: "POST", body: { limit: 16 }, retry: 0 },
      );
      if (!alive) return;
      updateCounts(response);
      if (!response.indexedThisBatch && response.pendingTracks)
        throw new Error(
          "Your library changed while indexing. Please try the update again.",
        );
    }
    indexNotice.value =
      cancelRequested.value && status.value.pendingTracks
        ? "Stopped. You can continue indexing later."
        : "Your local index is up to date.";
  } catch (error) {
    if (alive) indexError.value = message(error);
  } finally {
    if (alive) indexing.value = false;
  }
  if (alive && !indexError.value && !cancelRequested.value) {
    if (view.value === "recommendations") await loadRecommendations();
    else if (query.value.trim()) await search();
  }
}
async function search() {
  if (modelBusy.value || !query.value.trim() || !status.value?.indexedTracks)
    return;
  view.value = "search";
  searching.value = true;
  searchError.value = "";
  submittedQuery.value = query.value.trim();
  try {
    const response = await $fetch<Results>("/api/intelligence/search", {
      query: { q: submittedQuery.value, limit: 20 },
      retry: 0,
    });
    if (alive) {
      searchResults.value = response;
      updateCounts(response);
    }
  } catch (error) {
    if (alive) searchError.value = message(error);
  } finally {
    if (alive) searching.value = false;
  }
}
async function showRecommendations() {
  view.value = "recommendations";
  if (!recommendations.value) await loadRecommendations();
}
async function loadRecommendations() {
  if (loadingRecommendations.value || indexing.value) return;
  loadingRecommendations.value = true;
  recommendationsError.value = "";
  try {
    const response = await $fetch<Results>(
      "/api/intelligence/recommendations",
      { retry: 0 },
    );
    if (alive) {
      recommendations.value = response;
      updateCounts(response);
    }
  } catch (error) {
    if (alive) recommendationsError.value = message(error);
  } finally {
    if (alive) loadingRecommendations.value = false;
  }
}
async function toggleTags(trackId: string) {
  openTags.value[trackId] = !openTags.value[trackId];
  if (
    openTags.value[trackId] &&
    !tags.value[trackId] &&
    pendingTag.value !== trackId
  )
    await fetchTags(trackId);
}
async function fetchTags(trackId: string) {
  if (modelBusy.value) return;
  pendingTag.value = trackId;
  tagErrors.value[trackId] = "";
  try {
    const response = await $fetch<TagResult>("/api/intelligence/tags", {
      query: { trackId },
      retry: 0,
    });
    if (alive) tags.value[trackId] = response;
  } catch (error) {
    if (alive) tagErrors.value[trackId] = message(error);
  } finally {
    if (alive) pendingTag.value = null;
  }
}
function isPlaying(track: ResultTrack) {
  return player.currentTrack?.trackId === track.trackId && player.isPlaying;
}
function play(track: ResultTrack) {
  if (player.currentTrack?.trackId === track.trackId) {
    player.togglePlayPause();
    return;
  }
  const playable: Track = {
    ...track,
    artists: [],
    artistName: track.artists.join(", "),
    filePath: "",
    trackNumber: null,
    year: null,
    diskNumber: null,
    explicit: false,
    createdAt: "",
    updatedAt: "",
  };
  player.playTrack(playable);
}
onMounted(async () => {
  await refreshStatus();
  if (query.value.trim() && status.value?.indexedTracks) await search();
});
watch(
  () => route.query.q,
  async (value) => {
    if (typeof value === "string") {
      query.value = value;
      if (!modelBusy.value) await search();
    }
  },
);
onBeforeUnmount(() => {
  alive = false;
  cancelRequested.value = true;
});
</script>

<style scoped>
.explore-page {
  --explore-ink: var(--ink, #262522);
  --explore-muted: var(--muted, #62594f);
  --explore-line: var(--rule, #aaa194);
  --explore-copper: var(--copper, #a34127);
  max-width: 1450px;
  margin: 0 auto;
  padding: clamp(24px, 4vw, 64px);
  color: var(--explore-ink);
}
.explore-heading h1 {
  font-family: var(--font-display);
  font-weight: 700;
  font-size: clamp(2.8rem, 5.6vw, 5.6rem);
  line-height: 1.08;
  letter-spacing: -0.045em;
  margin: 0;
}
.explore-subtitle {
  font-family: var(--font-display);
  font-size: clamp(1.55rem, 3vw, 3rem);
  line-height: 1.2;
  font-style: normal;
  margin: 10px 0 30px;
}
.index-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px 28px;
  border-block: 1px solid var(--explore-line);
  padding: 19px 0;
  margin: 28px 0;
}
.index-panel > div:first-child {
  flex: 1 1 330px;
}
.index-panel h2 {
  font-size: 1rem;
  font-weight: 600;
  margin: 0 0 5px;
}
.index-panel p {
  font-size: 0.85rem;
  line-height: 1.55;
  color: var(--explore-muted);
  max-width: 70ch;
}
.index-panel .index-count {
  margin-top: 7px;
  color: var(--explore-ink);
}
.index-panel progress {
  display: block;
  width: 100%;
  max-width: 420px;
  height: 5px;
  margin-top: 12px;
  accent-color: var(--explore-copper);
}
.explore-search {
  display: flex;
  align-items: stretch;
  gap: 12px;
  margin-top: 32px;
}
.search-field {
  display: flex;
  align-items: center;
  gap: 14px;
  flex: 1;
  min-width: 0;
  border: 1px solid var(--explore-line);
  border-radius: 2px;
  padding: 0 17px;
}
.search-field svg {
  width: 25px;
  height: 25px;
  flex-shrink: 0;
}
.search-field input {
  width: 100%;
  min-width: 0;
  background: transparent;
  border: 0;
  padding: 15px 0;
  font-size: 1.05rem;
  outline: none;
  color: inherit;
}
.search-field:focus-within {
  outline: 2px solid var(--explore-copper);
  outline-offset: 3px;
}
.primary-button,
.quiet-button {
  min-height: 44px;
  border-radius: 2px;
  padding: 11px 22px;
  font-weight: 600;
  line-height: 1.3;
  cursor: pointer;
}
.primary-button {
  background: var(--explore-copper);
  border: 1px solid var(--explore-copper);
  color: white;
}
.primary-button:hover:enabled {
  background: #28399d;
}
.quiet-button {
  border: 1px solid var(--explore-line);
  background: transparent;
  color: var(--explore-ink);
  font-size: 0.875rem;
}
button:disabled {
  opacity: 0.55;
  cursor: default;
}
button:focus-visible,
a:focus-visible {
  outline: 2px solid var(--explore-copper);
  outline-offset: 4px;
}
.search-hint {
  color: var(--explore-muted);
  font-size: 0.8rem;
  margin: 10px 0 27px;
}
.result-views {
  display: flex;
  gap: 32px;
  border-bottom: 1px solid var(--explore-line);
}
.result-views button {
  min-height: 52px;
  background: transparent;
  border: 0;
  border-bottom: 3px solid transparent;
  padding: 10px 0;
  font-size: 1rem;
  cursor: pointer;
}
.result-views button[aria-pressed="true"] {
  border-bottom-color: var(--explore-copper);
  font-weight: 600;
}
.results-intro {
  margin: 27px 0 4px;
  color: var(--explore-muted);
  line-height: 1.6;
}
.result-track {
  display: grid;
  grid-template-columns: 112px minmax(170px, 1.2fr) minmax(150px, 1fr) auto;
  gap: 16px 25px;
  align-items: center;
  border-bottom: 1px solid var(--explore-line);
  padding: 28px 0;
}
.result-cover {
  width: 112px;
  grid-row: span 2;
}
.track-information {
  min-width: 0;
}
.track-information h2 {
  font-family: var(--font-display);
  font-size: clamp(1.5rem, 2vw, 2rem);
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 7px;
  overflow-wrap: anywhere;
}
.track-information p,
.album-link {
  font-size: 0.875rem;
  line-height: 1.55;
  color: var(--explore-muted);
  overflow-wrap: anywhere;
}
.album-link:hover {
  text-decoration: underline;
}
.track-reason {
  color: var(--explore-muted);
  font-size: 0.875rem;
  line-height: 1.6;
}
.play-result {
  min-width: 105px;
  display: flex;
  gap: 12px;
  align-items: center;
  justify-content: center;
}
.track-tags {
  grid-column: 2 / -1;
}
.tag-toggle {
  background: transparent;
  border: 0;
  min-height: 44px;
  display: flex;
  gap: 12px;
  align-items: center;
  font-size: 0.85rem;
  cursor: pointer;
  padding: 6px 0;
  text-align: left;
}
.tag-toggle > span:first-child {
  font-size: 1.2rem;
  width: 16px;
}
.tag-details {
  padding: 3px 0 4px 28px;
  font-size: 0.85rem;
}
.tag-list {
  list-style: none;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0;
  margin: 0 0 9px;
}
.tag-list li {
  background: var(--color-base-200);
  padding: 5px 14px;
  border-radius: 20px;
}
.tag-provenance {
  font-size: 0.75rem;
  line-height: 1.6;
  color: var(--explore-muted);
}
.error-message,
.result-error {
  color: #8a2f1c !important;
  line-height: 1.5;
}
.index-panel > .error-message {
  flex-basis: 100%;
}
.result-error {
  margin: 28px 0;
}
.result-error button {
  margin-top: 12px;
}
.empty-results {
  padding: 46px 0 70px;
  max-width: 580px;
}
.empty-results h2 {
  font-family: var(--font-display);
  font-size: 2rem;
  line-height: 1.2;
  margin-bottom: 13px;
}
.empty-results p {
  color: var(--explore-muted);
  line-height: 1.7;
}
.text-link {
  display: inline-block;
  color: var(--explore-copper);
  margin-top: 20px;
  text-decoration: underline;
}
@media (max-width: 1150px) {
  .result-track {
    grid-template-columns: 90px minmax(0, 1fr) auto;
    gap: 14px 20px;
  }
  .result-cover {
    width: 90px;
    grid-row: span 2;
  }
  .track-reason {
    grid-column: 2 / -1;
    grid-row: 2;
  }
  .play-result {
    grid-column: 3;
    grid-row: 1;
  }
  .track-tags {
    grid-column: 2 / -1;
  }
}
@media (max-width: 600px) {
  .explore-page {
    padding: 26px 20px 40px;
  }
  .eyebrow {
    font-size: 0.65rem;
  }
  .explore-heading h1 {
    font-size: 2.85rem;
  }
  .explore-subtitle {
    font-size: 1.65rem;
  }
  .index-panel {
    align-items: stretch;
  }
  .index-actions {
    width: 100%;
  }
  .index-actions button {
    width: 100%;
  }
  .explore-search {
    gap: 8px;
  }
  .search-field {
    gap: 8px;
    padding: 0 10px;
  }
  .search-field svg {
    width: 20px;
    height: 20px;
  }
  .search-field input {
    font-size: 0.9rem;
  }
  .explore-search .primary-button {
    padding-inline: 15px;
  }
  .result-track {
    grid-template-columns: 68px minmax(0, 1fr);
    gap: 13px 16px;
    padding: 24px 0;
  }
  .result-cover {
    width: 68px;
    grid-row: 1;
  }
  .track-information h2 {
    font-size: 1.65rem;
  }
  .track-reason {
    grid-column: 1 / -1;
    grid-row: 2;
  }
  .play-result {
    grid-column: 1 / -1;
    grid-row: 3;
    justify-self: start;
    min-width: 122px;
  }
  .track-tags {
    grid-column: 1 / -1;
  }
  .tag-details {
    padding-left: 28px;
  }
  .result-views {
    gap: 28px;
  }
}
</style>
