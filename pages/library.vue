<template>
  <div class="w-full h-full p-4 bg-base-200 overflow-y-auto scrollbar-thin">
    <LibraryHeader @search="handleSearch" @sort="handleSort" />

    <!-- Content Sections -->
    <div class="mt-4 space-y-8">
      <!-- Artists Section -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">Artists</h2>
          <NuxtLink to="/artists" class="btn btn-ghost btn-sm">View All</NuxtLink>
        </div>
        <ArtistGrid />
      </section>

      <!-- Albums Section -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">Albums</h2>
          <NuxtLink to="/albums" class="btn btn-ghost btn-sm">View All</NuxtLink>
        </div>
        <AlbumGrid 
          :albums="limitedAlbums" 
          :pending="pendingAlbums"
          :error="albumsError"
          @play="handleAlbumPlayEvent"
          @add-to-playlist="openAddToPlaylistModal"
          @edit-album="handleEditAlbum"
          @navigate-to-album="navigateToAlbum"
        />
      </section>

      <!-- Playlists Section -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">Playlists</h2>
          <NuxtLink to="/playlists" class="btn btn-ghost btn-sm">View All</NuxtLink>
        </div>
        <PlaylistGrid />
      </section>

      <!-- Genres Section -->
      <section>
        <div class="flex justify-between items-center mb-4">
          <h2 class="text-2xl font-bold">Genres</h2>
          <NuxtLink to="/genres" class="btn btn-ghost btn-sm">View All</NuxtLink>
        </div>
        <GenreGrid :limit="6" />
      </section>
    </div>

    <!-- Add to Playlist Modal -->
    <div v-if="isAddToPlaylistModalOpen" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg mb-4">
          Add "{{ selectedAlbumForPlaylist?.title }}" to playlist:
        </h3>
        <button 
          @click="isAddToPlaylistModalOpen = false" 
          class="btn btn-sm btn-circle btn-ghost absolute right-2 top-2"
        >✕</button>
        
        <div v-if="!playlists.length" class="text-center text-neutral-content italic py-4">
          <p>No playlists found. <NuxtLink to="/playlists" class="link link-primary">Create one?</NuxtLink></p>
        </div>
        <ul v-else class="menu bg-base-100 rounded-box max-h-60 overflow-y-auto">
          <li v-for="playlist in playlists" :key="playlist.playlistId">
            <a @click="addAlbumToPlaylist(playlist.playlistId)">
              {{ playlist.name }}
            </a>
          </li>
        </ul>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="isAddToPlaylistModalOpen = false">Cancel</button>
        </div>
      </div>
      <!-- Click outside to close -->
      <div class="modal-backdrop" @click="isAddToPlaylistModalOpen = false"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from '#imports'
import LibraryHeader from '~/components/library/library-header.vue'
import { useNotification } from '~/composables/useNotification'
import { usePlayerStore } from '~/stores/player';
import { useTrackArtists } from '~/composables/useTrackArtists';
import type { Track } from '~/types/track';
import AlbumGrid from '~/components/library/album-grid.vue'; 
import PlaylistGrid from '~/components/library/playlist-grid.vue';
import ArtistGrid from '~/components/library/artist-grid.vue';
import GenreGrid from '~/components/library/genre-grid.vue';
import type { Album } from '~/types/album';
import type { TrackArtistDetail } from '~/types/track';
import type { Playlist } from '~/types/playlist';
import { usePlaylists } from '~/composables/usePlaylists';


// Apply the sidebar layout
definePageMeta({
  layout: 'sidebar-layout'
});

const playerStore = usePlayerStore(); 

// Refs for play button loading state
const currentAlbumLoading = ref<boolean>(false);
const albumIdLoading = ref<string | null>(null);

// State for Album Operations
const selectedAlbumForPlaylist = ref<Album | null>(null);
const isAddToPlaylistModalOpen = ref<boolean>(false);
const { playlists, fetchPlaylists } = usePlaylists();
const { showNotification } = useNotification();

// Search State
const searchQuery = ref('');
const handleSearch = (query: string) => {
  searchQuery.value = query;
};

// Sort State
const sortBy = ref('title-asc');
const handleSort = (newSortBy: string) => {
  sortBy.value = newSortBy;
};





// Fetch Albums
const { 
  data: albums, 
  pending: pendingAlbums,
  error: albumsError, 
} = useLazyFetch<Album[]>('/api/albums');

const filteredAlbums = computed(() => {
  if (!albums.value) return [];

  let filtered = albums.value;

  // Filter by Search Query
  if (searchQuery.value) {
    filtered = filtered.filter((album: Album) => 
      album.title.toLowerCase().includes(searchQuery.value.toLowerCase())
    );
  }

  // Sort
  const sorted = [...filtered];
  switch (sortBy.value) {
    case 'title-asc':
      sorted.sort((a, b) => a.title.localeCompare(b.title));
      break;
    case 'title-desc':
      sorted.sort((a, b) => b.title.localeCompare(a.title));
      break;
    case 'release-year-desc':
      sorted.sort((a, b) => (b.year || 0) - (a.year || 0));
      break;
  }

  return sorted;
});

