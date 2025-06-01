// stores/player.ts
import { defineStore } from 'pinia';
import type { Track } from '~/types/track'; // Import consolidated Track type
import type { Album } from '~/types/album'; // Import Album type
import { useTrackArtists } from '~/composables/useTrackArtists';

export interface QueueContext {
  type: 'album' | 'playlist' | 'artist' | 'track' | 'all_tracks' | null;
  id: string | null;
  name?: string; // Optional name for the context (e.g., album title, playlist name)
}

export const usePlayerStore = defineStore('player', () => {
  // State
  const queue = ref<Track[]>([]);
  const currentQueueIndex = ref<number>(-1); // -1 indicates no track selected
  const currentQueueContext = ref<QueueContext>({ type: null, id: null, name: undefined }); // Added for queue context
  const isPlaying = ref<boolean>(false);
  const currentTime = ref<number>(0); // In seconds
  const duration = ref<number>(0); // In seconds
  const volume = ref<number>(0.8); // Default volume (0 to 1)
  const audioElement = ref<HTMLAudioElement | null>(null);
  const isLoading = ref<boolean>(false); // To track if audio is loading
  const isShuffled = ref<boolean>(false);
  const originalQueue = ref<Track[]>([]); // To restore order when shuffle is turned off
  const repeatMode = ref<'none' | 'one' | 'all'>('none');

  // New state for "true shuffle"
  const playedTrackIdsInShuffle = ref<Set<string>>(new Set());

  // State for Queue Sidebar Visibility
  const isQueueSidebarVisible = ref(false); // For desktop/tablet sidebar
  const isFullScreenQueueVisible = ref(false); // For mobile fullscreen queue view

  // State for Full Screen Player Visibility
  const isFullScreenPlayerVisible = ref<boolean>(false);

  // State for Seek Bar Dragging
  const isUserSeeking = ref<boolean>(false);
  const wasPlayingBeforeSeek = ref<boolean>(false);

  // Computed property for the current track
  const currentTrack = computed<Track | null>(() => {
    if (currentQueueIndex.value >= 0 && currentQueueIndex.value < queue.value.length) {
      const track = queue.value[currentQueueIndex.value];
      return track;
    }
    return null;
  });

  const canPlayNext = computed<boolean>(() => {
    if (isShuffled.value) {
      const availableTracks = queue.value.filter((track: Track) => !playedTrackIdsInShuffle.value.has(track.trackId));
      return availableTracks.length > 0;
    }
    return currentQueueIndex.value < queue.value.length - 1;
  });

  const canPlayPrevious = computed<boolean>(() => {
    if (isShuffled.value) {
      // In shuffle, previous typically restarts current track or uses a more complex history.
      // For now, allow if a track is loaded (can be restarted).
      return currentTrack.value !== null;
    }
    return currentQueueIndex.value > 0;
  });

  // Computed property for the audio source URL
  const audioSource = computed<string | null>(() => {
    return currentTrack.value ? `/api/tracks/${currentTrack.value.trackId}/play` : null;
  });

  function _resetState(): void {
    _cleanupAudioElement();
    isPlaying.value = false;
    currentQueueIndex.value = -1;
    currentTime.value = 0;
    duration.value = 0;
    isLoading.value = false;
  }

  // Fisher-Yates (Knuth) Shuffle algorithm
  const shuffleArray = <T>(array: T[]): T[] => {
    let currentIndex = array.length;
    let randomIndex;
    const newArray = [...array]; // Create a copy

    // While there remain elements to shuffle.
    while (currentIndex !== 0) {

      // Pick a remaining element.
      randomIndex = Math.floor(Math.random() * currentIndex);
      currentIndex--;

      // And swap it with the current element.
      [newArray[currentIndex], newArray[randomIndex]] = [
        newArray[randomIndex], newArray[currentIndex]];
    }

    return newArray;
  }

  // --- Internal Functions --- 

  const _cleanupAudioElement = () => {
    if (audioElement.value) {
      audioElement.value.pause();
      audioElement.value.removeEventListener('play', _handlePlay);
      audioElement.value.removeEventListener('pause', _handlePause);
      audioElement.value.removeEventListener('ended', _handleEnded);
      audioElement.value.removeEventListener('timeupdate', _handleTimeUpdate);
      audioElement.value.removeEventListener('loadedmetadata', _handleLoadedMetadata);
      audioElement.value.removeEventListener('error', _handleError);
      audioElement.value.removeEventListener('waiting', _handleWaiting); // Loading started
      audioElement.value.removeEventListener('playing', _handlePlaying); // Loading finished
      // Revoke object URL if created (not strictly necessary here as we use API endpoint)
      // if (audioElement.value.src.startsWith('blob:')) {
      //   URL.revokeObjectURL(audioElement.value.src);
      // }
      audioElement.value.src = ''; // Clear source
      // audioElement.value.load(); // Attempt to force reload state - might not be needed
      audioElement.value = null;
    }
    isLoading.value = false;
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
  };

  const _setupAudioElement = () => {
    _cleanupAudioElement(); // Clean up previous instance first

    // Check if we have a valid track selected from the queue
    const track = currentTrack.value; // Get computed value once

    if (!track) {
      _resetState();
      return;
    }

    // Check if we have a valid source URL derived from the track
    const source = audioSource.value; // Get computed value once

    if (!source) {
      _resetState(); // Reset state if setup fails
      return;
    }

    // Create new audio element
    audioElement.value = new Audio(source);
    audioElement.value.volume = volume.value;

    // Attach event listeners
    audioElement.value.addEventListener('play', _handlePlay);
    audioElement.value.addEventListener('pause', _handlePause);
    audioElement.value.addEventListener('ended', _handleEnded);
    audioElement.value.addEventListener('timeupdate', _handleTimeUpdate);
    audioElement.value.addEventListener('loadedmetadata', _handleLoadedMetadata);
    audioElement.value.addEventListener('error', _handleError);
    audioElement.value.addEventListener('waiting', _handleWaiting); // Loading started
    audioElement.value.addEventListener('playing', _handlePlaying); // Loading finished
    
    // Attempt to play
    audioElement.value.play().catch((error: any) => {
      // Autoplay might be blocked by the browser
      isPlaying.value = false; 
      isLoading.value = false;
    });
  };

  // --- Event Handlers --- 

  const _handlePlay = () => { isPlaying.value = true; };
  const _handlePause = () => { isPlaying.value = false; };
  const _handleEnded = () => { 
    isPlaying.value = false; 
    // currentTime.value = 0; // Reset time - seek(0) in 'one' or new track setup handles this

    switch (repeatMode.value) {
      case 'one':
        seek(0); 
        audioElement.value?.play().catch(_handleError); 
        break;
      case 'all':
        playNext(true); // Pass flag indicating it's an auto-advancement from 'repeat all'
        break;
      case 'none':
      default:
        // playNext will handle shuffle logic or linear advancement
        // and will stop if no next track is available/appropriate.
        playNext();
        break;
    }
  };
  const _handleTimeUpdate = () => { 
    if (audioElement.value && !isUserSeeking.value) { // Only update if not actively seeking
      currentTime.value = audioElement.value.currentTime;
    }
  };
  const _handleLoadedMetadata = () => {
    if (audioElement.value) {
      duration.value = audioElement.value.duration;
    }
  };
  const _handleError = (e: Event | string) => {
    _cleanupAudioElement();
    // Show error to user?
    // Optionally try to advance to next track on error?
  };
  const _handleWaiting = () => { isLoading.value = true; };
  const _handlePlaying = () => { isLoading.value = false; };

  // --- Actions --- 

  // Action to add an album's tracks to the queue without starting playback
  const addAlbumToQueue = (tracksToAdd: Track[], albumContext: QueueContext): void => {
    const wasQueueEmpty = queue.value.length === 0;
    // Filter out tracks that are already in the queue by trackId
    const newTracks = tracksToAdd.filter((newTrack: Track) => 
      !queue.value.some((existingTrack: Track) => existingTrack.trackId === newTrack.trackId)
    );

    if (newTracks.length > 0) {
      queue.value.push(...newTracks);
      // If shuffle is on and the queue was empty, this is like a new context
      if (isShuffled.value && wasQueueEmpty) {
        originalQueue.value = [...queue.value];
        playedTrackIdsInShuffle.value.clear();
      }
    }

    // Set context if the queue was empty and now has tracks from this album
    if (wasQueueEmpty && queue.value.length > 0) {
      currentQueueContext.value = albumContext;
      // If not playing anything, set current index to the first track of the added album
      // This doesn't start playback, just sets the potential starting point.
      if (currentQueueIndex.value === -1) {
        const firstAddedTrackId = tracksToAdd[0]?.trackId;
        const firstAddedTrackIndex = queue.value.findIndex((t: Track) => t.trackId === firstAddedTrackId);
        if (firstAddedTrackIndex !== -1) {
          currentQueueIndex.value = firstAddedTrackIndex;
        }
      }
    }
    // Optionally, show a notification or update UI
    // Does not automatically start playback or change current track if one is playing.
  };

  const playTrack = (track: Track) => {
    _cleanupAudioElement();
    // When a single track is played, it typically forms a new, temporary queue.
    queue.value = [track];
    currentQueueIndex.value = 0;
    currentQueueContext.value = { type: 'track', id: track.trackId, name: track.title };

    // Clear shuffle history as the context has changed significantly.
    playedTrackIdsInShuffle.value.clear();
    if (isShuffled.value) {
      // If shuffle mode is on, this single track is the new originalQueue for shuffle purposes.
      originalQueue.value = [...queue.value];
      // Add this track to played set as it's about to play.
      playedTrackIdsInShuffle.value.add(track.trackId);
    }

    _setupAudioElement();
  };

  const loadQueue = (tracks: Track[], context?: QueueContext, startPlaying: boolean = true, startIndex: number = 0) => {
    _cleanupAudioElement(); 

    originalQueue.value = []; 
    playedTrackIdsInShuffle.value.clear(); 

    // Process tracks to add formatted artists using the composable
    const { formatTracksWithArtists } = useTrackArtists();
    const processedTracks = formatTracksWithArtists(tracks);
    
    queue.value = processedTracks;
    currentQueueContext.value = context || { type: null, id: null, name: undefined };

    if (tracks.length > 0) {
      currentQueueIndex.value = Math.max(0, Math.min(startIndex, tracks.length - 1));
      if (startPlaying) {
        _setupAudioElement();
        if (isShuffled.value && currentTrack.value) {
          playedTrackIdsInShuffle.value.add(currentTrack.value.trackId);
        }
      }
    } else {
      _resetState();
    }

    if (isShuffled.value) {
      originalQueue.value = [...queue.value];
    }
  };

  const playFromQueue = (index: number) => {
    if (index >= 0 && index < queue.value.length) {
      currentQueueIndex.value = index;
      _setupAudioElement();
      if (isShuffled.value && currentTrack.value) {
        playedTrackIdsInShuffle.value.add(currentTrack.value.trackId);
      }
    }
  };

  const togglePlayPause = () => {
    if (!audioElement.value) {
       // If no audio element (e.g., first load), try playing the current track if one exists
       if(currentTrack.value) {
         _setupAudioElement();
       }
       return;
    }
    if (audioElement.value.paused) {
      audioElement.value.play().catch(_handleError);
    } else {
      audioElement.value.pause();
    }
  };

  const playNext = (isLoopingAll: boolean = false) => {
    if (isShuffled.value) {
      const availableTracks = queue.value.filter((track: Track) => !playedTrackIdsInShuffle.value.has(track.trackId));

      if (availableTracks.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableTracks.length);
        const nextTrackToPlay = availableTracks[randomIndex];
        const originalIndex = queue.value.findIndex((t: Track) => t.trackId === nextTrackToPlay.trackId);

        if (originalIndex !== -1) {
          currentQueueIndex.value = originalIndex;
          _setupAudioElement(); 
          playedTrackIdsInShuffle.value.add(nextTrackToPlay.trackId);
        } else {
          _resetState();
        }
      } else {
        // All tracks in shuffle mode have been played
        if (repeatMode.value === 'all' && isLoopingAll) {
          playedTrackIdsInShuffle.value.clear();
          // If currentTrack.value just ended, it's fine not to re-add it here.
          if (queue.value.length > 0) {
            // Pick a new random track to start the new cycle
            const randomIndex = Math.floor(Math.random() * queue.value.length);
            currentQueueIndex.value = randomIndex; // Set to a random track from the full queue
            _setupAudioElement();
            if(currentTrack.value) playedTrackIdsInShuffle.value.add(currentTrack.value.trackId);
          } else {
            _resetState();
          }
        } else {
          _resetState(); 
        }
      }
    } else { // Not shuffled, linear playback
      if (currentQueueIndex.value < queue.value.length - 1) {
        currentQueueIndex.value++;
        _setupAudioElement();
      } else if (repeatMode.value === 'all' && isLoopingAll) {
        currentQueueIndex.value = 0;
        _setupAudioElement();
      } else {
        _resetState();
      }
    }
  };

  // Track the last time previous button was clicked
  const lastPreviousClickTime = ref<number>(0);
  const DOUBLE_CLICK_THRESHOLD = 500; // ms

  const playPrevious = () => {
    const now = Date.now();
    const timeSinceLastClick = now - lastPreviousClickTime.value;
    
    // Update the last click time
    lastPreviousClickTime.value = now;
    
    // If current track has played for more than 3 seconds or it's the first click (not a double click)
    if (currentTime.value > 3 || timeSinceLastClick > DOUBLE_CLICK_THRESHOLD) {
      // Restart current track
      if (audioElement.value && currentTrack.value) {
        seek(0);
        if (!isPlaying.value) audioElement.value.play().catch(_handleError);
      }
      return;
    }
    
    // Double click detected or track just started - go to previous track
    if (isShuffled.value) {
      // In shuffle mode, we can't easily go back to the previous track
      // Just restart the current track for now
      if (audioElement.value && currentTrack.value) {
        seek(0);
        if (!isPlaying.value) audioElement.value.play().catch(_handleError);
      }
    } else { 
      if (currentQueueIndex.value > 0) {
        currentQueueIndex.value--;
        _setupAudioElement();
      }
    }
  };

  const seek = (time: number) => {
    if (audioElement.value && isFinite(time)) {
      audioElement.value.currentTime = Math.max(0, Math.min(time, duration.value));
    }
  };

  const setVolume = (level: number) => {
    const newVolume = Math.max(0, Math.min(1, level));
    volume.value = newVolume;
    if (audioElement.value) {
      audioElement.value.volume = newVolume;
    }
  };

  const toggleShuffle = () => {
    isShuffled.value = !isShuffled.value;
    playedTrackIdsInShuffle.value.clear();

    if (isShuffled.value) {
      // Store the current queue order if it's not already stored or different
      // This check ensures originalQueue is set once when shuffle is first enabled for a queue.
      if (originalQueue.value.length === 0 || originalQueue.value[0]?.trackId !== queue.value[0]?.trackId || originalQueue.value.length !== queue.value.length) {
        originalQueue.value = [...queue.value];
      }
      if (currentTrack.value) {
        playedTrackIdsInShuffle.value.add(currentTrack.value.trackId);
      }
    } else {
      // When shuffle is turned off, restore the original queue order
      // and try to find the current playing track in it.
      if (originalQueue.value.length > 0) {
        const currentPlayingTrackId = currentTrack.value?.trackId;
        queue.value = [...originalQueue.value]; 
        originalQueue.value = []; // Clear originalQueue as it's now active

        if (currentPlayingTrackId) {
          const newIndex = queue.value.findIndex((t: Track) => t.trackId === currentPlayingTrackId);
          currentQueueIndex.value = (newIndex !== -1) ? newIndex : 0;
        } else {
          // If no track was playing, or it's not in original queue, default to start
          currentQueueIndex.value = (queue.value.length > 0) ? 0 : -1;
        }
      }
      // playedTrackIdsInShuffle is already cleared at the start of the function.
    }
  };

  const toggleRepeatMode = () => {
    switch (repeatMode.value) {
      case 'none':
        repeatMode.value = 'all';
        break;
      case 'all':
        repeatMode.value = 'one';
        break;
      case 'one':
        repeatMode.value = 'none';
        break;
    }
  };

  // --- Actions for Queue Sidebar ---
  const showQueueSidebar = (): void => {
    isQueueSidebarVisible.value = true;
  };

  const showFullScreenQueue = (): void => {
    isFullScreenQueueVisible.value = true;
  };

  const hideFullScreenQueue = (): void => {
    isFullScreenQueueVisible.value = false;
  };

  const toggleFullScreenQueue = (): void => {
    isFullScreenQueueVisible.value = !isFullScreenQueueVisible.value;
  };

  const hideQueueSidebar = (): void => {
    isQueueSidebarVisible.value = false;
  };

  const toggleQueueSidebar = (): void => {
    isQueueSidebarVisible.value = !isQueueSidebarVisible.value;
  };

  // --- Actions for Full Screen Player ---
  const toggleFullScreenPlayer = (): void => {
    isFullScreenPlayerVisible.value = !isFullScreenPlayerVisible.value;
  };

  // --- Actions for Seek Bar Dragging ---
  const startSeeking = (): void => {
    if (!audioElement.value) return;
    isUserSeeking.value = true;
    wasPlayingBeforeSeek.value = isPlaying.value;
    if (isPlaying.value) {
      audioElement.value.pause(); // Pause playback during seek
    }
  };

  const updateSeekPosition = (newTime: number): void => {
    if (!audioElement.value || !isUserSeeking.value) return;
    // Update our reactive currentTime for the UI
    currentTime.value = newTime;
    // Also update the audio element's currentTime directly so the browser's native UI for the range input reflects the change immediately if needed.
    // This is usually not strictly necessary if the input's value is bound to playerStore.currentTime,
    // but can help ensure the thumb position is accurate during drag, especially if there's any lag.
    audioElement.value.currentTime = newTime; 
  };

  const endSeeking = (): void => {
    if (!audioElement.value || !isUserSeeking.value) return;
    isUserSeeking.value = false;
    // The audioElement.currentTime should already be at the desired currentTime.value
    // due to updateSeekPosition or the final @input event before @mouseup.
    // Explicitly set it here to be certain.
    audioElement.value.currentTime = currentTime.value;

    if (wasPlayingBeforeSeek.value) {
      audioElement.value.play().catch((error: any) => {
        _handleError(error);
      });
    } // Closing the if block
  }; // Closing the endSeeking function

  const clearQueue = (): void => {
    _cleanupAudioElement();
    queue.value = [];
    originalQueue.value = [];
    currentQueueIndex.value = -1;
    currentQueueContext.value = { type: null, id: null, name: undefined };
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    isLoading.value = false;
    isShuffled.value = false;
    playedTrackIdsInShuffle.value.clear();
    // Do not reset volume or repeatMode as those are user preferences not tied to a specific queue
  };

  // Ensure cleanup when store instance is effectively destroyed (though Pinia stores are generally singletons)
  // If used within a component, cleanup might happen in onUnmounted
  // For a global store, explicit cleanup might be needed on app unload if necessary.

  const updateAlbumDetailsInPlayer = (updatedAlbum: Pick<Album, 'albumId' | 'title' | 'coverPath'> & { artistName?: string }) => {
    if (!updatedAlbum || !updatedAlbum.albumId) {
      return;
    }

    const applyUpdates = (track: Track) => {
      if (track.albumId === updatedAlbum.albumId) {
        track.albumTitle = updatedAlbum.title;
        track.coverPath = updatedAlbum.coverPath;
        // If the updated album has a new artist name, apply it to the track.
        // This assumes that if an album's primary artist changes, tracks from that album should reflect this.
        // More complex scenarios (e.g., compilation albums, tracks with featured artists different from album artist)
        // might require more granular data on the Track object itself.
        if (updatedAlbum.artistName) {
            track.artistName = updatedAlbum.artistName;
        }
      }
    };

    queue.value.forEach(applyUpdates);
    originalQueue.value.forEach(applyUpdates);

    // currentTrack is computed, so changes to queue.value[currentQueueIndex.value] will reflect.

    if (
      currentQueueContext.value.type === 'album' &&
      currentQueueContext.value.id === updatedAlbum.albumId
    ) {
      currentQueueContext.value.name = updatedAlbum.title;
    }
  };

  return {
    // State
    queue,
    currentQueueIndex,
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    isLoading,
    isShuffled,
    repeatMode,
    currentQueueContext,
    isQueueSidebarVisible,
    isFullScreenQueueVisible,
    isFullScreenPlayerVisible,
    isUserSeeking,
    wasPlayingBeforeSeek,

    // Getters (Computed)
    audioSource,
    canPlayNext,
    canPlayPrevious,

    // Actions
    playTrack,
    loadQueue,
    playFromQueue,
    togglePlayPause,
    playNext,
    playPrevious,
    seek,
    setVolume,
    toggleShuffle,
    toggleRepeatMode,
    showQueueSidebar,
    showFullScreenQueue,
    hideFullScreenQueue,
    toggleFullScreenQueue,
    hideQueueSidebar,
    toggleQueueSidebar,
    toggleFullScreenPlayer,
    startSeeking,
    updateSeekPosition,
    endSeeking,
    addAlbumToQueue,
    updateAlbumDetailsInPlayer, 
    clearQueue

    // Internal methods exposed for potential direct use or testing (consider if really needed)
  };
});
