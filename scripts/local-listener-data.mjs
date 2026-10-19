import { v5 as uuidv5 } from 'uuid';

const id = (owner, kind, source) => uuidv5(`${kind}:${source}`, owner);
function insert(db, table, row) {
  const columns = Object.keys(row);
  if (![table, ...columns].every(value => /^[a-z_]+$/.test(value))) throw new Error('Invalid seed schema');
  db.prepare(`INSERT INTO ${table} (${columns.join(',')}) VALUES (${columns.map(() => '?').join(',')})`).run(...Object.values(row));
}

/** Add verified metadata to one account; never transfer an existing file or copy listening/model results. */
export function seedLocalListener(db, source, sourceUserId, userId) {
  if (!db.prepare('SELECT 1 FROM users WHERE user_id=?').get(userId)) throw new Error('Register the local account first');
  const albums = source.prepare('SELECT * FROM albums WHERE user_id=? ORDER BY album_id').all(sourceUserId);
  const tracks = source.prepare('SELECT t.* FROM tracks t JOIN albums a ON a.album_id=t.album_id WHERE a.user_id=? ORDER BY t.track_id').all(sourceUserId);
  if (!albums.length || !tracks.length) throw new Error('Verified source library is empty');
  const mappedAlbum = value => id(userId, 'album', value);
  const mappedTrack = value => id(userId, 'track', value);
  const albumIds = new Set(albums.map(row => row.album_id));
  const trackIds = new Set(tracks.map(row => row.track_id));
  const albumArtists = source.prepare('SELECT * FROM album_artists').all().filter(row => albumIds.has(row.album_id));
  const artistTracks = source.prepare('SELECT * FROM artists_tracks').all().filter(row => trackIds.has(row.track_id));
  const artistIds = new Set([...albumArtists, ...artistTracks].map(row => row.artist_id));
  const artists = source.prepare('SELECT * FROM artists').all().filter(row => artistIds.has(row.artist_id));
  const albumGenres = source.prepare('SELECT * FROM album_genres').all().filter(row => albumIds.has(row.album_id));
  const genreIds = new Set(albumGenres.map(row => row.genre_id));
  const genres = source.prepare('SELECT * FROM genres').all().filter(row => genreIds.has(row.genre_id));
  const now = new Date().toISOString();
  return db.transaction(() => {
    let existingTracks = 0, existingAlbums = 0;
    for (const track of tracks) {
      const existing = db.prepare('SELECT t.track_id,a.user_id FROM tracks t LEFT JOIN albums a ON a.album_id=t.album_id WHERE t.file_path=? OR t.track_id=?')
        .all(track.file_path, mappedTrack(track.track_id));
      if (existing.some(row => row.user_id !== userId || row.track_id !== mappedTrack(track.track_id))) throw new Error('A source audio file already belongs to another library; refusing reassignment');
      existingTracks += existing.length;
    }
    for (const album of albums) {
      const existing = db.prepare('SELECT user_id FROM albums WHERE album_id=?').get(mappedAlbum(album.album_id));
      if (existing && existing.user_id !== userId) throw new Error('Album identity belongs to another account');
      if (existing) existingAlbums++;
    }
    if (existingTracks || existingAlbums) {
      if (existingTracks !== tracks.length || existingAlbums !== albums.length) throw new Error('Local seed has changed or is incomplete; refusing to restore or overwrite user changes');
      return { reused: true, albums: albums.length, tracks: tracks.length };
    }
    const mappedArtist = value => id(userId, 'artist', value);
    for (const artist of artists) {
      insert(db, 'artists', { ...artist, artist_id: mappedArtist(artist.artist_id), artist_image: null, created_at: now, updated_at: now });
      insert(db, 'artist_users', { artist_user_id: id(userId, 'artist-user', artist.artist_id), artist_id: mappedArtist(artist.artist_id), user_id: userId, created_at: now });
    }
    const mappedGenres = new Map();
    for (const genre of genres) {
      const existing = db.prepare('SELECT genre_id FROM genres WHERE name=?').get(genre.name);
      const targetId = existing?.genre_id || id(userId, 'genre', genre.genre_id);
      mappedGenres.set(genre.genre_id, targetId);
      if (!existing) insert(db, 'genres', { ...genre, genre_id: targetId, created_at: now, updated_at: now });
    }
    for (const album of albums) insert(db, 'albums', { ...album, album_id: mappedAlbum(album.album_id), user_id: userId,
      cover_path: album.cover_path ? `/uploads/images/covers/${mappedAlbum(album.album_id)}.webp` : null, created_at: now, updated_at: now });
    for (const track of tracks) insert(db, 'tracks', { ...track, track_id: mappedTrack(track.track_id), album_id: mappedAlbum(track.album_id), created_at: now, updated_at: now });
    for (const row of albumArtists) insert(db, 'album_artists', { ...row, album_artist_id: id(userId, 'album-artist', row.album_artist_id), album_id: mappedAlbum(row.album_id), artist_id: mappedArtist(row.artist_id), created_at: now });
    for (const row of artistTracks) insert(db, 'artists_tracks', { ...row, artists_tracks_id: id(userId, 'artist-track', row.artists_tracks_id), artist_id: mappedArtist(row.artist_id), track_id: mappedTrack(row.track_id), created_at: now, updated_at: now });
    for (const row of albumGenres) insert(db, 'album_genres', { ...row, album_genre_id: id(userId, 'album-genre', row.album_genre_id), album_id: mappedAlbum(row.album_id), genre_id: mappedGenres.get(row.genre_id), created_at: now, updated_at: now });
    return { reused: false, albums: albums.length, tracks: tracks.length };
  })();
}

export const localAlbumId = (userId, sourceAlbumId) => id(userId, 'album', sourceAlbumId);
