<template>
  <div class="flex" :style="layoutStyle">
    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-base-100 p-4 flex flex-col text-base-content shadow-lg overflow-y-auto scrollbar-thin">
      <h2 class="text-xl font-bold mb-6 text-primary">Hopeium</h2>

      <!-- Recommend Section -->
      <nav class="mb-auto">
        <ul>
            <li><NuxtLink to="/library" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:explore-outline-rounded" class="w-5 h-5" /> Library</NuxtLink></li>
            <li><NuxtLink to="/albums" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:album-outline" class="w-5 h-5" /> Albums</NuxtLink></li>
            <li><NuxtLink to="/artists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:artist-outline" class="w-5 h-5" /> Artists</NuxtLink></li>
            <li><NuxtLink to="/genres" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:label-outline" class="w-5 h-5" /> Genres</NuxtLink></li>
            <li><NuxtLink to="/playlists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:featured-play-list-outline" class="w-5 h-5" /> Playlists</NuxtLink></li>
          </ul>
      </nav>

      <!-- User/Settings Footer -->
       <div class="mt-auto border-t border-base-300 pt-4">
        <!-- Placeholder for actual user/settings links -->
        <NuxtLink to="/settings" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold">
          <Icon name="material-symbols:settings-outline" class="w-5 h-5" /> Settings
        </NuxtLink>
       </div>
    </aside>

    <!-- Main Content Area -->
    <main 
      :class="['flex-1', 'overflow-y-auto', { 'pr-[calc(var(--spacing)*96)]': playerStore.isQueueSidebarVisible } ]"
    >
      <slot /> <!-- Page content will be injected here -->
    </main>

    <!-- Global Audio Player -->
    <GlobalAudioPlayer />

    <!-- Queue Sidebar -->
    <QueueSidebar v-if="playerStore.isQueueSidebarVisible" />
  </div>
  <!-- Note: Global Audio Player is now handled by this layout -->
</template>

<script setup lang="ts">
import GlobalAudioPlayer from '~/components/player/global-audio-player.vue'; // Import the player
import QueueSidebar from '~/components/layout/queue-sidebar.vue';
import { usePlayerStore } from '~/stores/player';
import { computed } from '#imports';

const playerStore = usePlayerStore();

const playerHeightCss = 'calc(var(--spacing) * 25)'; // Player's height

const layoutStyle = computed(() => {
  if (playerStore.currentTrack) {
    return { height: `calc(100vh - ${playerHeightCss})` };
  }
  return { height: '100vh' };
});

// We'll use onMounted to check auth status to avoid redirect loops during SSR
// This prevents the layout from redirecting during the initial render
onMounted(() => {
  const route = useRoute();
  // Skip auth check if we're already on a public route
  if (route.path === '/login' || route.path === '/register') {
    return;
  }
  
  const authCookie = useCookie<string | null>('auth_token');
  const authStore = useAuthStore();
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
