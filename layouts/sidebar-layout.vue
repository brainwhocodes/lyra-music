<template>
  <div> <!-- New root div -->
    <FullScreenPlayer v-if="showFullScreenPlayer" />
    <MiniPlayer v-if="showMiniPlayer" />
    <!-- Main application layout (sidebar, content) -->
    <!-- This div is shown when FullScreenPlayer is NOT active -->
    <div v-if="!showFullScreenPlayer" class="relative flex flex-col h-full" :style="layoutStyle"> <!-- Changed to flex-col for mobile header -->
    <!-- Mobile Header with Hamburger -->
    <header v-if="clientReady && isMobileOrTablet" class="bg-base-100 p-2 shadow-md flex items-center z-30">
      <button @click="toggleMobileSidebar" class="btn btn-ghost btn-square btn-sm flex-shrink-0">
        <Icon name="material-symbols:menu-rounded" class="!w-[24px] !h-[24px]" />
      </button>
      <!-- Expanded Search Input -->
      <div v-if="isMobileSearchVisible" class="flex-grow px-2">
        <input
          ref="mobileSearchInput"
          type="text"
          v-model="searchStore.searchQuery"
          placeholder="Search albums..."
          class="input input-sm input-bordered w-full"
          @blur="isMobileSearchVisible = false"
          @click.stop
        />
      </div>

      <!-- Default Header Content -->
      <div v-else class="flex-grow flex items-center">
        <h2 class="text-lg font-bold ml-2 text-primary flex-grow">Lyra Music</h2>
        <button v-if="searchStore.activeSearchContext === 'albums'" @click="showMobileSearch" class="btn btn-ghost btn-square btn-sm flex-shrink-0">
          <Icon name="material-symbols:search-rounded" class="!w-[24px] !h-[24px]" />
        </button>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden"> <!-- New div to wrap sidebar and main for horizontal layout -->
      <!-- Sidebar Navigation -->
      <aside v-if="clientReady" 
        :class="[
          'bg-base-100 p-4 flex flex-col text-base-content shadow-lg overflow-y-auto scrollbar-thin',
          clientReady && {
            // Mobile specific classes
            'fixed top-0 left-0 h-full z-40 transition-transform duration-300 ease-in-out w-64 transform': isMobileOrTablet,
            '-translate-x-full': isMobileOrTablet && !isMobileSidebarOpen,
            'translate-x-0': isMobileOrTablet && isMobileSidebarOpen,
            // Desktop specific classes
            'w-64 relative': !isMobileOrTablet
          }
        ]"
      >
      <h2 class="text-xl font-bold mb-6 text-primary">Lyra Music</h2>

      <!-- Recommend Section -->
      <nav class="mb-auto">
        <ul>
            <li><NuxtLink to="/library" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:explore-outline-rounded" class="w-5 h-5" /> Library</NuxtLink></li>
            <li><NuxtLink to="/albums" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:album-outline" class="w-5 h-5" /> Albums</NuxtLink></li>
            <li><NuxtLink to="/artists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:artist-outline" class="w-5 h-5" /> Artists</NuxtLink></li>
            <li><NuxtLink to="/genres" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:label-outline" class="w-5 h-5" /> Genres</NuxtLink></li>
            <li><NuxtLink to="/playlists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:mood-outline" class="w-5 h-5" /> Playlists</NuxtLink></li>
                        <li><NuxtLink to="/radio" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="ph:radio-fill" class="w-5 h-5" /> Radio</NuxtLink></li>
          </ul>
      </nav>

      <!-- User/Settings Footer -->
       <div class="mt-auto border-t border-base-300 pt-4">
        <!-- User/Settings links -->
        <NuxtLink to="/settings/radio" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold">
          <Icon name="ph:radio-button-bold" class="w-5 h-5" /> Radio Stations
        </NuxtLink>
        <NuxtLink to="/settings" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold">
          <Icon name="material-symbols:settings-outline" class="w-5 h-5" /> General Settings
        </NuxtLink>
       </div>
    </aside>

    <!-- Main Content Area -->
    <main 
      :class="['flex-1', { 'pr-[calc(var(--spacing)*96)]': clientReady && playerStore.isQueueSidebarVisible && !isMobileOrTablet, 'pb-32': showGlobalAudioPlayer } ]" 
      @click="isMobileOrTablet && isMobileSidebarOpen ? toggleMobileSidebar() : null" 
    >
      <slot /> <!-- Page content will be injected here -->
    </main>

    <!-- Queue Sidebar -->
    <QueueSidebar v-if="clientReady && playerStore.isQueueSidebarVisible && !isMobileOrTablet" /> <!-- Hide queue on mobile when sidebar is main focus -->
    </div>
  </div> <!-- End of new div for horizontal layout -->

    <!-- Backdrop for mobile sidebar -->
    <div 
      v-if="clientReady && isMobileOrTablet && isMobileSidebarOpen" 
      @click="toggleMobileSidebar" 
      class="fixed inset-0 bg-black/50 z-30 md:hidden"
    ></div>

    <!-- Global Audio Player (for desktop) -->
    <GlobalAudioPlayer v-if="showGlobalAudioPlayer" />
    <LyricsModal :open="playerStore.isLyricsModalVisible" @close="playerStore.hideLyricsModal()" />
  </div> <!-- End of new root div -->
