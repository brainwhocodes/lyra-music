
<script setup lang="ts">
import { usePlayerStore, type QueueContext } from '~/stores/player';
import type { Track } from '~/types/track'; 
import AlbumCard from '~/components/album/album-card.vue';
import type { Album } from '~/types/album';
import { resolveCoverArtUrl } from '~/utils/formatters';
import { useRouter } from 'vue-router';
import OptionsMenu from '~/components/options-menu.vue'; 
import type { Playlist } from '~/types/playlist'; 

definePageMeta({
  layout: 'sidebar-layout'
});

const route = useRoute();
const playerStore = usePlayerStore();
const artistId = computed(() => route.params.id as string);
const router = useRouter();
const isProcessingArtistAction = ref(false); 
const loadingAlbumIdForPlay = ref<string | null>(null); // For individual album card loading state

// State for "Add Artist to Playlist" functionality
const playlists = ref<Playlist[]>([]);
const isAddArtistToPlaylistModalOpen = ref(false);
interface ArtistAlbum {
  id: string;
  title: string;
  year: number | null;
  cover_path: string | null;
  albumArtistId: string | null; // ID of the album's primary artist
  albumArtistName: string | null; // Name of the album's primary artist
}

interface ArtistDetails {
  id: string;
  name: string;
  artistImage: string | null;
  albums: ArtistAlbum[];
}

const { data: artist, pending, error } = await useLazyFetch<ArtistDetails>(`/api/artists/${artistId.value}`);

watch(artist, () => {
  if (artist.value) {
    useSeoMeta({
      title: usePageTitle(`Artists | ${artist.value.name}`),
    });
  }
});

if (artist.value) {
  console.log('Artist data:', artist.value); 
  useSeoMeta({
    title: usePageTitle(`Artists | ${artist.value.name}`),
  });
}

const getArtistImageUrl = (imagePath: string | null): string => {
  const defaultImage = '/images/icons/default-artist-art.webp';
  if (!imagePath) return defaultImage;
  return imagePath;
};

const navigateToAlbum = (albumId: string) => {
  router.push(`/albums/${albumId}`);
};

const mappedAlbums = computed((): Album[] => {
  if (!artist.value || !artist.value.albums) {
    return [];
  }
  return artist.value.albums.map((artistAlbum: ArtistAlbum): Album => ({
    albumId: artistAlbum.id,
    title: artistAlbum.title,
    year: artistAlbum.year,
    coverPath: resolveCoverArtUrl(artistAlbum.cover_path),
    artists: artistAlbum.albumArtistId && artistAlbum.albumArtistName 
               ? [{ 
                   artistId: artistAlbum.albumArtistId, 
                   name: artistAlbum.albumArtistName, 
                   isPrimaryArtist: true 
                 }]
               : [],
    // artistId: artistAlbum.albumArtistId || '', // This was for the old Album type, 'artists' array is now preferred
    // tracks: [] // tracks is optional in Album type, can be omitted if not readily available
  }));
});

async function fetchPlaylists(): Promise<void> {
  try {
    const data = await $fetch<Playlist[]>('/api/playlists');
    playlists.value = data;
  } catch (e: unknown) {
    console.error('Error fetching playlists:', e);
    playlists.value = [];
  }
}

onMounted(() => {
  fetchPlaylists(); 
});

