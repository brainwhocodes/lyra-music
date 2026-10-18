<script setup lang="ts">
import type { Album } from "~/types/album";
import type { Track } from "~/types/track";
import type { Playlist } from "~/types/playlist";
import { usePlaylists } from "~/composables/usePlaylists";
import type { MessageType } from "~/types/message-type";
import { usePlayerStore } from "~/stores/player";
import { useNotification } from "~/composables/useNotification";
import type { QueueContext } from "~/stores/player";
import { useCoverArt } from "~/composables/use-cover-art";

import TrackItem from "~/components/track/track-item.vue";
import AlbumArt from "~/components/album/album-art.vue";
import PlaylistPicker from "~/components/library/playlist-picker.vue";
import EditAlbumModal from "~/components/modals/edit-album-modal.vue";
import OptionsMenu from "~/components/options-menu.vue";
import EditTrackModal from "~/components/modals/edit-track-modal.vue";
import EditLyricsModal from "~/components/modals/edit-lyrics-modal.vue"; // Import the new modal
import ConfirmDeleteModal from "~/components/modals/confirm-delete-modal.vue";
import { useTrackArtists } from "~/composables/useTrackArtists";

// Use the track artists composable for formatting track artists
const {
  formatTrackWithArtists,
  getTrackArtistNameString,
  getFormattedTrackArtists,
} = useTrackArtists();

const route = useRoute();
const playerStore = usePlayerStore();
const albumId = computed(() => route.params.id as string);
const { getCoverArtUrl } = useCoverArt();

// State for "Add to Playlist" functionality
const selectedTrackForPlaylist = ref<Track | null>(null);
const isAddToPlaylistModalOpen = ref(false);
const openMenuForTrackId = ref<string | null>(null);
const { showNotification } = useNotification();
const isAddAlbumToPlaylistModalOpen = ref(false);
const playlistActionPending = ref(false);
const playlistActionError = ref("");
// Template ref for OptionsMenu
const albumOptionsMenuRef = ref<InstanceType<typeof OptionsMenu> | null>(null);
const isEditAlbumModalOpen = ref(false);
const isDeleteAlbumModalOpen = ref(false);

// State for EditTrackModal
const isEditTrackModalOpen = ref(false);
const selectedTrackForEdit = ref<Track | null>(null);

// State for EditLyricsModal
const isEditLyricsModalOpen = ref(false);
const selectedTrackForLyrics = ref<Track | null>(null);

// Apply the sidebar layout
definePageMeta({
  layout: "sidebar-layout",
});

// Fetch album details
const {
  data: album,
  pending,
  error,
} = await useLazyFetch<Album>(`/api/albums/${albumId.value}`);

watch(album, (newAlbum: Album | null) => {
  if (newAlbum) {
    useSeoMeta({
      title: usePageTitle(`Album | ${newAlbum.title}`),
    });
  }
});

if (album.value) {
  useSeoMeta({
    title: usePageTitle(`Album | ${album.value.title}`),
  });
}

const {
  playlists,
  fetchPlaylists,
  loading: loadingPlaylists,
  error: playlistsError,
} = usePlaylists();

// Function to open the "Add to Playlist" modal
const openAddToPlaylistModal = (track: Track): void => {
  playlistActionError.value = "";
  selectedTrackForPlaylist.value = track;
  isAddToPlaylistModalOpen.value = true;
  fetchPlaylists();
};

// Function to add the selected track to a chosen playlist
const addTrackToPlaylist = async (playlistId: string): Promise<void> => {
  if (!selectedTrackForPlaylist.value) return;

  const trackId = selectedTrackForPlaylist.value.trackId;
  const trackTitle = selectedTrackForPlaylist.value.title;
  if (
    await addTracksToPlaylist(
      playlistId,
      [trackId],
      `Track "${trackTitle}" added to playlist.`,
    )
  ) {
    isAddToPlaylistModalOpen.value = false;
    selectedTrackForPlaylist.value = null;
  }
};

