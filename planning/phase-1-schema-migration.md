```markdown
# Phase 1: Schema + Migration

## Database Schema (SQLite)

### `discovery_playlists` Table
- [ ] Define `discovery_playlists` table schema.
  - `id` (TEXT, Primary Key, e.g., UUID)
  - `title` (TEXT, Not Null) - *e.g., "New Discoveries", "Similar to Artist Name"*
  - `type` (TEXT, Not Null) - *e.g., "new_discoveries", "similar_to_artist"*
  - `target_artist_id` (TEXT, Nullable) - *Foreign key to `artists.artistId` if `type` is "similar_to_artist"*
  - `last_refreshed_at` (DATETIME, Not Null, Default CURRENT_TIMESTAMP)
  - `created_at` (DATETIME, Not Null, Default CURRENT_TIMESTAMP)

### `discovery_playlist_tracks` Table
- [ ] Define `discovery_playlist_tracks` table schema.
  - `id` (TEXT, Primary Key, e.g., UUID)
  - `playlist_id` (TEXT, Not Null) - *Foreign key to `discovery_playlists.id`*
  - `track_id` (TEXT, Not Null) - *Foreign key to `tracks.trackId`*
  - `order` (INTEGER, Not Null) - *Order of the track in the playlist*
  - `added_at` (DATETIME, Not Null, Default CURRENT_TIMESTAMP)
- [ ] Add unique constraint on (`playlist_id`, `track_id`).
- [ ] Add unique constraint on (`playlist_id`, `order`).

## Drizzle ORM

- [ ] Create Drizzle schema definition for `discovery_playlists` table (`server/db/schema/discovery-playlists.ts`).
- [ ] Create Drizzle schema definition for `discovery_playlist_tracks` table (`server/db/schema/discovery-playlist-tracks.ts`).
- [ ] Update main schema index (`server/db/schema/index.ts`) to include new schemas.

## Migration

- [ ] Generate database migration script using Drizzle Kit.
  ```sh
  pnpm drizzle-kit generate:sqlite --config=./drizzle.config.ts --out=./migrations --name=add_discovery_playlists
  ```
- [ ] Review generated migration script for correctness.
- [ ] Apply migration to the development database.
  ```sh
  pnpm drizzle-kit push:sqlite --config=./drizzle.config.ts
  ```
  *Comment: Or use `migrate` if a migration runner is set up.* 

```
