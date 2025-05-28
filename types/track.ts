export interface Track {
  trackId: string;
  title: string;
  duration: number | null;
  filePath: string;
  albumId: string | null;       // Align with schema: was string, now string | null
  trackNumber: number | null;
  artistId: string | null;
  artistName?: string;          // Optional, for convenience, not in base schema track table
  albumTitle?: string;          // Optional, for convenience, not in base schema track table
  coverPath?: string | null;    // Optional, for convenience, not in base schema track table
  genre: string | null;         // Add from schema
  year: number | null;          // Add from schema
  diskNumber: number | null;    // Add from schema
  explicit: boolean | null;     // Add from schema
  createdAt: string;            // Add from schema
  updatedAt: string;            // Add from schema
}
