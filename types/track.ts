export interface Track {
  trackId: string;
  title: string;
  duration: number | null;
  filePath: string;
  albumId: string; // Made required, was optional
  trackNumber: number | null; // Added from player.ts
  artistId: string | null; // Added from player.ts, made nullable
  artistName?: string;
  albumTitle?: string;
  coverPath?: string | null;
  // Potentially other fields like genre, year, etc. can be added later
}