// Function to add all album tracks to a playlist
const addAlbumToPlaylist = async (playlistId: string): Promise<void> => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0)
    return;

  const trackIds = album.value.tracks.map((track: Track) => track.trackId);
  if (
    await addTracksToPlaylist(
      playlistId,
      trackIds,
      `Album "${album.value.title}" added to playlist.`,
    )
  ) {
    isAddAlbumToPlaylistModalOpen.value = false;
  }
};

// Generic function to add tracks to a playlist
const addTracksToPlaylist = async (
  playlistId: string,
  trackIds: string[],
  successMessage: string,
): Promise<boolean> => {
  if (!trackIds.length || playlistActionPending.value) return false;
  playlistActionPending.value = true;
  playlistActionError.value = "";

  try {
    await $fetch(`/api/playlists/${playlistId}/tracks`, {
      method: "POST",
      body: {
        action: "add",
        trackIds,
      },
    });
    showNotification(successMessage, "success");
    return true;
  } catch (e: unknown) {
    const errorMessage =
      e &&
      typeof e === "object" &&
      "data" in e &&
      e.data &&
      typeof e.data === "object" &&
      "message" in e.data
        ? String(e.data.message)
        : "Failed to add to playlist.";
    playlistActionError.value = errorMessage;
    return false;
  } finally {
    playlistActionPending.value = false;
  }
};

// Edit Lyrics Modal Handlers
const openEditLyricsModal = (track: Track): void => {
  selectedTrackForLyrics.value = track;
  isEditLyricsModalOpen.value = true;
};

const handleEditLyricsModalClose = (): void => {
  isEditLyricsModalOpen.value = false;
  selectedTrackForLyrics.value = null;
};

const handleLyricsSuccessfullyUpdated =
  (/* updatedLyrics: import('~/types/lyrics').Lyrics */): void => {
    // The modal emits the full Lyrics object, but we might not need to use it directly here
    // if we re-fetch lyrics on demand or if the track object itself doesn't store lyrics.
    showNotification("Lyrics updated successfully.", "success");
    handleEditLyricsModalClose();
  };

const handleEditLyricsModalUpdateError = (errorMessage: string): void => {
  showNotification(`Error updating lyrics: ${errorMessage}`, "error");
  // Optionally, keep the modal open if preferred, or close it.
  // handleEditLyricsModalClose();
};

// Edit Track Modal Handlers
const openEditTrackModal = (track: Track): void => {
  selectedTrackForEdit.value = track;
  isEditTrackModalOpen.value = true;
};

const handleEditTrackModalClose = (): void => {
  isEditTrackModalOpen.value = false;
  selectedTrackForEdit.value = null;
};

const handleTrackSuccessfullyUpdated = (updatedTrack: Track): void => {
  showNotification(
    `Track '${updatedTrack.title}' updated successfully.`,
    "success",
  );
  if (album.value && album.value.tracks) {
    const index = album.value.tracks.findIndex(
      (t: Track) => t.trackId === updatedTrack.trackId,
    );
    if (index !== -1) {
      album.value.tracks[index] = {
        ...album.value.tracks[index],
        ...updatedTrack,
      };
      album.value.tracks = [...album.value.tracks]; // Ensure reactivity by creating a new array instance
    }
  }
  handleEditTrackModalClose();
};

const handleEditTrackModalUpdateError = (errorMessage: string): void => {
  showNotification(`Error updating track: ${errorMessage}`, "error");
};

// Handle track options from TrackItem component
const handleTrackOptions = (options: {
  action: string;
  track: Track;
}): void => {
  const { action, track } = options;

  switch (action) {
    case "add-to-playlist":
      openAddToPlaylistModal(track);
      break;
    case "edit-track":
      openEditTrackModal(track);
      break;
    case "edit-lyrics": // Add new case for editing lyrics
      openEditLyricsModal(track);
      break;
  }

  // Close any open menus
  openMenuForTrackId.value = null;
};

