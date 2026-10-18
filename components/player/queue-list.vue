<template>
  <div class="queue-list">
    <div class="queue-heading">
      <h2>Up Next</h2>
      <button
        v-if="player.queue.length"
        class="btn btn-ghost"
        title="Clear queue"
        @click="player.clearQueue()"
      >
        Clear queue
      </button>
    </div>
    <ol v-if="player.queue.length">
      <li
        v-for="(track, index) in player.queue"
        :key="track.trackId + '-' + index"
        :class="{ current: index === player.currentQueueIndex }"
      >
        <img
          :src="
            track.coverPath
              ? getCoverArtUrl(track.coverPath)
              : '/images/lyra-radio/mark.webp'
          "
          :class="{ 'placeholder-art': isPlaceholderArt(track.coverPath) }"
          alt=""
        />
        <div class="queue-track">
          <h3>{{ track.title }}</h3>
          <p>
            {{
              track.formattedArtists?.map((a) => a.name).join(", ") ||
              track.artistName ||
              "Unknown artist"
            }}
          </p>
          <p>
            {{ formatDuration(track.duration || 0) }}
            <span v-if="index === player.currentQueueIndex"
              >· Current track</span
            >
          </p>
        </div>
        <button
          class="btn btn-outline btn-circle"
          :aria-label="
            (index === player.currentQueueIndex && player.isPlaying
              ? 'Pause '
              : 'Play ') + track.title
          "
          @click="play(index)"
        >
          <Icon
            :name="
              index === player.currentQueueIndex && player.isPlaying
                ? 'material-symbols:pause-rounded'
                : 'material-symbols:play-arrow-rounded'
            "
            class="w-6 h-6"
          />
        </button>
      </li>
    </ol>
    <p v-else class="queue-empty">
      Your queue is empty. Choose an album or track to start listening.
    </p>
  </div>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import { useCoverArt } from "~/composables/use-cover-art";
import { formatDuration } from "~/utils/formatters";
const player = usePlayerStore();
const { getCoverArtUrl, isPlaceholderArt } = useCoverArt();
function play(index: number) {
  if (index === player.currentQueueIndex) player.togglePlayPause();
  else player.playFromQueue(index);
}
</script>
<style scoped>
.queue-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.queue-heading h2 {
  font-size: 2.75rem;
  margin: 0;
}
.queue-heading .btn {
  color: var(--copper);
}
ol {
  list-style: none;
  padding: 0;
  margin: 0;
}
li {
  display: flex;
  align-items: center;
  gap: 1rem;
  border-top: 1px solid var(--rule);
  padding: 1.25rem 0;
}
li.current {
  border-top-color: var(--copper);
}
li > img {
  width: 58px;
  height: 58px;
  object-fit: cover;
  background: var(--color-base-200);
}
.placeholder-art {
  padding: 12px;
  object-fit: contain !important;
}
.queue-track {
  min-width: 0;
  flex: 1;
}
.queue-track h3 {
  font-size: 1.5rem;
  margin: 0 0 0.3rem;
  overflow-wrap: anywhere;
}
.queue-track p {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}
.queue-empty {
  color: var(--muted);
}
</style>
