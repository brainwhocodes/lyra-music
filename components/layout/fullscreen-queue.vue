<template>
  <dialog
    ref="dialog"
    class="queue-overlay"
    aria-label="Playback queue"
    @cancel.prevent="close"
    @close="syncClosed"
  >
    <div class="overlay-inner">
      <header>
        <LyraBrand /><button
          class="btn btn-outline"
          autofocus
          aria-label="Close queue"
          @click="close"
        >
          Close
        </button>
      </header>
      <QueueList />
    </div>
  </dialog>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import QueueList from "~/components/player/queue-list.vue";
const player = usePlayerStore();
const dialog = ref<HTMLDialogElement | null>(null);
const close = () => player.hideFullScreenQueue();
const syncClosed = () => {
  if (!dialog.value?.open) close();
};
watch(
  () => player.isFullScreenQueueVisible,
  (open) => {
    if (open && !dialog.value?.open) dialog.value?.showModal();
    else if (!open && dialog.value?.open) dialog.value.close();
  },
  { flush: "post" },
);
onMounted(() => {
  if (player.isFullScreenQueueVisible) dialog.value?.showModal();
});
</script>
<style scoped>
.queue-overlay {
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
.queue-overlay::backdrop {
  background: var(--paper);
}
.overlay-inner {
  max-width: 700px;
  margin: auto;
}
header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 2rem;
}
</style>
