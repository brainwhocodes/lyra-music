```markdown
# Phase 4: API Endpoints

## Get Discovery Playlists Metadata (`server/api/playlists/discovery.get.ts`)

- [ ] **Define API Route:** `GET /api/playlists/discovery`
- [ ] **Request Handling:**
  - [ ] No request parameters needed.
- [ ] **Logic:**
  - [ ] Query the `discovery_playlists` table.
  - [ ] Select fields: `id`, `title`, `type`, `target_artist_id` (and potentially artist name if `target_artist_id` is present), `last_refreshed_at`.
  - [ ] If `target_artist_id` is present, fetch the artist's name to enrich the title or provide artist context (e.g., `targetArtistName`).
  - [ ] Order playlists (e.g., by type, then by title or last refreshed date).
- [ ] **Response:**
  - [ ] Return JSON array of playlist metadata objects.
  - Example object:
    ```json
    {
      "id": "uuid-for-new-discoveries",
      "title": "New Discoveries",
      "type": "new_discoveries",
      "target_artist_id": null,
      "target_artist_name": null,
      "last_refreshed_at": "2023-10-27T10:00:00Z"
    },
    {
      "id": "uuid-for-similar-to-foo-fighters",
      "title": "Similar to Foo Fighters",
      "type": "similar_to_artist",
      "target_artist_id": "artist-uuid-foo-fighters",
      "target_artist_name": "Foo Fighters",
      "last_refreshed_at": "2023-10-26T08:00:00Z"
    }
    ```

## Get Tracks for a Discovery Playlist (`server/api/playlists/[id]/tracks.get.ts`)

- [ ] **Define API Route:** `GET /api/playlists/:id/tracks` (where `:id` is `discovery_playlists.id`)
- [ ] **Request Handling:**
  - [ ] Get `id` (playlist ID) from route parameters.
  - [ ] Implement pagination parameters (e.g., `page` and `limit`, or `offset` and `limit`).
    - Default `limit` (e.g., 50 tracks).
- [ ] **Logic:**
  - [ ] Verify the `discovery_playlists` entry exists for the given `id`.
    - Return 404 if not found.
  - [ ] Query `discovery_playlist_tracks` table, filtering by `playlist_id`.
  - [ ] Join with `tracks` table to get track details (title, duration, artist name, album name, file path, etc.).
    - *Ensure necessary artist/album details are joined or fetched efficiently.*
  - [ ] Apply pagination (`LIMIT` and `OFFSET` clauses).
  - [ ] Order tracks by `discovery_playlist_tracks.order`.
  - [ ] Get total count of tracks in the playlist for pagination metadata.
- [ ] **Response:**
  - [ ] Return JSON object with pagination info and an array of track objects.
  - Example response:
    ```json
    {
      "pagination": {
        "currentPage": 1,
        "totalPages": 5,
        "totalItems": 250,
        "limit": 50
      },
      "tracks": [
        {
          "trackId": "track-uuid-1",
          "title": "Track Title 1",
          "artistName": "Artist Name",
          "albumName": "Album Name",
          "duration": 240,
          // ... other relevant track fields
        }
        // ... more tracks
      ]
    }
    ```

```
