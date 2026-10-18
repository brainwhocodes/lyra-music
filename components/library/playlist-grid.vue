<template>
  <UiLoadingSkeleton
    v-if="pending"
    label="Loading playlists…"
    variant="compact"
  />
  <p v-else-if="error" role="alert">
    Could not load playlists. Please try again.
  </p>
  <div v-else-if="playlists?.length" class="library-links">
    <div
      v-for="playlist in playlists.slice(0, 4)"
      :key="playlist.playlistId"
      class="library-item"
    >
      <AlbumArt />
      <NuxtLink :to="`/playlists/${playlist.playlistId}`"
        ><strong>{{ playlist.name }}</strong
        ><small
          >{{ playlist.trackCount }}
          {{ playlist.trackCount === 1 ? "track" : "tracks" }}</small
        ></NuxtLink
      >
      <button
        class="btn btn-ghost"
        type="button"
        :aria-label="`Play ${playlist.name}`"
        @click="playPlaylist(playlist.playlistId)"
      >
        <Icon name="material-symbols:play-arrow-rounded" aria-hidden="true" />
      </button>
    </div>
  </div>
  <p v-else>
    No playlists yet. <NuxtLink to="/playlists">Create a playlist</NuxtLink>.
  </p>
</template>
<script setup lang="ts">
import AlbumArt from "~/components/album/album-art.vue";
import { usePlayerStore } from "~/stores/player";
import type { Playlist } from "~/types/playlist";
const {
  data: playlists,
  pending,
  error,
} = useLazyFetch<Playlist[]>("/api/playlists");
const player = usePlayerStore();
const { showNotification } = useNotification();
async function playPlaylist(id: string) {
  try {
    const playlist = await $fetch<Playlist>(`/api/playlists/${id}`);
    if (!playlist.tracks.length)
      return showNotification("This playlist has no tracks yet.", "info");
    player.loadQueue(
      playlist.tracks.map((entry) => entry.track),
      { type: "playlist", id, name: playlist.name },
      true,
    );
  } catch {
    showNotification("Could not play this playlist.", "error");
  }
}
</script>
