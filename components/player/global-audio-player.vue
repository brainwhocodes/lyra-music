<template>
  <section
    v-if="playerStore.currentTrack"
    class="desktop-player"
    aria-label="Music player"
  >
    <div class="player-track">
      <img
        :src="
          playerStore.currentTrack.coverPath
            ? getCoverArtUrl(playerStore.currentTrack.coverPath)
            : '/images/lyra-radio/mark.webp'
        "
        :alt="
          !isPlaceholderArt(playerStore.currentTrack.coverPath)
            ? 'Album cover'
            : ''
        "
        :class="{
          'placeholder-art': isPlaceholderArt(
            playerStore.currentTrack.coverPath,
          ),
        }"
      />
      <div>
        <strong>{{ playerStore.currentTrack.title || "Unknown track" }}</strong>
        <p>
          {{
            playerStore.currentTrack.formattedArtists
              ?.map((a) => a.name)
              .join(", ") ||
            playerStore.currentTrack.artistName ||
            "Unknown artist"
          }}
        </p>
      </div>
    </div>
    <PlaybackControls compact />
    <div class="player-extras">
      <VolumeControl />
      <button
        type="button"
        class="btn btn-ghost control-icon"
        :aria-label="`Open full screen player: ${playerStore.currentTrack.title || 'Unknown track'}`"
        title="Full screen player"
        @click="playerStore.toggleFullScreenPlayer"
      >
        <Icon
          name="material-symbols:open-in-full-rounded"
          size="20"
          class="w-5 h-5"
        />
      </button>
      <button
        type="button"
        class="btn btn-ghost control-icon"
        aria-label="Up Next"
        :title="playerStore.isQueueSidebarVisible ? 'Hide Queue' : 'Show Queue'"
        :aria-expanded="playerStore.isQueueSidebarVisible"
        @click="playerStore.toggleQueueSidebar"
      >
        <Icon
          name="material-symbols:queue-music-rounded"
          size="24"
          class="w-6 h-6"
        /></button
      ><button
        type="button"
        class="btn btn-ghost control-icon"
        aria-label="Lyrics"
        title="Show Lyrics"
        @click="playerStore.toggleLyricsModal"
      >
        <Icon
          name="material-symbols:lyrics-rounded"
          size="20"
          class="w-5 h-5"
        />
      </button>
    </div>
  </section>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import { useCoverArt } from "~/composables/use-cover-art";
import PlaybackControls from "./playback-controls.vue";
import VolumeControl from "./volume-control.vue";
const playerStore = usePlayerStore();
const { getCoverArtUrl, isPlaceholderArt } = useCoverArt();
</script>
<style scoped>
.desktop-player {
  position: fixed;
  inset: auto 0 0;
  z-index: 50;
  display: grid;
  grid-template-columns: minmax(180px, 1fr) minmax(280px, 1.6fr) minmax(
      180px,
      1fr
    );
  align-items: center;
  gap: 1.25rem;
  padding: 0.5rem 1.5rem;
  background: var(--paper);
  border-top: 1px solid var(--rule);
  box-shadow: 0 -4px 18px #26252208;
}
.player-track {
  display: flex;
  align-items: center;
  gap: 1rem;
  min-width: 0;
}
.player-track img {
  width: 64px;
  height: 64px;
  object-fit: cover;
  background: var(--color-base-200);
}
.player-track img.placeholder-art {
  object-fit: contain;
  padding: 12px;
}
.player-track strong {
  display: block;
  font-size: 1rem;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.player-track > div {
  min-width: 0;
}
.player-track p {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.player-track p,
.player-track a {
  font-size: 0.875rem;
  color: var(--muted);
  margin: 0;
}
.player-extras {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 0.25rem;
}
.player-extras .btn {
  font-size: 0.875rem;
}
@media (max-width: 1200px) {
  .desktop-player {
    grid-template-columns: minmax(150px, 1fr) minmax(280px, 1.5fr) minmax(
        180px,
        1fr
      );
    padding: 0.75rem;
    gap: 0.5rem;
  }
  .player-track img {
    width: 46px;
    height: 46px;
  }
  .player-track {
    gap: 0.5rem;
  }
}
</style>
