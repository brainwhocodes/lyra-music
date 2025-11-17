import type { Album } from './album';
import type { Artist } from './artist';
import type { Playlist } from './playlist';

export interface SearchResults {
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}
