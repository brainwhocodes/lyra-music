export interface TrackArtistDetail {
  artistId: string;
  name: string;
  role?: string; // From artistsToTracks
  isPrimaryArtist?: boolean; // From artistsToTracks (converted from 0/1)
}

// Interface for formatted artists with display properties
export interface FormattedArtist extends TrackArtistDetail {
  url: string;               // URL to artist page
  displayRole?: string;      // Formatted role for display
  isPrimary: boolean;        // Whether this is a primary artist
}

export interface Track {
  trackId: string;
  title: string;
  duration: number | null;
  filePath: string;
  albumId: string | null;       // Align with schema: was string, now string | null
  trackNumber: number | null;
  artists: TrackArtistDetail[]; // New field for multiple artists
  albumTitle?: string;          // Optional, for convenience, not in base schema track table
  coverPath?: string | null;    // Optional, for convenience, not in base schema track table
  musicbrainzTrackId?: string;  // MusicBrainz Recording ID
  genre: string | null;
  year: number | null;
  diskNumber: number | null;
  explicit: boolean;            // Corrected: DB schema is NOT NULL
  createdAt: string;
  updatedAt: string;
  
  // UI convenience properties - not in database schema
  artistName?: string;          // Simple artist name display
  artistId?: string | null;     // Primary artist ID (for backwards compatibility)
  formattedArtists?: FormattedArtist[]; // Formatted artist data for UI
  url?: string;                 // URL for audio playback
}