async function getAllArtistTracks(): Promise<Track[]> {
  if (!artist.value || !artist.value.albums || artist.value.albums.length === 0) {
    return [];
  }
  isProcessingArtistAction.value = true;
  let allTracks: Track[] = [];
  try {
    for (const artistAlbum of artist.value.albums) {
      const albumDetails = await $fetch<{ albumId: string; title: string; artistName?: string; coverPath: string | null; tracks: Track[] }>(`/api/albums/${artistAlbum.id}`);
      if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
        const tracksFromThisAlbum = albumDetails.tracks.map((t: any): Track => {
          const primaryArtistName = t.artistName ?? artist.value?.name ?? 'Unknown Artist';
          const primaryArtistId = t.artistId ?? artist.value?.id;
          return {
            trackId: t.trackId,
            trackNumber: t.trackNumber,
            title: t.title,
            filePath: t.filePath,
            duration: t.duration,
            albumId: albumDetails.albumId,
            genre: t.genre,
            year: t.year,
            diskNumber: t.diskNumber,
            explicit: t.explicit ?? false, // Default to false if null
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
            // Populate the required 'artists' array
            artists: primaryArtistId ? [{ artistId: primaryArtistId, name: primaryArtistName, isPrimaryArtist: true }] : [],
            // Optional convenience fields (can keep them if used elsewhere or for backward compatibility)
            artistName: primaryArtistName,
            artistId: primaryArtistId,
            albumTitle: t.albumTitle ?? albumDetails.title ?? 'Unknown Album',
            coverPath: resolveCoverArtUrl(t.coverPath ?? albumDetails.coverPath),
            musicbrainzTrackId: t.musicbrainzTrackId,
          };
        });
        allTracks = allTracks.concat(tracksFromThisAlbum);
      }
    }
  } catch (fetchError) {
    console.error("Error fetching all artist tracks:", fetchError);
    allTracks = [];
  } finally {
    isProcessingArtistAction.value = false;
  }
  return allTracks;
}

const playArtist = async (): Promise<void> => {
  const tracks = await getAllArtistTracks();
  if (tracks.length > 0 && artist.value) {
    const context: QueueContext = { type: 'artist', id: artist.value.id, name: artist.value.name };
    playerStore.loadQueue(tracks, context, true, 0, false);
  } else if (artist.value) {
    console.log(`No playable tracks found for ${artist.value.name}.`);
  }
};

const shufflePlayArtist = async (): Promise<void> => {
  const tracks = await getAllArtistTracks();
  if (tracks.length > 0 && artist.value) {
    const context: QueueContext = { type: 'artist', id: artist.value.id, name: artist.value.name };
    playerStore.loadQueue(tracks, context, true, 0, true);
  } else if (artist.value) {
     console.log(`No playable tracks found for ${artist.value.name} to shuffle.`);
  }
};

const addArtistTracksToQueue = async (): Promise<void> => {
  const tracks = await getAllArtistTracks();
  if (tracks.length > 0 && artist.value) {
    playerStore.addTracksToQueue(tracks);
    console.log(`Added all tracks by ${artist.value.name} to queue.`);
  } else if (artist.value) {
    console.log(`No playable tracks found for ${artist.value.name} to add to queue.`);
  }
};

const artistOptions = computed(() => {
  if (!artist.value) return [];
  return [
    { id: 'add-artist-to-playlist', label: `Add ${artist.value.name}'s music to Playlist`, icon: 'mdi:playlist-music' },
    // Future options can be added here
  ];
});

const openAddArtistToPlaylistModal = (): void => {
  fetchPlaylists(); 
  isAddArtistToPlaylistModalOpen.value = true;
};

const handleArtistOption = (optionId: string): void => {
  switch (optionId) {
    case 'add-artist-to-playlist':
      openAddArtistToPlaylistModal();
      break;
    default:
      console.warn('Unknown artist option:', optionId);
  }
};

const addAllArtistTracksToPlaylist = async (playlistId: string): Promise<void> => {
  if (!artist.value) return;
  const tracks = await getAllArtistTracks(); 
  
  if (tracks.length > 0) {
    try {
      await $fetch(`/api/playlists/${playlistId}/tracks`, {
        method: 'POST',
        body: { action: 'add', trackIds: tracks.map(t => t.trackId) },
      });
      console.log(`${artist.value.name}'s music added to playlist.`); // Keep existing log
    } catch (e) {
      console.error('Error adding artist tracks to playlist:', e);
    }
  }
  isAddArtistToPlaylistModalOpen.value = false;
};

