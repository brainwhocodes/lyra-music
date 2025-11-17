import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import {
  eq,
  and,
  inArray,
  notInArray,
  count,
  sql,
  desc,
  ne,
  isNull,
  not,
} from 'drizzle-orm';
import * as schema from '~/server/db/schema';
import { getMoodsForTrackGenres, type Mood } from '~/server/utils/mood-service';

interface CandidateArtist {
  artistId: string;
  name: string;
  moods: Set<Mood>;
  moodOverlapScore: number;
}

/**
 * Generates a playlist of tracks similar to a seed artist, based on mood overlap.
 *
 * @param db - Drizzle ORM instance.
 * @param userId - The ID of the user (to potentially exclude tracks they already have).
 * @param seedArtistId - The ID of the artist to find similar music for.
 * @param targetPlaylistSize - The desired number of tracks in the playlist (e.g., 20-30).
 * @returns A promise that resolves to an array of track IDs for the playlist.
 */
export async function generateSimilarArtistPlaylist(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  seedArtistId: string,
  targetPlaylistSize: number = 30, // Adjusted default to 30 as per general plan
): Promise<string[]> {
  // 1. Get user's scanned library track IDs & artist counts.
  const userAlbums = await db
    .select({ albumId: schema.albums.albumId })
    .from(schema.albums)
    .where(eq(schema.albums.userId, userId));

  const userAlbumIds = userAlbums.map(album => album.albumId);

  let userScannedTrackIds: string[] = [];
  if (userAlbumIds.length > 0) {
    const userTracks = await db
      .select({ trackId: schema.tracks.trackId })
      .from(schema.tracks)
      .where(inArray(schema.tracks.albumId, userAlbumIds));
    userScannedTrackIds = userTracks.map(track => track.trackId);
  }

  const userScannedArtistTrackCounts = new Map<string, number>();
  if (userScannedTrackIds.length > 0) {
    const countsResult = await db
      .select({
        artistId: schema.artistsTracks.artistId,
        trackCount: count(schema.artistsTracks.trackId).as('track_count'),
      })
      .from(schema.artistsTracks)
      .where(inArray(schema.artistsTracks.trackId, userScannedTrackIds))
      .groupBy(schema.artistsTracks.artistId);

    for (const row of countsResult) {
      userScannedArtistTrackCounts.set(row.artistId, row.trackCount);
    }
  }

  // 2. Get Seed Artist's Moods
  const seedArtistTrackIdsQuery = await db
    .select({ trackId: schema.artistsTracks.trackId })
    .from(schema.artistsTracks)
    .where(eq(schema.artistsTracks.artistId, seedArtistId));
  
  const seedArtistTrackIds = seedArtistTrackIdsQuery.map(t => t.trackId);

  let seedArtistGenres: string[] = [];
  if (seedArtistTrackIds.length > 0) {
    const genreResults = await db
      .selectDistinct({ genre: schema.tracks.genre })
      .from(schema.tracks)
      .where(and(
        inArray(schema.tracks.trackId, seedArtistTrackIds),
        schema.tracks.genre ? not(isNull(schema.tracks.genre)) : undefined // Ensure genre is not null
      ));
    seedArtistGenres = genreResults.map(r => r.genre).filter(g => g !== null) as string[];
  }

  if (seedArtistGenres.length === 0) {
    console.warn(`Seed artist ${seedArtistId} has no genres. Cannot generate similar artist playlist.`);
    return [];
  }

  const seedArtistMoods: Set<Mood> = new Set(getMoodsForTrackGenres(seedArtistGenres));
  if (seedArtistMoods.size === 0) {
    console.warn(`Seed artist ${seedArtistId} has no discernible moods from genres: ${seedArtistGenres.join(', ')}. Cannot generate playlist.`);
    return [];
  }

  // 3. Find Candidate Artists and Mood Overlap
  const allTracksWithArtistAndGenre = await db
    .selectDistinct({
      trackId: schema.tracks.trackId,
      genre: schema.tracks.genre,
      artistId: schema.artistsTracks.artistId,
      artistName: schema.artists.name, // Include artist name
    })
    .from(schema.tracks)
    .innerJoin(schema.artistsTracks, eq(schema.tracks.trackId, schema.artistsTracks.trackId))
    .innerJoin(schema.artists, eq(schema.artistsTracks.artistId, schema.artists.artistId)) // Join to get artist name
    .where(and(
      ne(schema.artistsTracks.artistId, seedArtistId), // Exclude seed artist
      schema.tracks.genre ? not(isNull(schema.tracks.genre)) : undefined
    ));

  const artistDataMap = new Map<string, { name: string, genres: Set<string> }>();
  for (const item of allTracksWithArtistAndGenre) {
    if (!item.artistId || !item.genre || !item.artistName) continue;
    if (!artistDataMap.has(item.artistId)) {
      artistDataMap.set(item.artistId, { name: item.artistName, genres: new Set() });
    }
    artistDataMap.get(item.artistId)!.genres.add(item.genre);
  }

  const candidateArtists: CandidateArtist[] = [];
  const MIN_TRACKS_FOR_ELIGIBILITY = 3; // User should have less than this many tracks by the artist

  for (const [artistId, data] of artistDataMap.entries()) {
    const userTrackCountForArtist = userScannedArtistTrackCounts.get(artistId) || 0;
    if (userTrackCountForArtist >= MIN_TRACKS_FOR_ELIGIBILITY) {
      continue;
    }

    const artistGenresArray = Array.from(data.genres);
    if (artistGenresArray.length === 0) continue;

    const artistMoods = new Set(getMoodsForTrackGenres(artistGenresArray));
    if (artistMoods.size === 0) continue;

    let overlapScore = 0;
    for (const mood of artistMoods) {
      if (seedArtistMoods.has(mood)) {
        overlapScore++;
      }
    }

    if (overlapScore > 0) {
      candidateArtists.push({
        artistId: artistId,
        name: data.name,
        moods: artistMoods,
        moodOverlapScore: overlapScore,
      });
    }
  }

  // 4. Rank Artists by Mood Overlap Score
  candidateArtists.sort((a, b) => b.moodOverlapScore - a.moodOverlapScore);

  const playlistTrackIds: string[] = [];
  const MAX_ARTISTS_FOR_INITIAL_PASS = 20; // Consider top N artists for diversity
  const TRACKS_PER_ARTIST_PASS_1 = 2;

  // 5. Track Selection
  // Pass 1: Get a few tracks from a diverse set of top similar artists
  for (const candidate of candidateArtists.slice(0, MAX_ARTISTS_FOR_INITIAL_PASS)) {
    if (playlistTrackIds.length >= targetPlaylistSize) break;

    const tracksFromArtist = await db
      .select({ trackId: schema.tracks.trackId })
      .from(schema.tracks)
      .innerJoin(schema.artistsTracks, eq(schema.tracks.trackId, schema.artistsTracks.trackId))
      .where(and(
        eq(schema.artistsTracks.artistId, candidate.artistId),
        userScannedTrackIds.length > 0 ? notInArray(schema.tracks.trackId, userScannedTrackIds) : undefined,
        playlistTrackIds.length > 0 ? notInArray(schema.tracks.trackId, playlistTrackIds) : undefined
      ))
      .orderBy(sql`RANDOM()`)
      .limit(TRACKS_PER_ARTIST_PASS_1);

    for (const track of tracksFromArtist) {
      if (playlistTrackIds.length >= targetPlaylistSize) break;
      if (!playlistTrackIds.includes(track.trackId)) { // Double check, though notInArray should handle
        playlistTrackIds.push(track.trackId);
      }
    }
    if (playlistTrackIds.length >= targetPlaylistSize) break; // Check after each artist
  }

  // Pass 2: Fill remaining spots if playlist is not full, using all ranked candidates
  if (playlistTrackIds.length < targetPlaylistSize) {
    for (const candidate of candidateArtists) { // Iterate through all, respecting original rank
      if (playlistTrackIds.length >= targetPlaylistSize) break;

      const limitForThisArtist = targetPlaylistSize - playlistTrackIds.length;
      if (limitForThisArtist <= 0) break;

      const moreTracksFromArtist = await db
        .select({ trackId: schema.tracks.trackId })
        .from(schema.tracks)
        .innerJoin(schema.artistsTracks, eq(schema.tracks.trackId, schema.artistsTracks.trackId))
        .where(and(
          eq(schema.artistsTracks.artistId, candidate.artistId),
          userScannedTrackIds.length > 0 ? notInArray(schema.tracks.trackId, userScannedTrackIds) : undefined,
          playlistTrackIds.length > 0 ? notInArray(schema.tracks.trackId, playlistTrackIds) : undefined
        ))
        .orderBy(sql`RANDOM()`)
        .limit(limitForThisArtist); // Fetch up to remaining needed, artist might provide less

      for (const track of moreTracksFromArtist) {
        if (playlistTrackIds.length >= targetPlaylistSize) break;
        if (!playlistTrackIds.includes(track.trackId)) {
          playlistTrackIds.push(track.trackId);
        }
      }
      if (playlistTrackIds.length >= targetPlaylistSize) break; // Check after each artist
    }
  }

  // console.log(`Generated Similar Artist playlist with ${playlistTrackIds.length} tracks.`);
  // playlistTrackIds.forEach(tid => console.log(`  - Track ID: ${tid}`));

  return playlistTrackIds;
}
