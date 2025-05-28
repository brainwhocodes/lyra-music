import type { artists, albums, tracks, userArtists } from '~/server/db/schema';

export type Artist = typeof artists.$inferSelect;
export type Album = typeof albums.$inferSelect;
export type Track = typeof tracks.$inferSelect;
export type UserArtist = typeof userArtists.$inferSelect;

export interface TrackMetadata {
  common: {
    title?: string;
    artist?: string;
    album?: string;
    year?: number;
    genre?: string[];
    track?: { no: number | null; of: number | null };
    disk?: { no: number | null; of: number | null };
    picture?: Array<{ format: string; data: Uint8Array }>;
  };
  format?: {
    duration?: number;
  };
}

export interface ProcessedTrack {
  title: string;
  artistName?: string;
  albumTitle?: string;
  year?: number;
  genre?: string;
  trackNumber?: number | null;
  duration?: number | null;
  filePath: string;
  albumArtPath?: string | null;
}

export const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wav'] as const;

export const EXTERNAL_COVER_FILENAMES = [
  'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif', 'cover.webp',
  'folder.jpg', 'folder.jpeg', 'folder.png', 'folder.gif', 'folder.webp',
  'album.jpg', 'album.jpeg', 'album.png', 'album.gif', 'album.webp',
  'front.jpg', 'front.jpeg', 'front.png', 'front.gif', 'front.webp',
] as const;
