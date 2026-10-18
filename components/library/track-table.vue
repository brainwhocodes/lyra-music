<template>
  <table class="table record-table">
    <caption class="sr-only">
      {{
        caption
      }}
    </caption>
    <thead>
      <tr>
        <th scope="col"><span class="sr-only">Play</span></th>
        <th scope="col">Title</th>
        <th scope="col" class="album-column">Album</th>
        <th scope="col" class="artist-column">Artist</th>
        <th scope="col" class="duration-column">Duration</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="track in tracks"
        :key="track.trackId"
        :class="{
          'current-track': player.currentTrack?.trackId === track.trackId,
        }"
      >
        <td class="play-column">
          <button
            type="button"
            class="btn btn-primary btn-square"
            :aria-label="`${player.isPlaying && player.currentTrack?.trackId === track.trackId ? 'Pause' : 'Play'} ${track.title}`"
            @click="$emit('play', track)"
          >
            <Icon
              :name="
                player.isPlaying &&
                player.currentTrack?.trackId === track.trackId
                  ? 'material-symbols:pause-rounded'
                  : 'material-symbols:play-arrow-rounded'
              "
              aria-hidden="true"
            />
          </button>
        </td>
        <td class="title-column">
          <span>{{ track.title }}</span>
          <div class="mobile-credits">
            <NuxtLink v-if="track.albumId" :to="`/albums/${track.albumId}`">{{
              track.albumTitle
            }}</NuxtLink
            ><span v-if="track.albumId && track.artistName"> · </span
            ><NuxtLink
              v-if="track.artistId"
              :to="`/artists/${track.artistId}`"
              >{{ track.artistName }}</NuxtLink
            ><span v-else>{{ track.artistName }}</span>
          </div>
        </td>
        <td class="album-column">
          <NuxtLink v-if="track.albumId" :to="`/albums/${track.albumId}`">{{
            track.albumTitle
          }}</NuxtLink
          ><span v-else>—</span>
        </td>
        <td class="artist-column">
          <NuxtLink v-if="track.artistId" :to="`/artists/${track.artistId}`">{{
            track.artistName
          }}</NuxtLink
          ><span v-else>{{ track.artistName || "Unknown artist" }}</span>
        </td>
        <td class="duration-column">
          {{ formatTrackDuration(track.duration) }}
        </td>
      </tr>
    </tbody>
  </table>
</template>
<script setup lang="ts">
import type { Track } from "~/types/track";
import { usePlayerStore } from "~/stores/player";
import { formatTrackDuration } from "~/utils/formatters";
defineProps<{ tracks: Track[]; caption: string }>();
defineEmits<{ (event: "play", track: Track): void }>();
const player = usePlayerStore();
</script>
<style scoped>
.record-table {
  width: 100%;
  table-layout: auto;
}
.record-table th {
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-size: 0.8rem;
}
.record-table td {
  overflow-wrap: anywhere;
}
.play-column {
  width: 58px;
}
.title-column {
  min-width: 0;
}
.duration-column {
  text-align: right;
  width: 75px;
  white-space: nowrap;
}
.current-track .title-column > span {
  color: var(--copper, #a34127);
  font-weight: 600;
}
.mobile-credits {
  display: none;
}
@media (max-width: 800px) {
  .album-column,
  .artist-column {
    display: none;
  }
  .mobile-credits {
    display: block;
    font-size: 0.875rem;
    color: var(--muted, #62594f);
    margin-top: 0.3rem;
  }
  .record-table td,
  .record-table th {
    padding: 0.85rem 0.4rem;
  }
}
</style>
