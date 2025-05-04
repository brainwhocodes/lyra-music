# ✅ Phase 5: Playlist Management

### Tables

#### `playlists`

```sql
id INTEGER PRIMARY KEY,
user_id INTEGER REFERENCES users(id),
name TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `playlist_tracks`

```sql
playlist_id INTEGER REFERENCES playlists(id),
track_id INTEGER REFERENCES tracks(id),
order INTEGER,
PRIMARY KEY (playlist_id, track_id)
```

### Tasks

* [ ] `POST /api/playlists` – create playlist
* [ ] `GET /api/playlists/:id` – view playlist
* [ ] `POST /api/playlists/:id/tracks` – add or remove tracks
* [ ] `POST /api/playlists/:id/reorder` – save new order
* [ ] `DELETE /api/playlists/:id` – delete playlist
* [ ] UI:

  * Playlist editor (modal or page)
  * Drag-and-drop track sorting
  * Show album art & duration

### Clarification Questions

* Can playlists contain the same track more than once?
* Should we support importing/exporting playlists (M3U or JSON)?
* Are playlists public or private by default?
