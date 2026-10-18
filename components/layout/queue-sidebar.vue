<template>
  <aside class="queue-sidebar" aria-label="Playback queue">
    <button
      class="btn btn-ghost queue-close"
      aria-label="Close queue"
      @click="player.toggleQueueSidebar"
    >
      Close</button
    ><QueueList />
  </aside>
</template>
<script setup lang="ts">
import { usePlayerStore } from "~/stores/player";
import QueueList from "~/components/player/queue-list.vue";
const player = usePlayerStore();
</script>
<style scoped>
.queue-sidebar {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 384px;
  padding: 1.5rem 1.25rem 13rem;
  overflow-y: auto;
  background: var(--paper);
  border-left: 1px solid var(--rule);
  z-index: 40;
}
.queue-close {
  display: block;
  margin: 0 0 1rem auto;
}
</style>