</template>

<script setup lang="ts">

import GlobalAudioPlayer from '~/components/player/global-audio-player.vue';
import FullScreenPlayer from '~/components/player/full-screen-player.vue';
import MiniPlayer from '~/components/player/mini-player.vue';
import { useSearchStore } from '~/stores/search-store';
import { useRoute } from 'vue-router';
import QueueSidebar from '~/components/layout/queue-sidebar.vue';
import { usePlayerStore } from '~/stores/player';
import LyricsModal from '~/components/modals/lyrics-modal.vue';

const playerStore = usePlayerStore();
const searchStore = useSearchStore();
const route = useRoute(); // Access route information
// No need for storeToRefs for searchQuery here if directly using searchStore.searchQuery in template
const clientReady = ref(false);

const isMobileSidebarOpen = ref(false);
const toggleMobileSidebar = (): void => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value;
};

const isMobileSearchVisible = ref(false);
const mobileSearchInput = ref<HTMLInputElement | null>(null);

const showMobileSearch = async () => {
  isMobileSearchVisible.value = true;
  await nextTick();
  mobileSearchInput.value?.focus();
};


const playerHeightCss = 'calc(var(--spacing) * 25)'; // Player's height (h-32)

const layoutStyle = computed(() => {
  let height = '100vh';
  // On mobile, the main layout (excluding fullscreen player) takes full available height
  // The mini player is an overlay, so it doesn't subtract from this.
  return { height };
});

// We'll use onMounted to check auth status to avoid redirect loops during SSR
// This prevents the layout from redirecting during the initial render
onMounted(() => {
  // Use the 'route' variable already defined in the component's setup scope
  // Skip auth check if we're already on a public route
  if (route.path === '/login' || route.path === '/register') {
    return;
  }
  
  const authCookie = useCookie<string | null>('auth_token');
  // const authStore = useAuthStore(); // Ensure this is defined and imported if used
});

// Screen width detection
const screenWidth = ref(0); // Initialize with 0 to match server behavior, will be updated in onMounted on client
const MOBILE_BREAKPOINT: number = 1024; // Tablet and below

const updateScreenWidth = (): void => {
  if (typeof window !== 'undefined') {
    screenWidth.value = window.innerWidth;
  }
};

onMounted(async () => {
  console.log('[SidebarLayout] onMounted for clientReady: start');
  try {
  if (typeof window !== 'undefined') {
    console.log('[SidebarLayout] Adding resize listener and updating screen width');
    window.addEventListener('resize', updateScreenWidth);
    updateScreenWidth(); // Initialize on mount
    console.log('[SidebarLayout] Screen width updated:', screenWidth.value);
  }
  console.log('[SidebarLayout] Awaiting nextTick');
  await nextTick();
  console.log('[SidebarLayout] nextTick completed');
  clientReady.value = true;
  console.log('[SidebarLayout] clientReady set to true');
} catch (e) {
  console.error('[SidebarLayout] Error in onMounted for clientReady:', e);
}
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateScreenWidth);
  }
});

const isMobileOrTablet = computed<boolean>(() => screenWidth.value < MOBILE_BREAKPOINT);

const showFullScreenPlayer = computed<boolean>(() => {
  return clientReady.value && playerStore.isFullScreenPlayerVisible && isMobileOrTablet.value && !!playerStore.currentTrack;
});

const showMiniPlayer = computed<boolean>(() => {
  return clientReady.value && !playerStore.isFullScreenPlayerVisible && isMobileOrTablet.value && !!playerStore.currentTrack;
});

const showGlobalAudioPlayer = computed<boolean>(() => {
  return clientReady.value && !isMobileOrTablet.value && !!playerStore.currentTrack;
});

// Layout specific script if needed in the future
</script>

<style scoped>
/* Add scrollbar styling consistent with the original page */
.scrollbar-thin {
  scrollbar-width: thin;
  scrollbar-color: oklch(var(--b3)) transparent; /* Adjust colors as needed */
}
/* For Webkit browsers */
.scrollbar-thin::-webkit-scrollbar {
  width: 8px;
  height: 8px; /* For horizontal scroll */
}
.scrollbar-thin::-webkit-scrollbar-track {
  background: transparent;
}
.scrollbar-thin::-webkit-scrollbar-thumb {
  background-color: oklch(var(--b3)); /* Adjust color */
  border-radius: 4px;
  border: 2px solid transparent; /* Creates padding around thumb */
  background-clip: content-box;
}
.scrollbar-thin::-webkit-scrollbar-thumb:hover {
  background-color: oklch(var(--b1)); /* Adjust hover color */
}


</style>
