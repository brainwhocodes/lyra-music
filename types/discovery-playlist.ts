export interface DiscoveryPlaylist {
  discoveryPlaylistId: string;
  title: string;
  type: string;
  seedArtistId?: string | null;
  lastGeneratedAt: string | null;
  createdAt: string;
  updatedAt: string;
  trackCount: number;
  tracks: DiscoveryPlaylistTrack[];
}

export interface DiscoveryPlaylistTrack {
  discoveryPlaylistTrackId: string;
  discoveryPlaylistId: string;
  trackId: string;
  order: number;
  addedAt: string;
  track: import('./track').Track;
}
