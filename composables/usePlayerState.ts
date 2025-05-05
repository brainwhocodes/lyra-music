import { ref, computed } from 'vue';
import type { Ref } from 'vue';

// Re-defining a potentially simplified track structure for the player state
// We might need the full path or a dedicated stream URL later
export interface PlayerTrack {
  id: number;
  title: string;
  trackNumber: number | null;
  duration: number | null;
  path: string; // The original file path
  genre: string | null;
  albumId: number | null;
  albumTitle: string | null;
  albumArtPath: string | null;
  artistId: number | null;
  artistName: string | null;
  // We'll add the stream URL here
  streamUrl?: string;
}

// Define the structure of the player state
interface PlayerState {
  currentTrack: Ref<PlayerTrack | null>;
  isPlaying: Ref<boolean>;
  currentTime: Ref<number>;
  duration: Ref<number>;
  volume: Ref<number>; // Volume from 0 to 1
}

// Create state variables using useState
const playerState = {
    currentTrack: useState<PlayerTrack | null>('player-currentTrack', () => null),
    isPlaying: useState<boolean>('player-isPlaying', () => false),
    currentTime: useState<number>('player-currentTime', () => 0),
    duration: useState<number>('player-duration', () => 0),
    volume: useState<number>('player-volume', () => 1), // Default volume: 100%
};

export const usePlayerState = () => {

  // Function to set the current track and start playing
  const setTrack = (track: PlayerTrack) => {
    // Construct the stream URL - basic example, might need adjustment
    // This assumes a future API endpoint or direct access mechanism
    // For now, let's placeholder with the raw path, but this WON'T work directly in browser audio tag
    // TODO: Replace with actual stream URL generation (e.g., /api/tracks/{track.id}/stream)
    const trackWithUrl = { ...track, streamUrl: `/api/tracks/${track.id}/stream` }; // Placeholder
    
    playerState.currentTrack.value = trackWithUrl;
    playerState.duration.value = track.duration ?? 0; // Use stored duration initially
    playerState.currentTime.value = 0;
    playerState.isPlaying.value = true;
    console.log('Player State: Set track -', track.title);
  };

  // Function to toggle play/pause
  const togglePlay = () => {
    if (!playerState.currentTrack.value) return; // Can't toggle if no track
    playerState.isPlaying.value = !playerState.isPlaying.value;
    console.log('Player State: Toggle play -', playerState.isPlaying.value);
  };

  // Function to update current time (called by the audio element)
  const setCurrentTime = (time: number) => {
    playerState.currentTime.value = time;
  };

  // Function to update duration (called by the audio element when metadata loads)
  const setDuration = (dur: number) => {
    // Only update if it's a valid number and differs from the initial metadata value
    if (!isNaN(dur) && dur > 0 && dur !== playerState.duration.value) {
        playerState.duration.value = dur;
    }
  };
  
  // Function to update volume
  const setVolume = (vol: number) => {
      // Clamp volume between 0 and 1
      playerState.volume.value = Math.max(0, Math.min(1, vol));
      console.log('Player State: Set volume -', playerState.volume.value);
  };

  // Function to clear the player state
  const clearPlayer = () => {
    playerState.currentTrack.value = null;
    playerState.isPlaying.value = false;
    playerState.currentTime.value = 0;
    playerState.duration.value = 0;
    console.log('Player State: Cleared');
  };

  // Expose state and actions
  return {
    ...playerState,
    setTrack,
    togglePlay,
    setCurrentTime,
    setDuration,
    setVolume,
    clearPlayer,
  };
};
