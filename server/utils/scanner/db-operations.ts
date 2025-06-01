import { eq, and, sql, or } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import {
  artists,
  albums,
  tracks,
  genres,
  albumGenres,
  albumArtists,
  artistsTracks, // Added for many-to-many track-artist relationship
  type Album,
  type Artist,
  type Track, // Added Track type
  artistUsers,
} from '~/server/db/schema';
import { searchArtistByName, getArtistWithImages, extractArtistImageUrls, searchReleaseByTitleAndArtist } from '~/server/utils/musicbrainz';
import { albumArtUtils } from './album-art-utils';

// Interface for artist information when creating/updating albums
export interface AlbumArtistInfo {
  artistId: string;
  role?: string | null;
  isPrimary: boolean;
}

interface FindOrCreateArtistParams {
  artistName: string;
  userId: string;
  musicbrainzArtistId?: string | null; // Added for MBID integration
  skipRemoteImageFetch?: boolean;
}

interface GetOrCreateArtistMinimalParams {
  artistName: string;
  musicbrainzArtistId?: string | null; // Added for MBID integration
}

interface FindOrCreateAlbumParams {
  albumTitle: string;
  artistsArray: AlbumArtistInfo[]; // Changed from artistIds and primaryArtistId
  userId: string;
  year?: number | null;
  coverPath?: string | null;
  musicbrainzReleaseId?: string | null;
}

interface TrackFileMetadata {
  duration?: number | null;
  trackNumber?: number | null;
  diskNumber?: number | null;
  year?: number | null;
  genre?: string | null;
  explicit?: boolean | null;
}

// New interface for handling multiple artists per track with roles
export interface TrackArtistInfo {
  artistId: string;
  role: string; // e.g., 'main', 'featured', 'producer', 'remixer'
  isPrimary: boolean; // To identify primary artist(s) for display or main credit
}

interface FindOrCreateTrackParams {
  title: string;
  filePath: string;
  albumId: string | null;
  artists: TrackArtistInfo[]; // Replaces single artistId
  musicbrainzTrackId?: string | null; // Added for MBID integration (maps to musicbrainzRecordingId in schema)
  metadata: TrackFileMetadata;
}

/**
 * Finds or creates an artist and links them to a user.
 * Also fetches and saves artist images from MusicBrainz if available.
 */