// Computed property to get a display name for the album's artist(s)
const displayAlbumArtistName = computed<string>(() => {
  if (!album.value?.artists?.length) {
    return "Unknown Artist";
  }

  // Get all primary artists
  const primaryArtists = album.value.artists.filter(
    (artist: import("~/types/album").AlbumArtistDetail) =>
      artist.isPrimaryArtist,
  );

  if (primaryArtists.length === 0) {
    // If no primary artists, use all artists
    primaryArtists.push(...album.value.artists);
  }

  if (primaryArtists.length > 3) {
    // If more than 3 artists, show "Various Artists"
    return "Various Artists";
  } else if (primaryArtists.length > 1) {
    // Join multiple artists with commas and '&' for the last one
    return primaryArtists
      .map((artist: import("~/types/album").AlbumArtistDetail) => artist.name)
      .join(", ")
      .replace(/,([^,]*)$/, " &$1");
  }

  // Return single artist name
  return primaryArtists[0].name;
});

// Get all album artists with roles for detailed display
const formattedAlbumArtists = computed(() => {
  if (!album.value?.artists?.length) return [];

  return album.value.artists.map(
    (artist: import("~/types/album").AlbumArtistDetail) => ({
      ...artist,
      url: `/artists/${artist.artistId}`,
      displayRole: "", // Don't display roles, just use commas
      isPrimary: !!artist.isPrimaryArtist,
    }),
  );
});

// Helper to get display artist name from a track's artists array using the composable
const getDisplayArtistNameForTrack = (track: Track): string => {
  // If no artists, use the album's display artist as fallback
  if (!track.artists || track.artists.length === 0) {
    return displayAlbumArtistName.value;
  }

  return getTrackArtistNameString(track);
};

// No longer need the manual helper since we use the composable now

// Create a computed property for tracks that are ready for the player
const playerReadyTracks = computed(() => {
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0)
    return [];

  const albumCover = album.value.coverPath;
  const currentAlbumTitle = album.value.title;

  return album.value.tracks.map((track: Track) => {
    // Pass along original track.artists. Explicitly set formattedArtists and artistName to undefined
    // to ensure the player store handles all formatting.
    return {
      ...track, // This includes the original track.artists array
      albumId: album.value!.albumId,
      albumTitle: track.albumTitle || currentAlbumTitle,
      coverPath: track.coverPath || albumCover,
      formattedArtists: undefined,
      artistName: undefined,
    };
  });
});

// --- Check if this album is currently loaded ---
const isCurrentAlbumLoaded = computed(() => {
  return (
    playerStore.currentQueueContext.type === "album" &&
    playerStore.currentQueueContext.id === album.value?.albumId
  );
});

// --- Album Options Menu ---
const albumOptions = computed(() => [
  {
    id: "add-to-queue",
    label: "Add to Queue",
    icon: "material-symbols:playlist-add",
  },
  {
    id: "add-album-to-playlist",
    label: "Add Album to Playlist",
    icon: "material-symbols:queue-music",
  },
  { id: "edit-album", label: "Edit Album", icon: "material-symbols:edit" },
  {
    id: "delete-album",
    label: "Delete Album",
    icon: "material-symbols:delete-outline",
  },
  // Add more options as needed
]);

const handleAlbumOption = (optionId: string): void => {
  albumOptionsMenuRef.value?.closeMenu(); // Close menu after selection
  switch (optionId) {
    case "add-to-queue":
      handleAddAlbumToQueue();
      break;
    case "add-album-to-playlist":
      openAddAlbumToPlaylistModal();
      break;
    case "edit-album":
      openEditAlbumModal();
      break;
    case "delete-album":
      openDeleteAlbumModal();
      break;
    default:
      console.warn("Unknown album option:", optionId);
  }
};

// New function to handle adding album to queue
const handleAddAlbumToQueue = (): void => {
  if (
    !album.value ||
    !playerReadyTracks.value ||
    playerReadyTracks.value.length === 0
  ) {
    showNotification("No tracks in this album to add to queue.", "info");
    return;
  }

  const albumContext: QueueContext = {
    type: "album",
    id: album.value.albumId,
    name: album.value.title,
  };

  playerStore.addAlbumToQueue(playerReadyTracks.value as Track[], albumContext);
  showNotification(`Album "${album.value.title}" added to queue.`, "success");
  playerStore.showQueueSidebar(); // Optionally show the queue
};

