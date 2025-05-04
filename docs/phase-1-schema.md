# ✅ Phase 1: Database Schema

### Tables

#### `users`
```sql
id INTEGER PRIMARY KEY,
email TEXT UNIQUE NOT NULL,
password_hash TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `media_libraries`

```sql
id INTEGER PRIMARY KEY,
user_id INTEGER REFERENCES users(id),
path TEXT NOT NULL,
label TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `artists`

```sql
id INTEGER PRIMARY KEY,
name TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `albums`

```sql
id INTEGER PRIMARY KEY,
title TEXT NOT NULL,
artist_id INTEGER REFERENCES artists(id),
year INTEGER,
art_path TEXT,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

#### `tracks`

```sql
id INTEGER PRIMARY KEY,
title TEXT NOT NULL,
album_id INTEGER REFERENCES albums(id),
artist_id INTEGER REFERENCES artists(id),
genre TEXT,
duration REAL,
track_number INTEGER,
path TEXT NOT NULL,
created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
```

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

### Clarification Questions

* Should genres be normalized into a separate table?
* Store album art as blob or as file path?
* Should `users` support roles (e.g., admin)?
