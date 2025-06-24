import type { Track } from './track'; // Ensure Track type is imported

export interface AlbumArtistDetail {
  artistId: string;
  name: string;
  role?: string; // Optional: if roles are defined for album artists
  isPrimaryArtist?: boolean; // From albumArtists (converted from 0/1)
}

// Define the expected structure from the API endpoint
export interface Album {
    albumId: string;
    title: string;
    year: number | null;
    coverPath: string | null;
    // artistId: string | null; // Removed for multi-artist support
    // artistName: string;      // Removed for multi-artist support
    artists: AlbumArtistDetail[]; // New field for multiple artists
    tracks?: Track[];
    genre?: {
        id: string;
        name: string;
    };
}