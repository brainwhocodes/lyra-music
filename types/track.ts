export interface Track {
  trackId: string;
  title: string;
  artistName?: string; // Optional if it can be derived from album
  albumId?: string;    // Optional, but good for linking
  duration: number;
  filePath: string;
  // Add other relevant track properties here
}
