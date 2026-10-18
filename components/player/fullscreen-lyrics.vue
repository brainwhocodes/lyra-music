<template>
  <dialog
    ref="dialog"
    class="lyrics-overlay"
    aria-label="Lyrics"
    @cancel.prevent="close"
  >
    <div><LyricsView @close="close" /></div>
  </dialog>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import LyricsView from "./lyrics-view.vue";
const player = usePlayerStore();
const dialog = ref<HTMLDialogElement | null>(null);
function close() {
  if (player.isFullScreenLyricsVisible) player.toggleFullScreenLyrics();
}
onMounted(() => dialog.value?.showModal());
onBeforeUnmount(() => dialog.value?.close());
</script>
<style scoped>
.lyrics-overlay {
  position: fixed;
  inset: 0;
  margin: 0;
  width: 100%;
  max-width: 100%;
  height: 100dvh;
  max-height: 100dvh;
  background: var(--paper);
  color: var(--ink);
  border: 0;
  padding: 1.25rem;
  overflow-y: auto;
}
.lyrics-overlay::backdrop {
  background: var(--paper);
}
.lyrics-overlay > div {
  max-width: 800px;
  margin: auto;
  min-height: calc(100dvh - 2.5rem);
}
</style>
