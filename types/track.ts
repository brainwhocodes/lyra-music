export interface Track {
  trackId: string;
  title: string;
  artistName?: string; // Optional if it can be derived from album
  albumId?: string;    // Optional, but good for linking
  albumTitle?: string; // Added for album title
  duration: number;
  filePath: string;
  coverPath?: string | null; // Added for album cover art
  // Add other relevant track properties here
}
