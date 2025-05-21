// stores/player.ts
import { defineStore } from 'pinia';
import { ref, computed, watch } from 'vue';

// Define the structure of a Track object (adjust based on your actual track data)
// We might fetch this from the /api/tracks endpoint later
export interface Track {
  id: number;
  title: string;
  albumId: number;
  trackNumber: number | null;
  filePath: string;
  artistId: number | null; // Made nullable to match database schema
  duration: number;
  artistName?: string; // Optional fields as needed
  albumTitle?: string;
  coverPath?: string | null; // Added to store album cover art URL
  // Add other relevant fields like duration if available directly
}

export const usePlayerStore = defineStore('player', () => {
  // State
  const queue = ref<Track[]>([]);
  const currentQueueIndex = ref<number>(-1); // -1 indicates no track selected
  const isPlaying = ref<boolean>(false);
  const currentTime = ref<number>(0); // In seconds
  const duration = ref<number>(0); // In seconds
  const volume = ref<number>(0.8); // Default volume (0 to 1)
  const audioElement = ref<HTMLAudioElement | null>(null);
  const isLoading = ref<boolean>(false); // To track if audio is loading
  const isShuffled = ref<boolean>(false);
  const originalQueue = ref<Track[]>([]); // To restore order when shuffle is turned off
  const repeatMode = ref<'none' | 'one' | 'all'>('none');

  // State for Queue Sidebar Visibility
  const isQueueSidebarVisible = ref<boolean>(false);

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
    return currentQueueIndex.value < queue.value.length - 1;
  });

  const canPlayPrevious = computed<boolean>(() => {
    return currentQueueIndex.value > 0;
  });

  // Computed property for the audio source URL
  const audioSource = computed<string | null>(() => {
    return currentTrack.value ? `/api/tracks/${currentTrack.value.id}/play` : null;
  });

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
      console.error("SetupAudioElement Error: currentTrack is null/undefined.", {
        currentIndex: currentQueueIndex.value,
        queueLength: queue.value.length,
      });
      _resetState();
      return;
    }

    // Check if we have a valid source URL derived from the track
    const source = audioSource.value; // Get computed value once

    if (!source) {
      console.error("SetupAudioElement Error: audioSource is null/undefined.", {
        trackId: track.id, // Log track ID for which source failed
        currentIndex: currentQueueIndex.value,
        queueLength: queue.value.length,
      });
      _resetState(); // Reset state if setup fails
      return;
    }

    // Log successful setup attempt
    console.log(`Setting up audio for track ID: ${track.id}, source: ${source}`);

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
    audioElement.value.play().catch(error => {
      console.error('Error attempting to play audio:', error);
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
    currentTime.value = 0; // Reset time

    switch (repeatMode.value) {
      case 'one':
        // Replay the current track
        seek(0); // Reset time visually just in case
        audioElement.value?.play().catch(_handleError); // Play again directly
        // Or call _setupAudioElement() if a full reset/reload is desired
        break;
      case 'all':
        if (canPlayNext.value) {
          playNext();
        } else {
          // Loop back to the beginning of the queue
          currentQueueIndex.value = 0;
          _setupAudioElement();
        }
        break;
      case 'none':
      default:
        // Default: Play next if possible, otherwise stop
        if (canPlayNext.value) {
          playNext();
        } else {
          // Stop playback, reset index
          currentQueueIndex.value = -1; 
          // Optionally clean up audio element? _cleanupAudioElement();
        }
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
    console.error('Audio Element Error:', audioElement.value?.error, e);
    _cleanupAudioElement();
    // Show error to user?
    // Optionally try to advance to next track on error?
  };
  const _handleWaiting = () => { isLoading.value = true; };
  const _handlePlaying = () => { isLoading.value = false; };

  // --- Actions --- 

  const playTrack = (track: Track) => {
    // Check if track is already in the current queue
    const indexInQueue = queue.value.findIndex(item => item.id === track.id);

    if (indexInQueue !== -1) {
      // Track found in queue, play from that index
      currentQueueIndex.value = indexInQueue;
      _setupAudioElement(); // Setup and play
    } else {
      // Track not in queue, replace queue with this single track
      queue.value = [track];
      currentQueueIndex.value = 0;
      _setupAudioElement(); // Setup and play
    }
  };

  const loadQueue = (tracks: Track[]) => {
    originalQueue.value = [...tracks]; // Always store original order

    // Set the active queue based on shuffle state
    if (isShuffled.value) {
      queue.value = shuffleArray(originalQueue.value); // Shuffle the stored original queue
    } else {
      queue.value = [...originalQueue.value]; // Use the original order
    }

    // Only proceed if the queue is not empty
    if (queue.value.length > 0) {
      const oldIndex = currentQueueIndex.value;
      currentQueueIndex.value = 0; // Start from the beginning
      _setupAudioElement();        // Setup the first track
    } else {
      _resetState(); // Reset if queue is empty
      currentQueueIndex.value = -1; // Ensure index is invalid
      queue.value = []; // Ensure queue is empty
      originalQueue.value = []; // Ensure original is empty
    }
  };

  const playFromQueue = (index: number) => {
    if (index >= 0 && index < queue.value.length) {
      const oldIndex = currentQueueIndex.value;
      currentQueueIndex.value = index;
      _setupAudioElement();
    } else {
      console.warn('[PlayerStore] playFromQueue: index out of bounds or queue empty.');
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

  const playNext = () => {
    if (canPlayNext.value) {
      currentQueueIndex.value++;
      _setupAudioElement();
    }
  };

  const playPrevious = () => {
    if (canPlayPrevious.value) {
      currentQueueIndex.value--;
      _setupAudioElement();
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
    const currentTrackId = currentTrack.value?.id; // Get ID before queue changes
    isShuffled.value = !isShuffled.value;

    if (isShuffled.value) {
      // Shuffle the original queue and assign to active queue
      console.log("Shuffle ON");
      queue.value = shuffleArray(originalQueue.value); 
    } else {
      // Restore original order
      console.log("Shuffle OFF");
      queue.value = [...originalQueue.value];
    }

    // Find the current track in the new (shuffled or restored) queue
    if (currentTrackId) {
      const newIndex = queue.value.findIndex(track => track.id === currentTrackId);
      currentQueueIndex.value = newIndex !== -1 ? newIndex : 0; // Reset to found index or start if not found
      console.log(`Current track ID ${currentTrackId} found at new index: ${currentQueueIndex.value}`);
    } else {
      currentQueueIndex.value = 0; // Or -1 if no track was playing?
      console.log("No current track ID found, setting index to 0");
    }
    
    // Note: Doesn't automatically restart the track, just sets the order for next/prev/end
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

  const hideQueueSidebar = (): void => {
    isQueueSidebarVisible.value = false;
  };

  const toggleQueueSidebar = (): void => {
    isQueueSidebarVisible.value = !isQueueSidebarVisible.value;
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
      audioElement.value.play().catch(error => {
        _handleError(error);
      });
    }
    // Reset wasPlayingBeforeSeek if needed, though it's overwritten on next startSeek
    // wasPlayingBeforeSeek.value = false; 
  };

  const _resetState = () => {
    isPlaying.value = false;
    currentTime.value = 0;
    duration.value = 0;
    isLoading.value = false;
    currentQueueIndex.value = -1;
    queue.value = [];
    _cleanupAudioElement();
  };

  // Ensure cleanup when store instance is effectively destroyed (though Pinia stores are generally singletons)
  // If used within a component, cleanup might happen in onUnmounted
  // For a global store, explicit cleanup might be needed on app unload if necessary.

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
    isQueueSidebarVisible, // Expose new state
    isUserSeeking,        // Expose seek state
    wasPlayingBeforeSeek, // Expose seek state

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
    showQueueSidebar,   // Expose new actions
    hideQueueSidebar,
    toggleQueueSidebar,
    startSeeking,         // Expose seek actions
    updateSeekPosition,
    endSeeking,

    // Internal methods exposed for potential direct use or testing (consider if really needed)
  };
});
