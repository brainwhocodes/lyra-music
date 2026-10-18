<template>
  <div class="utility-page">
    <header>
      <h1 class="page-heading">Discover.</h1>
      <p class="page-intro utility-subtitle">
        A fresh path through familiar music.
      </p>
      <p class="page-intro">
        Discovery playlists bring together tracks from your library. Open a
        collection, or explore with your own words.
      </p>
    </header>
    <div class="page-toolbar">
      <label
        >Search discovery playlists<input
          v-model="query"
          type="search"
          class="input"
          placeholder="Find a collection" /></label
      ><NuxtLink to="/explore" class="btn btn-outline">Open Explore</NuxtLink>
    </div>
    <UiLoadingSkeleton
      v-if="pending"
      label="Loading discovery playlists…"
      variant="rows"
      :count="3"
    />
    <div v-else-if="error" class="utility-status" role="alert">
      Could not load discovery playlists.
      <button class="btn btn-outline" @click="refresh()">Try again</button>
    </div>
    <div v-else-if="!playlists?.length" class="utility-empty">
      <h2>A new way into your library.</h2>
      <p>
        No discovery playlists are available yet. Explore can help you find
        music by description.
      </p>
      <NuxtLink to="/explore" class="btn btn-primary"
        >Explore your music</NuxtLink
      >
    </div>
    <p v-else-if="!filtered.length" class="utility-empty" role="status">
      No collections match “{{ query }}”.
    </p>
    <div v-else class="utility-list">
      <article
        v-for="playlist in filtered"
        :key="playlist.discoveryPlaylistId"
        class="utility-row"
      >
        <UtilityArt />
        <div>
          <h2>
            <NuxtLink :to="`/discovery/${playlist.discoveryPlaylistId}`">{{
              playlist.title
            }}</NuxtLink>
          </h2>
          <p>
            {{ playlist.trackCount }}
            {{ playlist.trackCount === 1 ? "track" : "tracks" }}
          </p>
        </div>
        <div class="utility-actions">
          <NuxtLink
            :to="`/discovery/${playlist.discoveryPlaylistId}`"
            class="btn btn-primary"
            >Open</NuxtLink
          ><button
            class="btn btn-outline"
            :aria-label="`Play ${playlist.title}`"
            :disabled="
              !playlist.trackCount || busyId === playlist.discoveryPlaylistId
            "
            @click="play(playlist.discoveryPlaylistId)"
          >
            Play
          </button>
        </div>
      </article>
    </div>
    <p v-if="playError" role="alert" class="utility-status text-error">
      {{ playError }}
    </p>
  </div>
</template>
<script setup lang="ts">
import type { DiscoveryPlaylist } from "~/types/discovery-playlist";
import { usePlayerStore } from "~/stores/player";
definePageMeta({ layout: "sidebar-layout" });
useSeoMeta({ title: usePageTitle("Discover") });
const {
  data: playlists,
  pending,
  error,
  refresh,
} = useLazyFetch<DiscoveryPlaylist[]>("/api/discovery-playlists");
const query = ref(""),
  busyId = ref(""),
  playError = ref("");
const filtered = computed(() =>
  (playlists.value || []).filter((p) =>
    p.title.toLowerCase().includes(query.value.trim().toLowerCase()),
  ),
);
const player = usePlayerStore();
async function play(id: string) {
  busyId.value = id;
  playError.value = "";
  try {
    const result = await $fetch<DiscoveryPlaylist>(
      `/api/discovery-playlists/${id}`,
    );
    if (!result.tracks.length) return;
    player.loadQueue(
      result.tracks.map((t) => t.track),
      { type: "discovery", id },
    );
  } catch {
    playError.value = "Could not play this collection. Please try again.";
  } finally {
    busyId.value = "";
  }
}
</script>
<style src="~/assets/utility-pages.css"></style>