const openAddAlbumToPlaylistModal = (): void => {
  playlistActionError.value = "";
  if (!album.value || !album.value.tracks || album.value.tracks.length === 0) {
    showNotification("No tracks in this album to add to a playlist.", "info");
    return;
  }
  fetchPlaylists(); // Ensure playlists are up-to-date
  isAddAlbumToPlaylistModalOpen.value = true;
};

// --- Click handler for the main cover button ---
const playOrPauseCurrentAlbum = (): void => {
  if (!album.value || !playerReadyTracks.value.length) {
    // TODO: showNotification('No tracks available for this album.', 'info');
    console.warn("Play/Pause: No album or tracks available");
    return;
  }

  const isThisAlbumContextActive =
    playerStore.currentQueueContext.type === "album" &&
    playerStore.currentQueueContext.id === album.value.albumId;

  if (isThisAlbumContextActive) {
    // If this album is already the active context, just toggle play/pause.
    playerStore.togglePlayPause();
  } else {
    // Different album/context is loaded, or nothing is loaded.
    // Load this album and start playing from the first track.
    const newContext: QueueContext = {
      type: "album",
      id: album.value.albumId,
      name: album.value.title,
    };
    playerStore.loadQueue(playerReadyTracks.value, newContext, true, 0);
  }
};

// --- Play a specific track (existing function) ---
const playTrack = (trackIndex: number): void => {
  if (
    !album.value?.albumId ||
    !playerReadyTracks.value.length ||
    trackIndex < 0 ||
    trackIndex >= playerReadyTracks.value.length
  )
    return;

  const trackToPlay = playerReadyTracks.value[trackIndex];
  // Ensure thisAlbumContext matches the QueueContext from the store
  const thisAlbumContext: QueueContext = {
    type: "album",
    id: album.value.albumId,
    name: album.value.title,
  };

  const isSameTrackAndContext =
    playerStore.currentTrack?.trackId === trackToPlay.trackId &&
    playerStore.currentQueueContext.type === thisAlbumContext.type &&
    playerStore.currentQueueContext.id === thisAlbumContext.id;

  if (isSameTrackAndContext) {
    playerStore.togglePlayPause();
  } else {
    // playerReadyTracks should be compatible with the store's Track[] type
    playerStore.loadQueue(playerReadyTracks.value as Track[], thisAlbumContext);
    playerStore.playFromQueue(trackIndex);
  }
};

const openEditAlbumModal = (): void => {
  isEditAlbumModalOpen.value = true;
};

const onAlbumUpdated = (updatedAlbumData: Album): void => {
  if (album.value) {
    // Ensure album.value is not null
    // Merge updated data into the existing album ref
    // This helps preserve reactivity if only parts of the album object are returned
    // or if we want to be selective about what's updated.
    // For a full replacement:
    album.value = { ...album.value, ...updatedAlbumData };
    playerStore.updateAlbumDetailsInPlayer(updatedAlbumData); // Update player store
  }
  isEditAlbumModalOpen.value = false;
  showNotification("Album updated successfully!", "success");
};

const onAlbumUpdateError = (errorMessage: string): void => {
  showNotification(errorMessage || "Failed to update album.", "error");
  // Modal likely closes itself or provides its own error state,
  // but if needed: isEditAlbumModalOpen.value = false;
};

const openDeleteAlbumModal = (): void => {
  isDeleteAlbumModalOpen.value = true;
};

const closeDeleteAlbumModal = (): void => {
  isDeleteAlbumModalOpen.value = false;
};