const playAlbum = async (albumIdToPlay: string): Promise<void> => {
  console.log(`[ArtistPage] playAlbum: Attempting to play album ID: ${albumIdToPlay}`);
  if (!albumIdToPlay) {
    console.warn('[ArtistPage] playAlbum: albumIdToPlay is null or undefined.');
    return;
  }

  loadingAlbumIdForPlay.value = albumIdToPlay;
  try {
    // Check if the clicked album is already playing/paused
    if (playerStore.currentTrack?.albumId === albumIdToPlay) {
      console.log(`[ArtistPage] playAlbum: Toggling play/pause for already loaded album: ${albumIdToPlay}`);
      playerStore.togglePlayPause();
    } else {
      console.log(`[ArtistPage] playAlbum: Fetching details for album: ${albumIdToPlay}`);
      const albumDetails = await $fetch<{ albumId: string; title: string; artistName?: string; coverPath: string | null; tracks: Track[] }>(`/api/albums/${albumIdToPlay}`);
      console.log(`[ArtistPage] playAlbum: API response for ${albumIdToPlay}:`, albumDetails);

      if (albumDetails && albumDetails.tracks && albumDetails.tracks.length > 0) {
        const tracksToPlay = albumDetails.tracks.map((t: any): Track => {
          const primaryArtistName = t.artistName ?? albumDetails.artistName ?? 'Unknown Artist';
          const primaryArtistId = t.artistId ?? (artist.value ? artist.value.id : undefined);
          return {
            trackId: t.trackId,
            trackNumber: t.trackNumber,
            title: t.title,
            filePath: t.filePath,
            duration: t.duration,
            albumId: albumDetails.albumId,
            genre: t.genre,
            year: t.year,
            diskNumber: t.diskNumber,
            explicit: t.explicit ?? false,
            createdAt: t.createdAt, // Assuming t.createdAt exists from API
            updatedAt: t.updatedAt, // Assuming t.updatedAt exists from API
            artists: primaryArtistId ? [{ artistId: primaryArtistId, name: primaryArtistName, isPrimaryArtist: true }] : [],
            artistName: primaryArtistName,
            artistId: primaryArtistId,
            albumTitle: t.albumTitle ?? albumDetails.title ?? 'Unknown Album',
            coverPath: resolveCoverArtUrl(t.coverPath ?? albumDetails.coverPath),
            musicbrainzTrackId: t.musicbrainzTrackId, // Assuming t.musicbrainzTrackId exists from API
          };
        });
        const context: QueueContext = { type: 'album', id: albumDetails.albumId, name: albumDetails.title };
        console.log(`[ArtistPage] playAlbum: Calling playerStore.loadQueue with context:`, context, 'and tracks:', tracksToPlay);
        playerStore.loadQueue(tracksToPlay, context, true, 0);
      } else {
        console.warn(`[ArtistPage] playAlbum: No tracks found for album ${albumIdToPlay}`);
      }
    }
  } catch (err) {
    console.error(`[ArtistPage] playAlbum: Error playing album ${albumIdToPlay}:`, err);
  } finally {
    loadingAlbumIdForPlay.value = null;
  }
};

const handlePlayAlbumEvent = (album: Album): void => {
  console.log(`[ArtistPage] handlePlayAlbumEvent: Received play event for album:`, album);
  if (album && album.albumId) {
    playAlbum(album.albumId);
  } else {
    console.warn('[ArtistPage] handlePlayAlbumEvent: Invalid album data received.');
  }
};
</script>

