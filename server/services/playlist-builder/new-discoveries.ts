import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { DateTime } from 'luxon';
import { schema } from '~/server/db'; // Assuming schema is available from here
import { eq, gte, inArray, notInArray, sql, count, desc, and } from 'drizzle-orm';

/**
 * Generates a "New Discoveries" playlist for a given user using Drizzle ORM.
 * Criteria:
 * - Playlist Target Size: ~30 tracks.
 * - Artist Eligibility:
 *   1. Artist added to system (artists.createdAt) in the last 12 months.
 *   2. User has < 3 tracks by this artist in their scanned library (tracks from albums where albums.userId = userId).
 * - Track Selection per Artist:
 *   1. Initially, 2 tracks per eligible artist (not in user's scanned library).
 *   2. If playlist < targetPlaylistSize, add more tracks from eligible artists.
 *
 * @param db - Drizzle ORM database instance for BetterSQLite3.
 * @param userId - The ID of the user for whom to generate the playlist.
 * @param targetPlaylistSize - The desired number of tracks in the playlist (e.g., 30).
 * @returns A promise that resolves to an array of track IDs for the playlist.
 */
const RECENTLY_PLAYED_DAYS = 60;

export async function generateNewDiscoveriesPlaylist(
  db: BetterSQLite3Database<typeof schema>,
  userId: string,
  targetPlaylistSize: number = 30,
): Promise<string[]> {
  // 1. Get user's scanned library track IDs & artist counts.
  const userAlbums = await db.select({ albumId: schema.albums.albumId })
    .from(schema.albums)
    .where(eq(schema.albums.userId, userId));
  const userAlbumIds = userAlbums.map(album => album.albumId);

  console.log(`[New Discoveries - ${userId}] Found ${userAlbumIds.length} user albums.`);

  let userScannedTrackIds: string[] = [];
  if (userAlbumIds.length > 0) {
    const userTracks = await db.select({ trackId: schema.tracks.trackId })
      .from(schema.tracks)
      .where(inArray(schema.tracks.albumId, userAlbumIds));
    userScannedTrackIds = userTracks.map(track => track.trackId);
  }
  console.log(`[New Discoveries - ${userId}] Found ${userScannedTrackIds.length} tracks in user's scanned library.`);

  const userScannedArtistTrackCounts = new Map<string, number>();
  if (userScannedTrackIds.length > 0) {
    const countsResult = await db.select({
      artistId: schema.artistsTracks.artistId,
      trackCount: count(schema.artistsTracks.trackId),
    })
    .from(schema.artistsTracks)
    .where(inArray(schema.artistsTracks.trackId, userScannedTrackIds))
    .groupBy(schema.artistsTracks.artistId);

    for (const row of countsResult) {
      userScannedArtistTrackCounts.set(row.artistId, row.trackCount);
    }
  }
  console.log(`[New Discoveries - ${userId}] User scanned artist track counts calculated: ${userScannedArtistTrackCounts.size} artists found.`);

  // 2. Fetch user's recently played track IDs.
  const recentlyPlayedCutoff = DateTime.now().minus({ days: RECENTLY_PLAYED_DAYS }).toISO();
  if (!recentlyPlayedCutoff) {
    console.error(`[New Discoveries - ${userId}] Failed to calculate recentlyPlayedCutoff for generateNewDiscoveriesPlaylist. Aborting.`);
    return [];
  }

  const recentPlays = await db.selectDistinct({ trackId: schema.userTrackPlays.trackId })
    .from(schema.userTrackPlays)
    .where(and(
      eq(schema.userTrackPlays.userId, userId),
      gte(schema.userTrackPlays.playedAt, recentlyPlayedCutoff)
    ));
  const recentlyPlayedTrackIds = recentPlays.map(play => play.trackId);
  console.log(`[New Discoveries - ${userId}] Found ${recentlyPlayedTrackIds.length} recently played tracks (last ${RECENTLY_PLAYED_DAYS} days).`);

  // 3. Find artists created in the last 12 months.
  const twelveMonthsAgo = DateTime.now().minus({ months: 12 }).toISO();
  if (!twelveMonthsAgo) {
    console.error(`[New Discoveries - ${userId}] Failed to calculate twelveMonthsAgo for generateNewDiscoveriesPlaylist. Aborting.`);
    return [];
  }
  const recentArtists = await db.select({
      artistId: schema.artists.artistId,
      name: schema.artists.name,
    })
    .from(schema.artists)
    .where(gte(schema.artists.createdAt, twelveMonthsAgo))
    .orderBy(desc(schema.artists.createdAt));
  console.log(`[New Discoveries - ${userId}] Found ${recentArtists.length} artists created in the last 12 months.`);

  // 4. Filter artists based on user's track count (< 3 in scanned library).
  const eligibleArtists = recentArtists.filter(artist => {
    const countInUserLibrary = userScannedArtistTrackCounts.get(artist.artistId) || 0;
    return countInUserLibrary < 3;
  });
  console.log(`[New Discoveries - ${userId}] Found ${eligibleArtists.length} eligible artists (created recently & <3 tracks in user library).`);

  // 5. Select tracks from eligible artists
  const playlistTrackIds: string[] = [];
  const includedArtistsForPass1 = new Set<string>();

  // Pass 1: Try to get up to 2 tracks from each eligible artist
  console.log(`[New Discoveries - ${userId}] Starting Pass 1 for track selection.`);
  for (const artist of eligibleArtists) {
    if (playlistTrackIds.length >= targetPlaylistSize) break;

    const conditions = [eq(schema.artistsTracks.artistId, artist.artistId)];
    if (userScannedTrackIds.length > 0) {
      conditions.push(notInArray(schema.tracks.trackId, userScannedTrackIds));
    }
    if (recentlyPlayedTrackIds.length > 0) {
      conditions.push(notInArray(schema.tracks.trackId, recentlyPlayedTrackIds));
    }
    if (playlistTrackIds.length > 0) {
      conditions.push(notInArray(schema.tracks.trackId, playlistTrackIds));
    }

    const artistTracks = await db.select({ trackId: schema.tracks.trackId })
      .from(schema.tracks)
      .innerJoin(schema.artistsTracks, eq(schema.tracks.trackId, schema.artistsTracks.trackId))
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(2);
    console.log(`[New Discoveries - ${userId}] Pass 1: For artist ${artist.name} (${artist.artistId}), found ${artistTracks.length} potential tracks.`);

    let tracksAddedForThisArtistInPass1 = 0;
    for (const track of artistTracks) {
      if (playlistTrackIds.length >= targetPlaylistSize) break;
      playlistTrackIds.push(track.trackId);
      tracksAddedForThisArtistInPass1++;
    }
    if (tracksAddedForThisArtistInPass1 > 0) {
      includedArtistsForPass1.add(artist.artistId);
    }
  }
  console.log(`[New Discoveries - ${userId}] After Pass 1, playlist has ${playlistTrackIds.length} tracks.`);

  // Pass 2: Fill remaining spots if playlist is not full
  if (playlistTrackIds.length < targetPlaylistSize) {
    console.log(`[New Discoveries - ${userId}] Pass 2: Playlist size ${playlistTrackIds.length}, target ${targetPlaylistSize}. Attempting to fill remaining spots.`);
    const artistsForPass2 = [
      ...eligibleArtists.filter(artist => includedArtistsForPass1.has(artist.artistId)),
      ...eligibleArtists.filter(artist => !includedArtistsForPass1.has(artist.artistId)),
    ];

    for (const artist of artistsForPass2) {
      if (playlistTrackIds.length >= targetPlaylistSize) break;
      const limitForThisArtist = targetPlaylistSize - playlistTrackIds.length;
      if (limitForThisArtist <= 0) break;

      const conditions = [eq(schema.artistsTracks.artistId, artist.artistId)];
      if (userScannedTrackIds.length > 0) {
        conditions.push(notInArray(schema.tracks.trackId, userScannedTrackIds));
      }
      if (recentlyPlayedTrackIds.length > 0) {
        conditions.push(notInArray(schema.tracks.trackId, recentlyPlayedTrackIds));
      }
      if (playlistTrackIds.length > 0) {
        conditions.push(notInArray(schema.tracks.trackId, playlistTrackIds));
      }

      const moreArtistTracks = await db.select({ trackId: schema.tracks.trackId })
        .from(schema.tracks)
        .innerJoin(schema.artistsTracks, eq(schema.tracks.trackId, schema.artistsTracks.trackId))
        .where(and(...conditions))
        .orderBy(sql`RANDOM()`)
        .limit(limitForThisArtist);
      console.log(`[New Discoveries - ${userId}] Pass 2: For artist ${artist.name} (${artist.artistId}), found ${moreArtistTracks.length} additional potential tracks.`);

      for (const track of moreArtistTracks) {
        if (playlistTrackIds.length >= targetPlaylistSize) break;
        playlistTrackIds.push(track.trackId);
      }
    }
  }
  console.log(`[New Discoveries - ${userId}] Final playlist has ${playlistTrackIds.length} tracks.`);
  return playlistTrackIds;
}