const confirmDeleteAlbum = async (): Promise<void> => {
  if (!album.value) return;
  try {
    await $fetch(`/api/albums/${album.value.albumId}`, { method: "DELETE" });
    showNotification("Album deleted successfully.", "success");
    navigateTo("/albums");
  } catch (err) {
    console.error("Failed to delete album:", err);
    showNotification("Failed to delete album.", "error");
  } finally {
    closeDeleteAlbumModal();
  }
};
</script>

<template>
  <div class="album-detail-page">
    <nav class="breadcrumbs" aria-label="Breadcrumb">
      <NuxtLink to="/albums">Albums</NuxtLink><span aria-hidden="true">/</span
      ><span>{{ album?.title || "Album" }}</span>
    </nav>
    <UiLoadingSkeleton v-if="pending" label="Loading album…" variant="detail" />
    <p v-else-if="error" role="alert">
      Could not load this album: {{ error.message }}
    </p>
    <template v-else-if="album">
      <header class="detail-hero">
        <AlbumArt :src="album.coverPath" :alt="`${album.title} cover`" />
        <div class="album-info">
          <p class="eyebrow">Album</p>
          <h1 class="page-heading">{{ album.title }}</h1>
          <div class="album-artists">
            <span v-if="!formattedAlbumArtists.length">Unknown artist</span>
            <template
              v-for="(artist, index) in formattedAlbumArtists"
              :key="artist.artistId"
              ><NuxtLink :to="artist.url">{{ artist.name }}</NuxtLink
              ><span v-if="index < formattedAlbumArtists.length - 1"
                >,
              </span></template
            >
          </div>
          <p v-if="album.year" class="album-year">{{ album.year }}</p>
          <div class="album-actions">
            <button
              class="btn btn-primary"
              :disabled="!playerReadyTracks.length"
              @click="playOrPauseCurrentAlbum"
            >
              {{
                isCurrentAlbumLoaded && playerStore.isPlaying
                  ? "Pause album"
                  : "Play album"
              }}
            </button>
            <button
              class="btn btn-outline"
              :disabled="!playerReadyTracks.length"
              @click="openAddAlbumToPlaylistModal"
            >
              Add to playlist
            </button>
            <button class="btn btn-outline" @click="openEditAlbumModal">
              Edit metadata
            </button>
            <OptionsMenu
              ref="albumOptionsMenuRef"
              :options="albumOptions"
              @option-selected="handleAlbumOption"
            />
          </div>
          <p class="album-summary">
            {{ playerReadyTracks.length }}
            {{ playerReadyTracks.length === 1 ? "track" : "tracks" }} ·
            {{
              formatDuration(
                playerReadyTracks.reduce(
                  (total, track) => total + (track.duration || 0),
                  0,
                ),
              )
            }}
          </p>
        </div>
      </header>
      <section class="album-tracks" aria-labelledby="album-tracks-heading">
        <h2 id="album-tracks-heading">Tracks</h2>
        <p v-if="!album.tracks?.length">No tracks found for this album.</p>
        <table v-else class="table w-full">
          <caption class="sr-only">
            Tracks on
            {{
              album.title
            }}
          </caption>
          <tbody>
            <TrackItem
              v-for="(track, index) in album.tracks"
              :key="track.trackId"
              :track="{
                ...track,
                artistName: getDisplayArtistNameForTrack(track),
                albumTitle: album.title,
                coverPath: track.coverPath || album.coverPath,
                formattedArtists: getFormattedTrackArtists(track.artists),
              }"
              :track-number="index + 1"
              :playlists="playlists || []"
              @play-track="playTrack(index)"
              @track-options="handleTrackOptions"
            />
          </tbody>
        </table>
      </section>
      <p class="metadata-note">
        Metadata editable. Changes are saved to your library.
      </p>
      <EditAlbumModal
        :album="album"
        :open="isEditAlbumModalOpen"
        @close="isEditAlbumModalOpen = false"
        @album-updated="onAlbumUpdated"
        @update-error="onAlbumUpdateError"
      />
    </template>
    <p v-else>Album not found.</p>
    <EditTrackModal
      v-if="selectedTrackForEdit"
      :track="selectedTrackForEdit"
      :open="isEditTrackModalOpen"
      @close="handleEditTrackModalClose"
      @track-updated="handleTrackSuccessfullyUpdated"
      @update-error="handleEditTrackModalUpdateError"
    />
    <EditLyricsModal
      v-if="selectedTrackForLyrics"
      :track="selectedTrackForLyrics"
      :open="isEditLyricsModalOpen"
      @close="handleEditLyricsModalClose"
      @lyrics-updated="handleLyricsSuccessfullyUpdated"
      @update-error="handleEditLyricsModalUpdateError"
    />
    <ConfirmDeleteModal
      :open="isDeleteAlbumModalOpen"
      title="Delete Album"
      message="Are you sure you want to delete this album? This action cannot be undone."
      @close="closeDeleteAlbumModal"
      @confirm="confirmDeleteAlbum"
    />
    <PlaylistPicker
      :open="isAddToPlaylistModalOpen"
      :title="`Add ${selectedTrackForPlaylist?.title || 'track'} to playlist`"
      :playlists="playlists"
      :pending="loadingPlaylists"
      :load-error="
        playlistsError ? 'Could not load playlists. Please try again.' : ''
      "
      @retry="fetchPlaylists"
      :busy="playlistActionPending"
      :error="playlistActionError"
      @close="isAddToPlaylistModalOpen = false"
      @select="addTrackToPlaylist"
    />
    <PlaylistPicker
      :open="isAddAlbumToPlaylistModalOpen"
      :title="`Add ${album?.title || 'album'} to playlist`"
      :playlists="playlists"
      :pending="loadingPlaylists"
      :load-error="
        playlistsError ? 'Could not load playlists. Please try again.' : ''
      "
      @retry="fetchPlaylists"
      :busy="playlistActionPending"
      :error="playlistActionError"
      @close="isAddAlbumToPlaylistModalOpen = false"
      @select="addAlbumToPlaylist"
    />
  </div>