export async function findOrCreateArtist({
  artistName,
  userId,
  musicbrainzArtistId, // New parameter
  skipRemoteImageFetch = false,
}: FindOrCreateArtistParams): Promise<Artist | null> {
  if (!artistName) return null;

  try {
    // Check if artist exists by name or provided MBID
    let queryCondition = musicbrainzArtistId
      ? or(eq(artists.name, artistName), eq(artists.musicbrainzArtistId, musicbrainzArtistId))
      : eq(artists.name, artistName);

    let existingArtistRecord = await db
      .select()
      .from(artists)
      .where(queryCondition)
      .limit(1);

    let artistRecord: Artist;
    let shouldFetchArtistImage = false;
    let mbidToUse: string | null = musicbrainzArtistId || null; // Start with provided MBID

    if (existingArtistRecord.length > 0) {
      artistRecord = existingArtistRecord[0];
      console.log(`  Found existing artist: ${artistName} (ID: ${artistRecord.artistId}, Current MBID: ${artistRecord.musicbrainzArtistId})`);

      // If a new MBID is provided and it's different, or if the existing record has no MBID yet
      if (mbidToUse && (!artistRecord.musicbrainzArtistId || artistRecord.musicbrainzArtistId !== mbidToUse)) {
        const updatedArtistWithMbid = await db.update(artists).set({
          musicbrainzArtistId: mbidToUse,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }).where(eq(artists.artistId, artistRecord.artistId)).returning();
        if (updatedArtistWithMbid.length > 0) artistRecord = updatedArtistWithMbid[0];
        console.log(`  Updated existing artist ${artistName} with MBID: ${mbidToUse}`);
      }
      
      // Use the potentially updated MBID from the record for image fetching
      mbidToUse = artistRecord.musicbrainzArtistId || mbidToUse; 

      if (!artistRecord.artistImage) {
        shouldFetchArtistImage = true;
      }
    } else {
      // Create a new artist
      const newArtistValues: Partial<Artist> = {
        artistId: uuidv7(),
        name: artistName,
      };
      if (mbidToUse) { // If MBID was provided for new artist
        newArtistValues.musicbrainzArtistId = mbidToUse;
      }

      const newArtistResult = await db
        .insert(artists)
        .values(newArtistValues as Artist) // Cast if properties are optional initially
        .returning();

      if (!newArtistResult || newArtistResult.length === 0) {
        console.error(`  Failed to create artist: ${artistName}`);
        return null;
      }
      
      artistRecord = newArtistResult[0];
      console.log(`  Created new artist: ${artistName} (ID: ${artistRecord.artistId}, MBID: ${artistRecord.musicbrainzArtistId})`);
      shouldFetchArtistImage = true;
      // mbidToUse is already set from params or is null
    }

    // Fetch artist image from MusicBrainz if needed and not skipped
    if (shouldFetchArtistImage && !skipRemoteImageFetch) {
      try {
        // If mbidToUse is still null (neither provided nor on existing record), try searching by name
        if (!mbidToUse) { 
          console.log(`  Searching MusicBrainz ID for (artist image fetch): ${artistName}`);
          const foundArtistByName = await searchArtistByName(artistName);
          if (foundArtistByName) {
            mbidToUse = foundArtistByName.id;
          }
        }
        
        if (mbidToUse) {
          // If MBID was just found by search and not on record, update the record
          if (!artistRecord.musicbrainzArtistId || artistRecord.musicbrainzArtistId !== mbidToUse) {
            const updatedArtistWithMbid = await db.update(artists).set({
              musicbrainzArtistId: mbidToUse,
              updatedAt: sql`CURRENT_TIMESTAMP`
            }).where(eq(artists.artistId, artistRecord.artistId)).returning();
            if (updatedArtistWithMbid.length > 0) artistRecord = updatedArtistWithMbid[0];
            console.log(`  Updated artist ${artistName} with fetched MBID for image: ${mbidToUse}`);
          }

          console.log(`  Fetching artist image for: ${artistName} using MBID: ${mbidToUse}`);
          const artistDetails = await getArtistWithImages(mbidToUse);
          if (artistDetails) {
            const imageUrls = extractArtistImageUrls(artistDetails);
            if (imageUrls.length > 0) {
              const imagePath = await albumArtUtils.downloadArtistImage(imageUrls[0]);
              if (imagePath) {
                const updatedArtistsWithImage = await db
                  .update(artists)
                  .set({ 
                    artistImage: imagePath,
                    updatedAt: sql`CURRENT_TIMESTAMP` 
                  })
                  .where(eq(artists.artistId, artistRecord.artistId))
                  .returning();
                if (updatedArtistsWithImage.length > 0) artistRecord = updatedArtistsWithImage[0];
                console.log(`  Updated artist ${artistName} with image: ${imagePath}`);
              }
            }
          }
        } else {
          console.log(`  No MBID found for artist (image fetch): ${artistName}`);
        }
      } catch (imageError: any) {
        console.error(`  Error fetching artist image for ${artistName}: ${imageError.message}`);
      }
    }

    if (userId) {
      await linkUserToArtist(userId, artistRecord.artistId, artistName);
    }

    return artistRecord;
  } catch (error: any) {
    console.error(`  Database error with artist ${artistName}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates an artist record by name or MBID, returning the basic artist object.
 * This function does NOT handle image fetching or user linking.
 */
export async function getOrCreateArtistMinimal({
  artistName,
  musicbrainzArtistId, // New parameter
}: GetOrCreateArtistMinimalParams): Promise<Artist | null> {
  if (!artistName) return null;

  try {
    let queryCondition = musicbrainzArtistId 
      ? or(eq(artists.name, artistName), eq(artists.musicbrainzArtistId, musicbrainzArtistId))
      : eq(artists.name, artistName);

    let existingArtistRecord = await db
      .select()
      .from(artists)
      .where(queryCondition)
      .limit(1);

    if (existingArtistRecord.length > 0) {
      const artist = existingArtistRecord[0];
      // If MBID was provided and differs from (or is missing on) the existing record, update it.
      if (musicbrainzArtistId && (!artist.musicbrainzArtistId || artist.musicbrainzArtistId !== musicbrainzArtistId)) {
        const updated = await db.update(artists)
          .set({ musicbrainzArtistId: musicbrainzArtistId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(artists.artistId, artist.artistId))
          .returning();
        return updated.length > 0 ? updated[0] : artist;
      }
      return artist;
    } else {
      // Create a new artist
      const newArtistValues: Partial<Artist> = {
        artistId: uuidv7(),
        name: artistName,
      };
      if (musicbrainzArtistId) {
        newArtistValues.musicbrainzArtistId = musicbrainzArtistId;
      }
      const newArtistResult = await db
        .insert(artists)
        .values(newArtistValues as Artist)
        .returning();

      return newArtistResult.length > 0 ? newArtistResult[0] : null;
    }
  } catch (error: any) {
    // console.error(`  [Minimal] Database error creating/finding artist ${artistName}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates an album and updates its art if needed.
 * Also creates many-to-many relationships with artists.
 */
export async function findOrCreateAlbum({
  albumTitle,
  artistsArray, // Changed from artistIds and primaryArtistId
  userId,
  year,
  coverPath,
  musicbrainzReleaseId,
}: FindOrCreateAlbumParams): Promise<Album | null> {
  if (!albumTitle || !artistsArray || artistsArray.length === 0) {
    return null;
  }

  try {
    let existingAlbumQuery; 
    const primaryArtistInfo = artistsArray.find(a => a.isPrimary);

    if (musicbrainzReleaseId) {
      existingAlbumQuery = db.select().from(albums).where(eq(albums.musicbrainzReleaseId, musicbrainzReleaseId)).limit(1);
    } else if (primaryArtistInfo) {
      existingAlbumQuery = db.select({
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId,
        userId: albums.userId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt
      })
        .from(albums)
        .leftJoin(albumArtists, eq(albums.albumId, albumArtists.albumId))
        .where(and(
          eq(albums.title, albumTitle),
          eq(albumArtists.artistId, primaryArtistInfo.artistId),
          eq(albumArtists.isPrimaryArtist, 1)
        ))
        .limit(1);
    } else {
      // Fallback: if no MBID and no primary artist specified, try by title only (less reliable)
      existingAlbumQuery = db.select({
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId,
        userId: albums.userId,
        createdAt: albums.createdAt,
        updatedAt: albums.updatedAt
      }).from(albums).where(eq(albums.title, albumTitle)).limit(1);
    }
    
    const existingAlbumResult = await existingAlbumQuery;
    let albumRecord: Album;

    if (existingAlbumResult.length > 0) {
      const firstResultItem = existingAlbumResult[0];
      // Check if the result item has a nested 'albums' property, which indicates a specific structure from a join query.
      if (firstResultItem && typeof firstResultItem === 'object' && 'albums' in firstResultItem && firstResultItem.albums !== null && typeof firstResultItem.albums === 'object') {
        // If so, the actual album data is within firstResultItem.albums
        albumRecord = firstResultItem.albums as Album;
      } else {
        // Otherwise, the item itself should be the album data.
        // This branch handles cases where the query result is directly an Album object.
        albumRecord = firstResultItem as Album;
      }
      // console.log(`  Found existing album: ${albumTitle} (ID: ${albumRecord.albumId})`);
      // If album exists, ensure MBID is up-to-date if provided
      if (musicbrainzReleaseId && albumRecord.musicbrainzReleaseId !== musicbrainzReleaseId) {
        const updatedResult = await db.update(albums)
          .set({ musicbrainzReleaseId: musicbrainzReleaseId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(albums.albumId, albumRecord.albumId))
          .returning();
        if (updatedResult.length > 0) albumRecord = updatedResult[0];
        // console.log(`  Updated album ${albumTitle} with MBID: ${musicbrainzReleaseId}`);
      }
    } else {
      const newAlbumId = uuidv7();
      const newAlbumResult = await db
        .insert(albums)
        .values({
          albumId: newAlbumId,
          title: albumTitle,
          year: year,
          coverPath: coverPath,
          musicbrainzReleaseId: musicbrainzReleaseId,
          userId: userId,
        })
        .returning();

      if (!newAlbumResult || newAlbumResult.length === 0) {
        // console.error(`  Failed to create album: ${albumTitle}`);
        return null;
      }
      albumRecord = newAlbumResult[0];
      // console.log(`  Created new album: ${albumTitle} (ID: ${albumRecord.albumId})`);
    }

    // --- Attempt to find MusicBrainz Release ID if missing ---
    if (!albumRecord.musicbrainzReleaseId && primaryArtistInfo && albumTitle) {
      const primaryArtistRecordResult = await db
        .select({ name: artists.name })
        .from(artists)
        .where(eq(artists.artistId, primaryArtistInfo.artistId))
        .limit(1);

      if (primaryArtistRecordResult.length > 0 && primaryArtistRecordResult[0].name) {
        const primaryArtistName = primaryArtistRecordResult[0].name;
        const newMusicbrainzReleaseId = await searchReleaseByTitleAndArtist(albumTitle, primaryArtistName);

        if (newMusicbrainzReleaseId) {
          const updatedResult = await db
            .update(albums)
            .set({ musicbrainzReleaseId: newMusicbrainzReleaseId, updatedAt: sql`CURRENT_TIMESTAMP` })
            .where(eq(albums.albumId, albumRecord.albumId))
            .returning();
          if (updatedResult.length > 0) {
            albumRecord = updatedResult[0]; // Ensure albumRecord is the most up-to-date version
          }
        }
      }
    }
    // --- End of MusicBrainz Release ID search ---

    // Manage album-artist relationships
    // First, clear existing relationships for this album
    await db.delete(albumArtists).where(eq(albumArtists.albumId, albumRecord.albumId));

    // Then, insert new relationships
    for (const artistInfo of artistsArray) {
      try {
        await db.insert(albumArtists).values({
          albumId: albumRecord.albumId,
          artistId: artistInfo.artistId,
          role: artistInfo.role ?? null,
          isPrimaryArtist: artistInfo.isPrimary ? 1 : 0,
        });
      } catch (linkError: any) {
        // console.warn(`  Could not link artist ${artistInfo.artistId} to album ${albumRecord.albumId}: ${linkError.message}`);
        // Optionally, collect errors or re-throw if critical
      }
    }
    
    // Logic for fetching/updating cover art
    // Check if we need to fetch cover art from MusicBrainz
    const shouldFetchFromMusicBrainz = albumRecord.musicbrainzReleaseId && !albumRecord.coverPath;

    if (shouldFetchFromMusicBrainz && albumRecord.musicbrainzReleaseId) { // Ensure MBID is valid before fetching
      const downloadedArtPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(albumRecord.musicbrainzReleaseId);
      if (downloadedArtPath) {
        const updatedResult = await db
          .update(albums)
          .set({ coverPath: downloadedArtPath, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(albums.albumId, albumRecord.albumId))
          .returning();
        if (updatedResult.length > 0) albumRecord = updatedResult[0];
        // console.log(`  Updated album ${albumTitle} with cover art: ${downloadedCoverPath}`);
      }
    } else if (coverPath && !albumRecord.coverPath) {
      // If a local coverPath is provided and the album doesn't have one, update it
      const updatedResult = await db
        .update(albums)
        .set({ coverPath: coverPath, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(albums.albumId, albumRecord.albumId))
        .returning();
      if (updatedResult.length > 0) albumRecord = updatedResult[0];
      // console.log(`  Updated album ${albumTitle} with local cover art: ${coverPath}`);
    }

    return albumRecord;
  } catch (error: any) {
    // console.error(`  Database error with album ${albumTitle}: ${error.message}`);
    return null;
  }
}


/**
 * Finds or creates a track in the database.
 */
export async function findOrCreateTrack({
  title,
  filePath,
  albumId,
  artists: trackArtists, // Changed from artistId
  musicbrainzTrackId,    // New field (maps to musicbrainzRecordingId in schema)
  metadata,
}: FindOrCreateTrackParams): Promise<Track | null> { // Return Track object or null
  if (!title || !filePath || !trackArtists || trackArtists.length === 0) {
    // Consider a more robust logging solution or simply return null for expected missing data.
    return null;
  }

  try {
    let existingTrack = await db
      .select()
      .from(tracks)
      .where(eq(tracks.filePath, filePath)) // Assuming filePath is unique identifier for a track file
      .limit(1);

    let trackRecord: Track;
    const trackData = {
      title: title,
      filePath: filePath,
      albumId: albumId,
      // artistId is removed, handled by artistsToTracks table
      duration: metadata.duration,
      trackNumber: metadata.trackNumber,
      diskNumber: metadata.diskNumber,
      year: metadata.year,
      musicbrainzTrackId: musicbrainzTrackId, // Correct field name for tracks table
      explicit: metadata.explicit ?? false, // Default to false if null/undefined
    };

    if (existingTrack.length > 0) {
      trackRecord = existingTrack[0];
      // Update existing track with new data
      const updatedTrackResult = await db
        .update(tracks)
        .set({
          ...trackData,
          title: title,
          albumId: albumId,
          musicbrainzTrackId: musicbrainzTrackId, // Correct field name
          explicit: metadata.explicit ?? false,
          updatedAt: sql`CURRENT_TIMESTAMP`,
        })
        .where(eq(tracks.trackId, trackRecord.trackId))
        .returning();
      if (updatedTrackResult.length > 0) trackRecord = updatedTrackResult[0];
      // console.log(`  Updated existing track: ${title} (ID: ${trackRecord.trackId})`);
    } else {
      const newTrackId = uuidv7();
      const newTrackResult = await db
        .insert(tracks)
        .values({
          trackId: newTrackId,
          ...trackData, // Spread new data
        })
        .returning();
      
      if (!newTrackResult || newTrackResult.length === 0) {
        // console.error(`  Failed to create track: ${title}`);
        return null;
      }
      trackRecord = newTrackResult[0];
      // console.log(`  Created new track: ${title} (ID: ${trackRecord.trackId})`);
    }

    // Manage artist-track relationships in artistsToTracks
    // First, clear existing relationships for this track to handle updates correctly (e.g., artist changes)
    // console.log(`  Clearing existing artist links for track: ${trackRecord.trackId}`);
    await db.delete(artistsTracks).where(eq(artistsTracks.trackId, trackRecord.trackId));
    
    // Then, insert new relationships 
    // console.log(`  Inserting new artist links for track: ${trackRecord.trackId}`);
    for (const artistInfo of trackArtists) {
      try {
        await db.insert(artistsTracks).values({
          artistId: artistInfo.artistId,
          trackId: trackRecord.trackId,
          role: artistInfo.role,
          isPrimaryArtist: artistInfo.isPrimary ? 1 : 0,
        });
      } catch (linkError: any) {
        // console.error(`  Error linking artist ${artistInfo.artistId} to track ${trackRecord.trackId} with role ${artistInfo.role}: ${linkError.message}`);
        // Depending on desired behavior, might re-throw or collect errors
      }
    }
    // console.log(`  Processed ${trackArtists.length} artist links for track: ${title}`);

    // Handle genre (linking to album, as tracks don't directly link to genres in this schema)
    if (metadata.genre) {
      const genreId = await findOrCreateGenre(metadata.genre);
      if (genreId && albumId) { 
        await linkAlbumToGenre(albumId, genreId);
      }
    }
    return trackRecord; // Return the full track object
  } catch (error: any) {
    // console.error(`  Database error with track ${title}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates a genre in the database.
 * @param genreName The name of the genre.
 * @returns The ID of the found or created genre, or null if an error occurs or name is empty.
 */
export async function findOrCreateGenre(genreName: string): Promise<string | null> {
  if (!genreName) return null;

  try {
    let existingGenre = await db
      .select()
      .from(genres)
      .where(eq(genres.name, genreName))
      .limit(1);

    if (existingGenre.length > 0) {
      return existingGenre[0].genreId;
    } else {
      const newGenreId = uuidv7();
      const newGenreResult = await db
        .insert(genres)
        .values({ genreId: newGenreId, name: genreName })
        .returning({ genreId: genres.genreId });
      
      return newGenreResult.length > 0 ? newGenreResult[0].genreId : null;
    }
  } catch (error: any) {
    console.error(`  Database error with genre ${genreName}: ${error.message}`);
    return null;
  }
}

/**
 * Links an album to a genre in the database if the link does not already exist.
 * @param albumId The ID of the album.
 * @param genreId The ID of the genre.
 */
export async function linkAlbumToGenre(albumId: string, genreId: string): Promise<void> {
  if (!albumId || !genreId) return;

  try {
    // Check if the link already exists
    const existingLink = await db
      .select()
      .from(albumGenres)
      .where(and(eq(albumGenres.albumId, albumId), eq(albumGenres.genreId, genreId)))
      .limit(1);

    if (existingLink.length === 0) {
      await db.insert(albumGenres).values({
        albumGenreId: uuidv7(),
        albumId: albumId,
        genreId: genreId,
      });
      // console.log(`  Linked album ${albumId} to genre ${genreId}`);
    }
  } catch (error: any) {
    console.error(`  Error linking album ${albumId} to genre ${genreId}: ${error.message}`);
  }
}

/**
 * Checks if an album has any genres linked in the database.
 * @param albumId The ID of the album.
 * @returns True if the album has one or more genres, false otherwise.
 */
export async function hasAlbumGenres(albumId: string): Promise<boolean> {
  if (!albumId) return false;
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(albumGenres)
      .where(eq(albumGenres.albumId, albumId));
    return result[0].count > 0;
  } catch (error) {
    console.error(`Error checking genres for album ${albumId}:`, error);
    return false;
  }
}

/**
 * Links a user to an artist if not already linked.
 */
export async function linkUserToArtist(
  userId: string, 
  artistId: string, 
  artistName: string // For logging
): Promise<void> {
  if (!userId || !artistId) return;

  try {
    const existingLink = await db
      .select()
      .from(artistUsers)
      .where(and(eq(artistUsers.userId, userId), eq(artistUsers.artistId, artistId)))
      .limit(1);

    if (existingLink.length === 0) {
      await db.insert(artistUsers).values({
        artistUserId: uuidv7(),
        userId: userId,
        artistId: artistId,
      });
      console.log(`  Linked user ${userId} to artist ${artistName} (ID: ${artistId})`);
    }
  } catch (error: any) {
    console.error(`  Error linking user ${userId} to artist ${artistName} (ID: ${artistId}): ${error.message}`);
  }
}


export const dbOperations = {
  findOrCreateArtist,
  getOrCreateArtistMinimal,
  findOrCreateAlbum,
  findOrCreateTrack,
  findOrCreateGenre,
  linkAlbumToGenre,
  hasAlbumGenres,
  linkUserToArtist,
};
