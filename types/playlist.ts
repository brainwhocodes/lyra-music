export interface Playlist {
  playlistId: string;
  name: string;
  userId: string;
  description?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

export interface PlaylistTrack {
  playlistTrackId: string;
  order: number;
  trackId: string;
  title: string;
  duration: number;
  trackNumber?: number | null;
  filePath?: string | null;
  albumId: string;
  albumTitle: string;
  coverPath?: string | null;
  artistId: string;
  artistName: string;
}
