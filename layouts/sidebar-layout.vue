<template>
  <div
    class="app-shell"
    :class="{
      'has-player': !!playerStore.currentTrack,
      'queue-open': playerStore.isQueueSidebarVisible && !isNarrow,
      'narrow-layout': ready && isNarrow,
    }"
  >
    <span ref="fontMeasure" class="font-measure" aria-hidden="true" />
    <a class="skip-link" href="#library-content">Skip to content</a>
    <aside class="app-sidebar"><LyraBrand /><NavLinks /></aside>
    <dialog
      ref="drawer"
      class="mobile-drawer"
      aria-label="Navigation"
      @close="drawerOpen = false"
    >
      <div class="drawer-heading">
        <LyraBrand /><button
          class="btn btn-ghost"
          autofocus
          @click="closeDrawer"
          aria-label="Close navigation"
        >
          Close
        </button>
      </div>
      <NavLinks @navigate="closeDrawer" />
    </dialog>
    <div class="app-main">
      <header class="app-topbar">
        <button
          class="btn btn-ghost menu-toggle"
          aria-label="Open navigation menu"
          :aria-expanded="drawerOpen"
          @click="openDrawer"
        >
          Menu</button
        ><LyraBrand class="mobile-brand" />
        <div class="search-slot"><OmniSearch v-model="searchQuery" /></div>
        <NuxtLink to="/explore" class="btn btn-ghost">Explore</NuxtLink>
      </header>
      <main id="library-content" class="app-page" tabindex="-1"><slot /></main>
    </div>
    <FullScreenPlayer
      v-if="
        ready &&
        playerStore.isFullScreenPlayerVisible &&
        playerStore.currentTrack
      "
    />
    <MiniPlayer v-if="ready && isNarrow && playerStore.currentTrack" />
    <GlobalAudioPlayer v-if="ready && !isNarrow && playerStore.currentTrack" />
    <QueueSidebar
      v-if="ready && !isNarrow && playerStore.isQueueSidebarVisible"
    />
    <LyricsModal />
    <LazyLayoutToastContainer />
  </div>
</template>
<script setup lang="ts">
import NavLinks from "~/components/layout/nav-links.vue";
import OmniSearch from "~/components/ui/omni-search.vue";
import GlobalAudioPlayer from "~/components/player/global-audio-player.vue";
import MiniPlayer from "~/components/player/mini-player.vue";
import FullScreenPlayer from "~/components/player/full-screen-player.vue";
import QueueSidebar from "~/components/layout/queue-sidebar.vue";
import LyricsModal from "~/components/modals/lyrics-modal.vue";
import { usePlayerStore } from "~/stores/player";
import {
  useTrackWaveform,
  trackWaveformKey,
} from "~/composables/useTrackWaveform";
const playerStore = usePlayerStore();
provide(
  trackWaveformKey,
  useTrackWaveform(
    computed(() => playerStore.currentTrack?.trackId || null),
    computed(
      () =>
        playerStore.currentQueueContext.type !== "podcast" &&
        !playerStore.currentTrack?.audioUrl,
    ),
  ),
);
const searchQuery = ref("");
const drawer = ref<HTMLDialogElement | null>(null);
const drawerOpen = ref(false);
const ready = ref(false);
const isNarrow = ref(false);
const fontMeasure = ref<HTMLElement | null>(null);
const closeDrawer = () => drawer.value?.close();
const openDrawer = () => {
  drawer.value?.showModal();
  drawerOpen.value = true;
};
let fontObserver: ResizeObserver | undefined;
const resize = () => {
  // Reserve the same usable text width when a listener enlarges their fonts.
  const rootSize =
    parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  isNarrow.value = window.innerWidth < 64 * rootSize;
  if (!isNarrow.value) closeDrawer();
};
onMounted(() => {
  resize();
  window.addEventListener("resize", resize);
  fontObserver = new ResizeObserver(resize);
  if (fontMeasure.value) fontObserver.observe(fontMeasure.value);
  ready.value = true;
});
onUnmounted(() => {
  window.removeEventListener("resize", resize);
  fontObserver?.disconnect();
});
const route = useRoute();
watch(() => route.path, closeDrawer);
</script>
