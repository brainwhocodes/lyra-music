```markdown
# Phase 6: Final Tests & Validation

## Unit/Integration Tests (Conceptual - No specific test files requested, but these are areas to cover)

### Playlist Generation Logic
- [ ] **New Discoveries:**
  - [ ] Test `getArtistsWithFewTracks` returns correct artists based on track count threshold.
  - [ ] Test `selectTracksForNewDiscoveries` selects a diverse set of tracks as expected.
  - [ ] Test `buildNewDiscoveriesPlaylist` correctly creates/updates the playlist and its tracks in the database.
    - Verify `title`, `type`, `track_ids`, `order`, `last_refreshed_at`.
- [ ] **Similar to X Artist:**
  - [ ] Test `calculateArtistSimilarity` with various artist profiles (e.g., high/low genre overlap, collaborator overlap).
  - [ ] Test `findSimilarArtists` returns a ranked list of artists based on similarity scores.
  - [ ] Test `selectTracksForSimilarArtists` selects appropriate tracks from similar artists.
  - [ ] Test `buildSimilarToArtistPlaylist` for a specific artist:
    - Verify correct `title` (e.g., "Similar to [Artist Name]"), `type`, `target_artist_id`.
    - Verify tracks are from similar artists and correctly ordered.
    - Verify `last_refreshed_at` is updated.
- [ ] **Playlist Builder Service:**
  - [ ] Test `updateDiscoveryPlaylist` correctly handles new playlist creation.
  - [ ] Test `updateDiscoveryPlaylist` correctly handles existing playlist updates (old tracks removed, new tracks added).
  - [ ] Test transactional behavior (all changes succeed or fail together).

### Job Scheduling & Execution
- [ ] **New Discoveries Job:**
  - [ ] Manually trigger `NewDiscoveriesPlaylistJob` and verify it completes successfully and the playlist is updated.
  - [ ] Verify the job reschedules itself for the correct weekly interval.
- [ ] **Similar to Artist Job:**
  - [ ] Manually trigger `SimilarToArtistPlaylistJob` with a test `artistId` and verify successful completion and playlist update.
  - [ ] Verify the job reschedules itself for the correct daily interval.
- [ ] **Rotation Logic:**
  - [ ] Test `getNextArtistForSimilarPlaylist` correctly cycles through artists.
  - [ ] Simulate multiple daily runs and verify the `SimilarToArtistPlaylistJob` is scheduled with different `artistId`s according to the rotation strategy.

### API Endpoints
- [ ] **GET `/api/playlists/discovery`:**
  - [ ] Test with no discovery playlists in the DB (empty array response).
  - [ ] Test after generating one "New Discoveries" playlist (correct metadata returned).
  - [ ] Test after generating one "Similar to X Artist" playlist (correct metadata, including `target_artist_id` and `target_artist_name`).
  - [ ] Test with multiple playlists of both types.
- [ ] **GET `/api/playlists/:id/tracks`:**
  - [ ] Test with an invalid/non-existent playlist `id` (404 error).
  - [ ] Test with a valid playlist `id` that has no tracks (empty `tracks` array).
  - [ ] Test with a playlist having fewer tracks than the default page limit.
  - [ ] Test pagination:
    - Request page 1, verify correct tracks and pagination metadata.
    - Request page 2, verify correct tracks and pagination metadata.
    - Request a page beyond the total number of pages.
  - [ ] Verify tracks are correctly ordered by `discovery_playlist_tracks.order`.
  - [ ] Verify all expected track details are present in the response.

## Manual End-to-End Validation

- [ ] **Initial State:** Start with a clean database (or no discovery playlists).
- [ ] **Trigger Jobs:** Manually trigger (if possible via admin hook) or wait for scheduled jobs to run for both playlist types.
- [ ] **Inspect Database:**
  - [ ] Verify `discovery_playlists` table has correct entries.
  - [ ] Verify `discovery_playlist_tracks` table has correct track associations and ordering.
  - [ ] Verify `last_refreshed_at` timestamps are updated.
- [ ] **Use API Endpoints:**
  - [ ] Call `GET /api/playlists/discovery` and check if the generated playlists appear correctly.
  - [ ] For each playlist ID, call `GET /api/playlists/:id/tracks` (with and without pagination params) and verify the track lists are accurate and complete.
- [ ] **Long-Term Rotation (Simulated):**
  - [ ] If possible, simulate several days of the "Similar to X Artist" job runs to ensure the artist rotation is working and different playlists are being generated/updated.

## Data Integrity Checks

- [ ] Verify no orphaned `discovery_playlist_tracks` (tracks belonging to non-existent playlists).
- [ ] Verify `target_artist_id` in `discovery_playlists` correctly references an existing artist if not null.
- [ ] Verify track IDs in `discovery_playlist_tracks` correctly reference existing tracks.

```