</template>
<style scoped>
.breadcrumbs {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
  color: var(--muted, #62594f);
}
.breadcrumbs a {
  min-height: 44px;
  display: inline-flex;
  align-items: center;
}
.detail-hero {
  display: grid;
  grid-template-columns: minmax(200px, 340px) minmax(0, 1fr);
  gap: clamp(1.5rem, 3vw, 3rem);
  align-items: center;
}
.album-info {
  min-width: 0;
}
.album-artists {
  font-family: var(--font-display);
  font-size: clamp(1.7rem, 3vw, 3rem);
  line-height: 1.2;
  overflow-wrap: anywhere;
}
.album-artists a {
  display: inline-block;
  padding: 0.3rem 0;
}
.album-year,
.album-summary {
  color: var(--muted, #62594f);
  margin-top: 1rem;
}
.album-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.75rem;
  margin: 1.75rem 0;
}
.album-actions .btn {
  height: auto;
  min-height: 44px;
  max-width: 100%;
  white-space: normal;
  overflow-wrap: anywhere;
}
.album-tracks {
  margin-top: 0;
  padding-top: 0;
}
.album-tracks h2 {
  font-size: 2rem;
  font-weight: 500;
  margin-bottom: 1rem;
}
.album-tracks table {
  table-layout: auto;
}
.metadata-note {
  border-top: 1px solid var(--line, #c9c1b4);
  margin-top: 2rem;
  padding-top: 1rem;
  font-size: 0.875rem;
  color: var(--muted, #62594f);
}
@media (max-width: 700px) {
  .detail-hero {
    grid-template-columns: 1fr;
  }
  .detail-hero > .album-art {
    width: min(100%, 260px);
  }
  .album-actions {
    gap: 0.6rem;
  }
  .album-tracks :deep(td) {
    padding-inline: 0.4rem;
  }
}
@media (max-width: 440px) {
  .album-tracks :deep(td) {
    padding-inline: 0.2rem;
  }
  .album-tracks :deep(td:first-child),
  .album-tracks :deep(td:last-child) {
    width: 1%;
  }
}
</style>