const limitedAlbums = computed(() => {
  if (!filteredAlbums.value) return [];
  return filteredAlbums.value.slice(0, 8);
});

const handleAlbumPlayEvent = async (album: Album): Promise<void> => {
  if (!album || !album.albumId) {
    showNotification('Cannot play album: invalid data.', 'error');
    return;
  }
  await playAlbum(album.albumId); 
};

const playAlbum = async (albumId: string): Promise<void> => {
  if (playerStore.currentTrack?.albumId === albumId) {
    playerStore.togglePlayPause();
    return;
  }

  if (playerStore.queue.length > 0 && playerStore.queue[0].albumId === albumId) {
    if (!playerStore.currentTrack || playerStore.currentTrack.albumId !== albumId) {
        playerStore.playFromQueue(0); 
    } else {
        playerStore.togglePlayPause();
    }
    return;
  }

  albumIdLoading.value = albumId;
  currentAlbumLoading.value = true;

  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    const albumDetails = await $fetch<any>(`/api/albums/${albumId}`);

    if (!albumDetails || !albumDetails.tracks || albumDetails.tracks.length === 0) {
      showNotification('No tracks found for this album.', 'info');
      playerStore.loadQueue([]);
      return;
    }

    const { getFormattedTrackArtists } = useTrackArtists();
    
    const tracksForQueue: Track[] = albumDetails.tracks.map((track: any) => {
      const artists = track.artists || [];
      const primaryArtistName = artists.length > 0
        ? artists.find((a: TrackArtistDetail) => a.isPrimaryArtist)?.name || artists[0].name
        : 'Unknown Artist';
        
      return {
        trackId: track.trackId,
        title: track.title ?? 'Unknown Track',
        artistName: primaryArtistName,
        albumTitle: track.albumTitle ?? albumDetails.title ?? 'Unknown Album',
        filePath: track.filePath,
        duration: track.duration ?? 0,
        albumId: albumDetails.albumId,
        trackNumber: track.trackNumber ?? null,
        coverPath: track.coverPath || albumDetails.coverPath,
        formattedArtists: getFormattedTrackArtists(artists),
      };
    });

    playerStore.loadQueue(tracksForQueue);
    playerStore.playFromQueue(0);

  } catch (err) {
    console.error(`Error fetching or playing album ${albumId}:`, err);
    showNotification('Error playing album.', 'error');
  } finally {
    albumIdLoading.value = null;
    currentAlbumLoading.value = false;
  }
};

const navigateToAlbum = (albumId: string): void => {
  navigateTo(`/albums/${albumId}`);
};

const openAddToPlaylistModal = (album: Album): void => {
  selectedAlbumForPlaylist.value = album;
  isAddToPlaylistModalOpen.value = true;
  fetchPlaylists(); 
};

const addAlbumToPlaylist = async (playlistId: string): Promise<void> => {
  if (!selectedAlbumForPlaylist.value) return;
  
  let trackIds: string[] = [];
  if (selectedAlbumForPlaylist.value.tracks && selectedAlbumForPlaylist.value.tracks.length > 0) {
    trackIds = selectedAlbumForPlaylist.value.tracks.map((track: Track) => track.trackId);
  } else {
    showNotification('Loading album tracks...', 'info');
    const albumWithTracks = await loadAlbum(selectedAlbumForPlaylist.value.albumId);
    if (!albumWithTracks?.tracks || albumWithTracks.tracks.length === 0) {
      showNotification('Could not load album tracks', 'error');
      isAddToPlaylistModalOpen.value = false;
      selectedAlbumForPlaylist.value = null;
      return;
    }
    trackIds = albumWithTracks.tracks.map((track: Track) => track.trackId);
  }
  
  await addTracksToPlaylist(playlistId, trackIds);
};

const addTracksToPlaylist = async (playlistId: string, trackIds: string[]): Promise<void> => {
  if (!trackIds.length) return;
  
  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: 'POST',
      body: { action: 'add', trackIds },
    });
    showNotification(`Added to playlist successfully`, 'success');
  } catch (e: unknown) {
    console.error('Error adding tracks to playlist:', e);
    const errorMessage = e && typeof e === 'object' && 'data' in e && e.data && typeof e.data === 'object' && 'message' in e.data ? 
      String(e.data.message) : 'Failed to add to playlist.';
    showNotification(errorMessage, 'error');
  } finally {
    isAddToPlaylistModalOpen.value = false;
    selectedAlbumForPlaylist.value = null;
  }
};

async function loadAlbum(albumId: string): Promise<Album | null> {
  try {
    return await $fetch<Album>(`/api/albums/${albumId}`);
  } catch (error) {
    console.error('Failed to load album details:', error);
    showNotification('Failed to load album details.', 'error');
    return null;
  }
}

const handleEditAlbum = (album: Album): void => {
  navigateTo(`/albums/${album.albumId}/edit`);
};

useSeoMeta({ title: usePageTitle('Library') });

</script>

<style scoped>
.modal-backdrop {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: rgba(0, 0, 0, 0.5);
  z-index: 999;
}

.modal-box {
  position: relative;
  z-index: 1000;
}

.modal.modal-open {
  display: flex;
  justify-content: center;
  align-items: center;
}

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
