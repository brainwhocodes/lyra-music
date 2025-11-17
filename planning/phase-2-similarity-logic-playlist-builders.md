```markdown
# Phase 2: Similarity Logic & Playlist Builders

## Configuration
- [ ] Define constant `X_TOTAL_TRACKS_THRESHOLD` for "New Discoveries" (e.g., in `server/config/discovery.ts`).
- [ ] Define weights for similarity calculation (e.g., shared genres, album overlap, collaborators) (e.g., in `server/config/discovery.ts`).

## "New Discoveries" Playlist Logic (`server/services/discovery/new-discoveries.ts`)

- [ ] **Artist Identification:**
  - [ ] Create function `getArtistsWithFewTracks(threshold: number): Promise<Artist[]>`:
    - Query database for artists having fewer than `threshold` total tracks across all their albums.
    - *Consider performance for large track/artist counts.*
- [ ] **Track Selection:**
  - [ ] Create function `selectTracksForNewDiscoveries(artists: Artist[], limit: number): Promise<Track[]>`:
    - From the identified artists, select a diverse set of tracks up to `limit`.
    - *Strategy: e.g., one track per artist, then cycle, or most recent tracks.*

## "Similar to X Artist" Playlist Logic (`server/services/discovery/similar-artists.ts`)

- [ ] **Artist Data Fetching:**
  - [ ] Create function `getArtistDetails(artistId: string): Promise<ArtistDetails>`:
    - Fetch artist's genres, albums, collaborators (other artists on same tracks/albums).
- [ ] **Similarity Calculation:**
  - [ ] Create function `calculateArtistSimilarity(baseArtist: ArtistDetails, otherArtist: ArtistDetails, weights: SimilarityWeights): Promise<number>`:
    - Calculate similarity score based on weighted factors:
      - Shared genres (count/percentage).
      - Album overlap (artists appearing on same albums, excluding base artist's own albums if only one primary artist).
      - Collaborators (shared track features, other primary artists on shared albums).
    - Normalize score (e.g., 0 to 1).
- [ ] **Candidate Artist Identification:**
  - [ ] Create function `findSimilarArtists(baseArtistId: string, limit: number): Promise<Artist[]>`:
    - Fetch `baseArtist` details.
    - Iterate through other artists (or a subset for performance), calculate similarity.
    - Return top `limit` similar artists (excluding the base artist).
- [ ] **Track Selection:**
  - [ ] Create function `selectTracksForSimilarArtists(similarArtists: Artist[], baseArtistId: string, limit: number): Promise<Track[]>`:
    - Select a diverse set of tracks from the `similarArtists` up to `limit`.
    - *Strategy: e.g., a few tracks from each similar artist, prioritizing tracks not by `baseArtistId`.*

## Playlist Builder Service (`server/services/discovery/playlist-builder.ts`)

- [ ] **Core Update Function:**
  - [ ] Create function `updateDiscoveryPlaylist(playlistId: string, title: string, type: string, targetArtistId: string | null, trackIds: string[]): Promise<void>`:
    - Begin transaction.
    - Find or create `discovery_playlists` entry using `playlistId` (or `title` / `type` / `targetArtistId` as a composite key if `playlistId` is generated dynamically).
    - If playlist exists, delete all existing entries from `discovery_playlist_tracks` for this `playlist_id`.
    - Insert new tracks into `discovery_playlist_tracks` with correct `order`.
    - Update `last_refreshed_at` on the `discovery_playlists` entry.
    - Commit transaction.
- [ ] **"New Discoveries" Builder:**
  - [ ] Create function `buildNewDiscoveriesPlaylist(): Promise<void>`:
    - Get `playlistId` (e.g., a fixed UUID or generated from type).
    - Call `getArtistsWithFewTracks`.
    - Call `selectTracksForNewDiscoveries`.
    - Call `updateDiscoveryPlaylist` with appropriate title (e.g., "New Discoveries") and track IDs.
- [ ] **"Similar to X Artist" Builder:**
  - [ ] Create function `buildSimilarToArtistPlaylist(artistId: string): Promise<void>`:
    - Get `playlistId` (e.g., a fixed UUID per artist or generated from type and `artistId`).
    - Fetch target artist's name for the playlist title (e.g., "Similar to [Artist Name]").
    - Call `findSimilarArtists` for the given `artistId`.
    - Call `selectTracksForSimilarArtists`.
    - Call `updateDiscoveryPlaylist` with the generated title, type "similar_to_artist", `targetArtistId`, and track IDs.

```
