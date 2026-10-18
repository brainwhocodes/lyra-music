import { createHash } from 'node:crypto';
import { and, desc, eq } from 'drizzle-orm';
import { db } from '../../db';
import { albumGenres, albums, artists, artistsTracks, genres, lyrics, tracks, trackEmbeddings, userTrackPlays } from '../../db/schema';
import { IntelligenceError, type IndexedTrack, type LibraryTrack } from './types';
import { embeddingConfig } from './embedding-service';
type Config = ReturnType<typeof embeddingConfig>;
type EmbeddingRow = typeof trackEmbeddings.$inferInsert;

export function trackContent(track: LibraryTrack): string {
  // Genre and lyric content describe the music more directly than poetic titles.
  // Retrieval adds the title once through its documented title prefix; symmetric
  // category/similarity prompts use it only when there is no richer description.
  const description = [
    track.genre ? `Genre: ${track.genre.slice(0, 200)}` : '',
    track.lyrics ? `Lyrics: ${track.lyrics.slice(0, 3000)}` : '',
    !track.genre && !track.lyrics ? `Title: ${track.title.slice(0, 200)}` : '',
    `Album: ${track.albumTitle.slice(0, 200)}`,
    track.artists.length ? `Artists: ${track.artists.join(', ').slice(0, 400)}` : '',
    track.year ? `Year: ${track.year}` : '',
  ].filter(Boolean).join('\n');
  return description.slice(0, 4000);
}

export function trackContentHash(track: LibraryTrack): string {
  // Bump this version when formatting, task prompts, or truncation policy changes.
  return createHash('sha256').update(`music-text-v2-clustering\ntitle: ${track.title.slice(0, 200)}\n${trackContent(track)}`).digest('hex');
}

function validVector(vector: unknown, dimensions: number): vector is number[] {
  return Array.isArray(vector) && vector.length === dimensions && vector.every(v => typeof v === 'number' && Number.isFinite(v)) && Math.abs(Math.hypot(...vector) - 1) <= 0.01;
}

export function readLibrary(userId: string, config: Config) {
  if (!userId) throw new IntelligenceError('Authentication required.', 401);
  const rows = db.select({
    trackId: tracks.trackId, title: tracks.title, albumId: albums.albumId, albumTitle: albums.title,
    genre: tracks.genre, year: tracks.year, duration: tracks.duration, coverPath: albums.coverPath,
    createdAt: tracks.createdAt, lyricsJson: lyrics.lyricsJson, embedding: trackEmbeddings,
  }).from(tracks).innerJoin(albums, eq(tracks.albumId, albums.albumId))
    .leftJoin(lyrics, eq(lyrics.trackId, tracks.trackId))
    .leftJoin(trackEmbeddings, eq(trackEmbeddings.trackId, tracks.trackId))
    .where(eq(albums.userId, userId)).orderBy(tracks.trackId).limit(config.maxTracks + 1).all();
  if (rows.length > config.maxTracks) throw new IntelligenceError(`Your library exceeds the configured ${config.maxTracks}-track semantic index limit. Increase embeddingMaxTracks up to 20000.`, 413);
  const artistRows = db.select({ trackId: tracks.trackId, name: artists.name }).from(artistsTracks)
    .innerJoin(artists, eq(artists.artistId, artistsTracks.artistId))
    .innerJoin(tracks, eq(tracks.trackId, artistsTracks.trackId))
    .innerJoin(albums, eq(albums.albumId, tracks.albumId)).where(eq(albums.userId, userId)).all();
  const artistMap = new Map<string, string[]>();
  for (const item of artistRows) artistMap.set(item.trackId, [...(artistMap.get(item.trackId) ?? []), item.name]);
  const genreRows = db.select({ albumId: albums.albumId, name: genres.name }).from(albumGenres)
    .innerJoin(genres, eq(genres.genreId, albumGenres.genreId))
    .innerJoin(albums, eq(albums.albumId, albumGenres.albumId)).where(eq(albums.userId, userId)).all();
  const genreMap = new Map<string, string[]>();
  for (const item of genreRows) genreMap.set(item.albumId, [...(genreMap.get(item.albumId) ?? []), item.name]);
  const indexed: IndexedTrack[] = [];
  const pending: LibraryTrack[] = [];
  for (const row of rows) {
    const track: LibraryTrack = {
      trackId: row.trackId, title: row.title, albumId: row.albumId, albumTitle: row.albumTitle,
      genre: row.genre || [...new Set(genreMap.get(row.albumId) ?? [])].sort().join(', ') || null,
      year: row.year, duration: row.duration, coverPath: row.coverPath, createdAt: row.createdAt,
      artists: [...new Set(artistMap.get(row.trackId) ?? [])].sort(),
      lyrics: Array.isArray(row.lyricsJson) ? row.lyricsJson.filter(line => line && typeof line.text === 'string').map(line => line.text).join(' ').slice(0, 4000) : '',
    };
    const saved = row.embedding;
    if (saved && saved.model === config.model && saved.revision === config.revision && saved.dimensions === config.dimensions &&
        saved.contentHash === trackContentHash(track) && validVector(saved.retrievalVector, config.dimensions) &&
        validVector(saved.classificationVector, config.dimensions) && validVector(saved.similarityVector, config.dimensions)) {
      indexed.push({ ...track, retrievalVector: saved.retrievalVector, classificationVector: saved.classificationVector, similarityVector: saved.similarityVector });
    } else pending.push(track);
  }
  return { indexed, pending, totalTracks: rows.length };
}

/** Recheck both ownership and content after asynchronous inference, inside the write transaction. */
export function saveEmbeddings(userId: string, config: Config, rows: EmbeddingRow[]): number {
  return db.transaction(() => {
    const current = readLibrary(userId, config);
    const hashes = new Map([...current.indexed, ...current.pending].map(track => [track.trackId, trackContentHash(track)]));
    let saved = 0;
    for (const row of rows) {
      if (hashes.get(row.trackId) !== row.contentHash) continue;
      db.insert(trackEmbeddings).values(row).onConflictDoUpdate({ target: trackEmbeddings.trackId, set: row }).run();
      saved++;
    }
    return saved;
  });
}

export function readHistory(userId: string) {
  return db.select({ trackId: userTrackPlays.trackId, playedAt: userTrackPlays.playedAt, playDurationMs: userTrackPlays.playDurationMs })
    .from(userTrackPlays).innerJoin(tracks, eq(tracks.trackId, userTrackPlays.trackId)).innerJoin(albums, eq(albums.albumId, tracks.albumId))
    .where(and(eq(userTrackPlays.userId, userId), eq(albums.userId, userId))).orderBy(desc(userTrackPlays.playedAt)).limit(500).all();
}
