export interface Playlist {
  playlistId: string;
  name: string;
  userId: string;
  description?: string;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  // Add other relevant playlist properties here, e.g., track count
}
