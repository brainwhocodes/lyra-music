```markdown
# Phase 5: Admin Controls & Playlist Rotation Strategy

## Admin Controls (Backend Hooks)
*Comment: No UI is specified, so these are conceptual backend mechanisms for potential future admin interface or manual intervention.*

- [ ] **Manual Playlist Regeneration Trigger:**
  - [ ] Consider creating an internal utility function or a secured (e.g., admin-only) API endpoint to manually trigger regeneration of a specific discovery playlist.
    - `triggerNewDiscoveriesRegeneration()`
    - `triggerSimilarToArtistRegeneration(artistId: string)`
  - *This is for debugging or forcing updates outside the scheduled jobs.*

## "Similar to X Artist" Playlist Rotation Strategy

- [ ] **Artist Selection for Daily Job:**
  - [ ] Design a mechanism to select which artist's "Similar to..." playlist to regenerate each day.
  - Options:
    1.  **Sequential Iteration:** Iterate through all artists in the database one by one.
        - Store the `last_processed_artist_id` or `next_artist_index` in a persistent way (e.g., a dedicated table, a key-value store, or a simple file if appropriate for SQLite context and single-instance scheduler).
    2.  **Popularity/Activity Based:** Prioritize more popular or recently active artists (more complex).
    3.  **Random Selection:** Pick a random artist (might lead to uneven coverage).
  - *Chosen Strategy: Sequential Iteration is likely the simplest to implement robustly.*

- [ ] **Implementation of Sequential Rotation (`server/services/discovery/rotation-manager.ts` or similar):
  - [ ] Create function `getNextArtistForSimilarPlaylist(): Promise<string | null>`:
    - Read the ID of the last artist whose "Similar to..." playlist was generated.
    - Find the "next" artist in the database (e.g., ordered by `artistId` or `name`).
    - If at the end of the artist list, loop back to the beginning.
    - Store the ID of this newly selected artist as the "last processed" for the next cycle.
    - Return the selected artist's ID.
    - *Handle cases: no artists, only one artist.*

- [ ] **Job Scheduler Modification for Rotation:**
  - [ ] Modify the gut-punch job scheduling logic (e.g., in `server/plugins/scheduler.ts` or a dedicated manager that schedules jobs).
  - When the `SimilarToArtistPlaylistJob` is due to be rescheduled (daily):
    1. Call `getNextArtistForSimilarPlaylist()` to get the `artistId`.
    2. If an `artistId` is returned, schedule/enqueue `SimilarToArtistPlaylistJob` with `params: { artistId: selectedArtistId }`.
    3. If no `artistId` (e.g., no artists in DB), log a warning and skip scheduling for this cycle.

- [ ] **Initial State / Seeding for Rotation:**
  - [ ] On first setup, if no "last processed artist" is stored, pick the first artist from the database to start the cycle.

- [ ] **Ensuring Playlist Uniqueness per Target Artist:**
  - [ ] Confirm that the `updateDiscoveryPlaylist` function (Phase 2) correctly finds or creates a unique playlist entry for each `target_artist_Id` for "similar_to_artist" type playlists. The `playlist_id` could be deterministically generated (e.g., `similar-to-${artistId}`) or a lookup is needed. The current schema implies a single `discovery_playlists` entry per `target_artist_id` of this type.

```