<template>
  <div class="container mx-auto px-4 py-8">
    <div v-if="pending" class="text-center">
      <span class="loading loading-spinner loading-lg"></span>
    </div>
    <div v-else-if="error" class="alert alert-error shadow-lg">
      <div>
        <Icon name="material-symbols:error-outline-rounded" class="w-6 h-6"/>
        <span>Error loading artist details: {{ error.message }}</span>
      </div>
    </div>
    <div v-else-if="artist">
      <div class="flex flex-col md:flex-row gap-6 items-center mb-6">
        <!-- Artist Image -->
        <div class="w-48 h-48 rounded-full overflow-hidden bg-base-200 flex-shrink-0">
          <img 
            :src="getArtistImageUrl(artist.artistImage)" 
            :alt="artist.name" 
            class="w-full h-full object-cover"
          />
        </div>
        
        <!-- Artist Info -->
        <div>
          <h1 class="text-4xl font-bold">{{ artist.name }}</h1>
          <p v-if="artist.albums" class="text-base-content/70 mt-2">
            {{ artist.albums.length }} {{ artist.albums.length === 1 ? 'album' : 'albums' }}
          </p>
          <div class="mt-4 flex flex-wrap gap-2 items-center">
            <button @click="playArtist" class="btn btn-primary" :disabled="isProcessingArtistAction || !artist?.albums?.length">
              <Icon v-if="!isProcessingArtistAction" name="material-symbols:play-arrow-rounded" class="w-5 h-5 mr-1" />
              <span v-if="isProcessingArtistAction" class="loading loading-spinner loading-xs mr-2"></span>
              Play Artist
            </button>
            <button @click="shufflePlayArtist" class="btn btn-secondary" :disabled="isProcessingArtistAction || !artist?.albums?.length">
              <Icon v-if="!isProcessingArtistAction" name="material-symbols:shuffle-rounded" class="w-5 h-5 mr-1" />
              <span v-if="isProcessingArtistAction" class="loading loading-spinner loading-xs mr-2"></span>
              Shuffle
            </button>
            <button @click="addArtistTracksToQueue" class="btn btn-ghost" :disabled="isProcessingArtistAction || !artist?.albums?.length">
              <Icon v-if="!isProcessingArtistAction" name="material-symbols:playlist-add-rounded" class="w-5 h-5 mr-1" />
              <span v-if="isProcessingArtistAction" class="loading loading-spinner loading-xs mr-2"></span>
              Add to Queue
            </button>
            <OptionsMenu
              :options="artistOptions"
              @select="handleArtistOption"
              button-class="btn btn-ghost"
              :disabled="isProcessingArtistAction || !artist?.albums?.length || !artistOptions.length"
            >
              <Icon name="material-symbols:more-vert" class="w-5 h-5" />
            </OptionsMenu>
          </div>
        </div>
      </div>

      <h2 class="text-2xl font-semibold mb-4">Albums</h2>
      <div v-if="mappedAlbums.length > 0" class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
        <AlbumCard 
          v-for="albumItem in mappedAlbums" 
          :key="albumItem.albumId" 
          :album="albumItem"
          :is-playing-this-album="playerStore.isPlaying && playerStore.currentTrack?.albumId === albumItem.albumId"
          :is-loading-this-album="loadingAlbumIdForPlay === albumItem.albumId"
          @cardClick="navigateToAlbum(albumItem.albumId)" 
          @play="handlePlayAlbumEvent" 
        />
      </div>
      <div v-else>
        <p class="text-neutral-content italic">No albums found for this artist.</p>
      </div>

    </div>
     <div v-else>
       <p class="text-center text-neutral-content italic">Artist not found.</p>
     </div>

    <!-- Modal for Add Artist to Playlist -->
    <div v-if="isAddArtistToPlaylistModalOpen" class="modal modal-open">
      <div class="modal-box">
        <h3 class="font-bold text-lg">Add {{ artist?.name }}'s music to Playlist</h3>
        <div v-if="playlists.length > 0" class="max-h-60 overflow-y-auto">
          <ul class="menu p-2 rounded-box">
            <li v-for="playlist in playlists" :key="playlist.playlistId">
              <a @click="addAllArtistTracksToPlaylist(playlist.playlistId)">{{ playlist.name }}</a>
            </li>
          </ul>
        </div>
        <p v-else class="py-4">You have no playlists. Create one first!</p>
        <div class="modal-action">
          <button class="btn btn-ghost" @click="isAddArtistToPlaylistModalOpen = false">Cancel</button>
        </div>
      </div>
    </div>

  </div>
</template>