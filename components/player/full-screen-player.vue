<template>
  <dialog
    ref="dialog"
    class="full-player"
    aria-labelledby="now-playing-title"
    @cancel.prevent="dismiss"
  >
    <div class="full-player-inner">
      <header>
        <LyraBrand />
        <button
          type="button"
          class="btn btn-ghost control-icon"
          aria-label="Close full screen player"
          title="Close player"
          @click="dismiss"
        >
          <Icon
            name="material-symbols:close-rounded"
            size="24"
            class="w-6 h-6"
          />
        </button>
      </header>
      <section class="listening-workspace" aria-label="Now playing">
        <img
          class="full-art"
          :class="{
            'placeholder-art': isPlaceholderArt(
              playerStore.currentTrack?.coverPath,
            ),
          }"
          :src="
            playerStore.currentTrack?.coverPath
              ? getCoverArtUrl(playerStore.currentTrack.coverPath)
              : '/images/lyra-radio/mark.webp'
          "
          :alt="
            !isPlaceholderArt(playerStore.currentTrack?.coverPath)
              ? 'Album cover'
              : ''
          "
        />
        <div class="listening-controls">
          <div class="track-copy">
            <h2 id="now-playing-title">
              {{ playerStore.currentTrack?.title || "Unknown track" }}
            </h2>
            <p>
              {{
                playerStore.currentTrack?.formattedArtists
                  ?.map((a) => a.name)
                  .join(", ") ||
                playerStore.currentTrack?.artistName ||
                "Unknown artist"
              }}
            </p>
            <p v-if="playerStore.currentTrack?.albumTitle" class="album-name">
              {{ playerStore.currentTrack.albumTitle }}
            </p>
          </div>
          <PlaybackControls />
          <footer>
            <button
              type="button"
              class="btn btn-ghost"
              :aria-expanded="playerStore.isFullScreenQueueVisible"
              @click="playerStore.toggleFullScreenQueue"
            >
              <Icon
                name="material-symbols:queue-music-rounded"
                size="20"
                class="w-5 h-5"
              />Up Next
            </button>
            <button
              type="button"
              class="btn btn-ghost"
              :aria-expanded="playerStore.isFullScreenLyricsVisible"
              @click="playerStore.toggleFullScreenLyrics"
            >
              <Icon
                name="material-symbols:lyrics-rounded"
                size="20"
                class="w-5 h-5"
              />Lyrics
            </button>
            <VolumeControl />
          </footer>
        </div>
      </section>
      <FullScreenLyrics
        v-if="playerStore.isFullScreenLyricsVisible"
      /><FullscreenQueue />
    </div>
  </dialog>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import { useCoverArt } from "~/composables/use-cover-art";
import PlaybackControls from "./playback-controls.vue";
import VolumeControl from "./volume-control.vue";
import FullScreenLyrics from "./fullscreen-lyrics.vue";
import FullscreenQueue from "~/components/layout/fullscreen-queue.vue";
const playerStore = usePlayerStore();
const { getCoverArtUrl, isPlaceholderArt } = useCoverArt();
const dialog = ref<HTMLDialogElement | null>(null);
function dismiss() {
  if (playerStore.isFullScreenLyricsVisible) {
    playerStore.toggleFullScreenLyrics();
    return;
  }
  if (playerStore.isFullScreenQueueVisible) {
    playerStore.hideFullScreenQueue();
    return;
  }
  playerStore.toggleFullScreenPlayer();
}
onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.full-player {
  position: fixed;
  inset: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  border: 0;
  padding: clamp(1rem, 3vw, 3rem);
  color: var(--ink);
  background: var(--paper);
  overflow-y: auto;
}
.full-player::backdrop {
  background: var(--paper);
}
.full-player-inner {
  max-width: 1180px;
  margin: auto;
  padding-bottom: env(safe-area-inset-bottom);
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid var(--rule);
}
.listening-workspace {
  display: grid;
  grid-template-columns: minmax(0, 0.8fr) minmax(0, 1.2fr);
  align-items: center;
  gap: clamp(2rem, 5vw, 5rem);
  padding: clamp(2.5rem, 10vh, 7rem) 0;
}
.full-art {
  display: block;
  width: 100%;
  aspect-ratio: 1;
  object-fit: cover;
  background: var(--color-base-200);
  border: 1px solid var(--rule);
}
.full-art.placeholder-art {
  object-fit: contain;
  padding: clamp(12px, 4vw, 64px);
}
.listening-controls {
  min-width: 0;
}
.track-copy {
  min-width: 0;
  overflow-wrap: anywhere;
  margin-bottom: 1.75rem;
}
h2 {
  font-size: clamp(2.5rem, 4.5vw, 4.5rem);
  line-height: 1.05;
  margin: 0 0 0.5rem;
}
p {
  margin: 0;
  font-size: 1rem;
}
.album-name {
  color: var(--muted);
  margin-top: 0.25rem;
}
footer {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-top: 1.5rem;
  padding-top: 1rem;
  border-top: 1px solid var(--color-base-300);
}
footer .btn {
  font-size: 0.875rem;
}
@media (max-width: 900px) {
  .full-player-inner {
    max-width: 580px;
  }
  .listening-workspace {
    grid-template-columns: minmax(0, 1fr);
    gap: 1.5rem;
    padding: 2rem 0;
  }
  .full-art {
    width: min(42vw, 13rem);
    justify-self: center;
  }
  .track-copy {
    text-align: center;
    margin-bottom: 1.25rem;
  }
  h2 {
    font-size: clamp(2rem, 7vw, 3rem);
  }
  footer {
    margin-top: 1.25rem;
  }
}
@media (max-height: 700px) and (max-width: 900px) {
  .listening-workspace {
    padding-top: 1.25rem;
    gap: 1rem;
  }
  .full-art {
    width: 7rem;
  }
  header {
    padding-bottom: 0.75rem;
  }
}
@media (max-width: 360px) {
  footer {
    gap: 0.25rem;
  }
  footer .btn {
    padding-inline: 0.5rem;
  }
}
</style>
