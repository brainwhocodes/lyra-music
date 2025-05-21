<template>
  <div class="flex h-screen bg-base-200">
    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-base-100 p-4 flex flex-col text-base-content shadow-lg overflow-y-auto scrollbar-thin">
      <h2 class="text-xl font-bold mb-6 text-primary">Otogami</h2>

      <!-- Recommend Section -->
      <nav class="mb-auto">
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mb-2">Recommend</h3>
        <ul>
           <li><NuxtLink to="/library" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:explore-outline-rounded" class="w-5 h-5" /> Library</NuxtLink></li>
           <li><NuxtLink to="/albums" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:album-outline" class="w-5 h-5" /> Albums</NuxtLink></li>
           <li><NuxtLink to="/artists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:artist-outline" class="w-5 h-5" /> Artists</NuxtLink></li>
           <li><NuxtLink to="/genres" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1" active-class="!bg-base-300 font-semibold"><Icon name="material-symbols:label-outline" class="w-5 h-5" /> Genres</NuxtLink></li>
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
      class="flex-1 p-6 overflow-y-auto"
      :class="{ 'pr-[calc(1.5rem+20rem)]': playerStore.isQueueSidebarVisible }"
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

const playerStore = usePlayerStore();

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
