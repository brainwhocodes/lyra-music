import type { Track } from './track';

export interface Playlist {
  playlistId: string;
  name: string;
  userId: string;
  description?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  trackCount: number;
  user?: {
    userId: string;
    name: string;
    // email?: string; // Add if needed by frontend, not in current backend mapping
  };
  tracks: PlaylistTrack[];
}



export interface PlaylistTrack {
  playlistTrackId: string;
  playlistId: string; // Added
  trackId: string; // Added for direct reference, often useful
  order: number;
  addedAt: string; // ISO date string, Added
  track: Track; // Changed to use global Track type
}
