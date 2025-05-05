<template>
  <div class="flex h-screen bg-base-200">
    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-base-100 p-4 flex flex-col text-base-content shadow-lg overflow-y-auto">
      <!-- ... (Sidebar content remains the same: Otogami title, Recommend, Play List, Tag sections, User/Settings) ... -->
      <h2 class="text-xl font-bold mb-6 text-primary">Otogami</h2>

      <!-- Recommend Section -->
      <nav class="mb-auto">
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mb-2">Recommend</h3>
        <ul>
          <li><NuxtLink to="/libraries" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1 !bg-base-300 font-semibold"><Icon name="material-symbols:explore-outline-rounded" class="w-5 h-5" /> Discovery</NuxtLink></li>
          <li><NuxtLink to="/albums" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:album-outline" class="w-5 h-5" /> Albums</NuxtLink></li>
          <li><NuxtLink to="/artists" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:artist-outline" class="w-5 h-5" /> Artists</NuxtLink></li>
          <li><NuxtLink to="/genres" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:label-outline" class="w-5 h-5" /> Genres</NuxtLink></li>
           <li><NuxtLink to="/tracks" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:music-note-outline" class="w-5 h-5" /> Tracks</NuxtLink></li>
           <!-- Add more links like Date Uploaded, Folder, Trash later -->
        </ul>

        <!-- Play List Section (Example) -->
        <h3 class="text-xs uppercase font-semibold text-base-content/60 mt-6 mb-2">Play List</h3>
         <ul>
           <li><NuxtLink to="/playlists/recent" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:history" class="w-5 h-5" /> Recently Played</NuxtLink></li>
           <li><NuxtLink to="/playlists/liked" class="flex items-center gap-3 p-2 rounded-lg hover:bg-base-300 mb-1"><Icon name="material-symbols:thumb-up-outline" class="w-5 h-5" /> Thumbs Up</NuxtLink></li>
           <!-- Add button to create playlists -->
         </ul>

          <!-- Tag Section (Example) -->
          <h3 class="text-xs uppercase font-semibold text-base-content/60 mt-6 mb-2">Tag</h3>
          <div class="flex flex-wrap gap-2">
            <span class="badge badge-primary badge-outline cursor-pointer">Blues</span>
            <span class="badge badge-secondary badge-outline cursor-pointer">Country</span>
            <span class="badge badge-accent badge-outline cursor-pointer">Pop</span>
             <!-- Add button to create tags -->
          </div>
      </nav>

      <!-- User/Settings Footer -->
       <div class="mt-auto border-t border-base-300 pt-4">
        <!-- Placeholder -->
        User Settings
       </div>
    </aside>

    <!-- Main Content Area -->
    <main class="flex-1 p-6 overflow-y-auto">
      <!-- Top Bar: Search + Sort + User -->
      <div class="flex justify-between items-center mb-6 sticky top-0 bg-base-200/80 backdrop-blur py-2 z-10">
         <div class="form-control">
           <input type="text" placeholder="Search Library or Anything" class="input input-bordered w-72 md:w-96" />
         </div>
        <div class="flex items-center gap-4">
          <select class="select select-bordered select-sm">
            <option disabled selected>Sorted By: A-Z</option>
            <option>Date Added</option>
            <option>Most Played</option>
            <option>Release Year</option>
          </select>
           <button class="btn btn-ghost btn-circle">
             <Icon name="material-symbols:settings-outline" class="w-6 h-6" />
           </button>
           <div class="dropdown dropdown-end">
              <div tabindex="0" role="button" class="btn btn-ghost btn-circle avatar">
                <div class="w-10 rounded-full">
                  <img alt="User Avatar" src="https://daisyui.com/images/stock/photo-1534528741775-53994a69daeb.jpg" />
                </div>
              </div>
              <ul tabindex="0" class="mt-3 z-[1] p-2 shadow menu menu-sm dropdown-content bg-base-100 rounded-box w-52">
                <li><NuxtLink to="/profile">Profile</NuxtLink></li>
                <li><NuxtLink to="/settings">Settings</NuxtLink></li>
                 <li><hr class="my-1" /></li>
                <li><a>Logout</a></li>
              </ul>
            </div>
        </div>
      </div>

      <!-- Album Grid -->
      <div v-if="pendingAlbums" class="text-center py-10">
         <span class="loading loading-spinner loading-lg"></span>
      </div>
       <div v-else-if="albumsError" class="alert alert-error">
          <Icon name="mdi:alert-circle-outline" class="w-6 h-6" />
          <span>Error loading albums: {{ albumsError.message }}</span>
       </div>
       <div v-else-if="albums && albums.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4">
          <div v-for="album in albums" :key="album.id" class="card card-compact bg-base-100 shadow-md hover:shadow-xl transition-shadow duration-300 group">
             <figure class="relative">
               <img :src="getCoverArtUrl(album.artPath)" @error="setDefaultCover" alt="Album Art" class="aspect-square object-cover w-full" />
                <!-- Play button overlay (example) -->
                <button class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                   <Icon name="material-symbols:play-arrow-rounded" class="w-12 h-12 text-white" />
                </button>
             </figure>
             <div class="card-body p-3">
               <NuxtLink :to="`/albums/${album.id}`" class="card-title text-sm truncate link link-hover" :title="album.title">
                  {{ album.title }}
               </NuxtLink>
               <NuxtLink :to="`/artists/${album.artistId}`" class="text-xs text-base-content/70 truncate link link-hover" :title="album.artistName">
                  {{ album.artistName }}
                </NuxtLink>
             </div>
          </div>
       </div>
       <div v-else class="text-center text-gray-500 py-10">
          No albums found in the library. Add media folders in Settings.
       </div>
    </main>
  </div>

   <!-- Global Audio Player Placeholder - To be implemented in layout -->
   <!-- <AudioPlayer /> -->
</template>

<script setup lang="ts">
import { ref } from 'vue'

// Define interfaces
interface Album {
  id: number;
  title: string;
  artPath: string | null;
  artistId: number | null;
  artistName: string; // Assume artist name is always joined
}

// Fetch Albums
// Using simpler fetch for now, can enhance later
const { data: albums, pending: pendingAlbums, error: albumsError } = useFetch<Album[]>('/api/library/albums', {
  lazy: true,
  server: false // Fetch on client-side only
});

// Function to get cover art URL (adjust path as needed)
function getCoverArtUrl(artPath: string | null): string {
  // TODO: Determine the correct base URL or prefix for serving cover art
  // This might involve a dedicated API endpoint or configuring Nuxt Image
  if (artPath) {
    // Assuming artPath is relative to a public dir or served via API
    // Example: return `/api/covers/${encodeURIComponent(artPath)}`;
    // Placeholder: return a default image if path exists but is invalid for now
    return `https://via.placeholder.com/150/771796`; // Placeholder
  }
  // Return a default placeholder image if artPath is null
  return 'https://via.placeholder.com/150/CCCCCC?text=No+Art';
}

// Fallback for image loading errors
function setDefaultCover(event: Event) {
  const target = event.target as HTMLImageElement;
  target.src = 'https://via.placeholder.com/150/CCCCCC?text=Error'; // Default on error
}

// Define page meta if needed
// definePageMeta({ middleware: 'auth' }); // Uncomment if auth middleware is ready

</script>

<style scoped>
/* Add scrollbar styling if needed */
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
