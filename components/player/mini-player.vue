<template>
  <section
    v-if="playerStore.currentTrack"
    class="mini-player"
    aria-label="Music player"
  >
    <button
      class="mini-info"
      :aria-label="`Open full screen player: ${playerStore.currentTrack.title || 'Unknown track'} ${playerStore.currentTrack.formattedArtists?.map((a) => a.name).join(', ') || playerStore.currentTrack.artistName || 'Unknown artist'}`"
      @click="playerStore.toggleFullScreenPlayer"
    >
      <img
        :src="
          playerStore.currentTrack.coverPath
            ? getCoverArtUrl(playerStore.currentTrack.coverPath)
            : '/images/lyra-radio/mark.webp'
        "
        alt=""
        :class="{
          'placeholder-art': isPlaceholderArt(
            playerStore.currentTrack.coverPath,
          ),
        }"
      /><span
        ><strong>{{ playerStore.currentTrack.title || "Unknown track" }}</strong
        >{{ " "
        }}<span>{{
          playerStore.currentTrack.formattedArtists
            ?.map((a) => a.name)
            .join(", ") ||
          playerStore.currentTrack.artistName ||
          "Unknown artist"
        }}</span></span
      ></button
    ><button
      class="btn btn-primary btn-circle"
      :aria-label="playerStore.isPlaying ? 'Pause playback' : 'Play playback'"
      @click="playerStore.togglePlayPause"
      :disabled="playerStore.isLoading && !playerStore.isPlaying"
    >
      <Icon
        :name="
          playerStore.isPlaying
            ? 'material-symbols:pause-rounded'
            : 'material-symbols:play-arrow-rounded'
        "
        size="24"
        class="w-6 h-6"
      />
    </button>
    <WaveformSeek compact class="mini-seek" />
  </section>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import { useCoverArt } from "~/composables/use-cover-art";
import WaveformSeek from "./waveform-seek.vue";
const playerStore = usePlayerStore();
const { getCoverArtUrl, isPlaceholderArt } = useCoverArt();
</script>
<style scoped>
.mini-player {
  position: fixed;
  inset: auto 0 0;
  z-index: 60;
  background: var(--paper);
  border-top: 1px solid var(--rule);
  padding: 0.75rem 1rem calc(0.75rem + env(safe-area-inset-bottom));
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 0.25rem 1rem;
}
.mini-seek {
  grid-column: 1 / -1;
}
.mini-player > .btn-circle {
  width: 44px;
  min-width: 44px;
  height: 44px;
  min-height: 44px;
  border-radius: 50%;
}
.mini-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
  min-width: 0;
  text-align: left;
  background: none;
  border: 0;
  padding: 0;
  color: var(--ink);
}
.mini-info img {
  width: 48px;
  height: 48px;
  object-fit: cover;
  background: var(--color-base-200);
}
.mini-info img.placeholder-art {
  padding: 9px;
  object-fit: contain;
}
.mini-info > span {
  min-width: 0;
}
.mini-info strong,
.mini-info span span {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 0.875rem;
}
.mini-info span span {
  color: var(--muted);
}
</style>
