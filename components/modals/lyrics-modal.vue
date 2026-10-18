<template>
  <dialog
    ref="dialog"
    class="modal lyrics-dialog"
    aria-label="Lyrics"
    @cancel.prevent="close"
    @close="syncClosed"
  >
    <div class="modal-box max-w-3xl">
      <LyricsView v-if="player.isLyricsModalVisible" @close="close" />
    </div>
    <form method="dialog" class="modal-backdrop">
      <button aria-label="Close lyrics backdrop">Close</button>
    </form>
  </dialog>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import LyricsView from "~/components/player/lyrics-view.vue";
const player = usePlayerStore();
const dialog = ref<HTMLDialogElement | null>(null);
const close = () => player.hideLyricsModal();
const syncClosed = () => {
  if (!dialog.value?.open) close();
};
watch(
  () => player.isLyricsModalVisible,
  (open) => {
    if (open && !dialog.value?.open) dialog.value?.showModal();
    else if (!open && dialog.value?.open) dialog.value.close();
  },
  { flush: "post" },
);
onMounted(() => {
  if (player.isLyricsModalVisible) dialog.value?.showModal();
});
</script>
<style scoped>
.lyrics-dialog {
  transition: none;
}
.lyrics-dialog .modal-box {
  max-height: 88dvh;
}
</style>
