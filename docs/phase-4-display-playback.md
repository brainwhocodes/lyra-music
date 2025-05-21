# Phase 4: Music Display & Playback

## Goal

Display the scanned music library (artists, albums, tracks) to the user and implement basic audio playback functionality.

## Tasks

### API Endpoints

*   [x] `GET /api/tracks/{trackId}/stream`: An endpoint to stream the actual audio file (may require careful handling of range requests and content types).
    *   *Alternative*: Directly serve files from the filesystem if paths are accessible/safe, but an endpoint offers more control.
*   [ ] `GET /api/artists`: List all unique artists.
    *   Potentially add counts (albums/tracks per artist).
*   [ ] `GET /api/albums`: List all albums.
    *   Allow filtering by `artistId`.
    *   Include artist name and album art path.
*   [ ] `GET /api/tracks`: List all tracks.
    *   Allow filtering by `albumId` and/or `artistId`.
    *   Include artist name, album title, duration, track number.
*   [ ] Consider pagination/sorting for all list endpoints if data grows large.

### UI Components & Pages

*   [ ] Create `pages/artists.vue`: Display a list or grid of artists.
    *   Clicking an artist navigates to their albums/tracks view.
*   [ ] Create `pages/albums.vue`: Display a list or grid of albums.
    *   Allow filtering/viewing by artist.
    *   Clicking an album navigates to its tracklist view.
*   [x] Create `components/player/global-audio-player.vue` (formerly `components/audio-player.vue`): A basic audio player component.
    *   Displays current track info (title, artist).
    *   Standard controls: Play/Pause, Seek bar, Volume.
    *   Uses HTML5 `<audio>` element (managed by Pinia store).
    *   Integrate into the main layout (e.g., `layouts/sidebar-layout.vue`) so it's persistent across pages.

### Logic & Integration

*   [x] Implement state management (e.g., using Pinia `playerStore`) for the current playlist and player state.
*   [x] Update layout (`layouts/sidebar-layout.vue`) to include the `global-audio-player.vue` component.
*   [x] Connect track list clicks (e.g., in `components/layout/queue-sidebar.vue`) to update the player state and start playback.

## Decisions to Make

*   Initial data loading strategy (fetch all on load vs. fetch on demand).
*   Specific UI library components for lists/grids/player controls.
*   How to handle audio streaming (dedicated endpoint vs. direct file access if feasible).
*   State management approach (simple `useState` vs. Pinia store).
