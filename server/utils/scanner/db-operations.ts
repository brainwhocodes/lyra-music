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
import { searchReleaseByTitleAndArtist } from '~/server/utils/musicbrainz'; // searchArtistByName, getArtistWithImages, extractArtistImageUrls removed as artist images will now be fetched from Genius
import { GeniusService, type GeniusArtist as GeniusApiArtistInterface } from '~/server/utils/genius-service';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { useRuntimeConfig } from '#imports';
import { albumArtUtils } from './album-art-utils';

// In-memory cache for scan session
const artistCache = new Map<string, Artist>();
const albumCache = new Map<string, Album>();
const trackCache = new Map<string, Track>();
const genreCache = new Map<string, string>(); // Maps genre name to genre ID
// New caches for album-artist relationships and album-genre relationships
const albumArtistsCache = new Map<string, { artistId: string; role: string | null; isPrimary: boolean }[]>();
const albumGenresCache = new Map<string, boolean>();
// New cache for track-artist relationships
const trackArtistsCache = new Map<string, { artistId: string; role: string | null; isPrimary: boolean }[]>();

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

export interface FindOrCreateAlbumParams {
  albumTitle: string;
  artistsArray: AlbumArtistInfo[]; // Changed from artistIds and primaryArtistId
  userId: string;
  year?: number | null;
  coverPath?: string | null;
  musicbrainzReleaseId?: string | null;
}

export interface TrackFileMetadata {
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

// Interface for artist information when creating/updating albums
export interface AlbumArtistInfo {
  artistId: string;
  role?: string | null;
  isPrimary: boolean;
}

/**
 * Finds or creates an artist and links them to a user.
 * Also fetches and saves artist images from MusicBrainz if available.
 */
function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w-]+/g, '') // Remove all non-word chars
    .replace(/--+/g, '-'); // Replace multiple - with single -
}

export async function findOrCreateArtist({
  artistName,
  userId,
  musicbrainzArtistId, // New parameter
  skipRemoteImageFetch = false,
}: FindOrCreateArtistParams): Promise<Artist | null> {
  if (!artistName) return null;

  try {
    // Create a cache key based on artist name and MBID (if provided)
    const cacheKey = `${artistName}:${musicbrainzArtistId || 'null'}`;
    
    // Check if we already have this artist in our cache
    if (artistCache.has(cacheKey)) {
      return artistCache.get(cacheKey)!;
    }
    
    // Not in cache, query the database
    let existingArtistRecord = await db
      .select()
      .from(artists)
      .where(
        musicbrainzArtistId
          ? or(eq(artists.name, artistName), eq(artists.musicbrainzArtistId, musicbrainzArtistId))
          : eq(artists.name, artistName)
      )
      .limit(1);

    let artistRecord: Artist;
    let shouldFetchArtistImage = false;
    let mbidToUse: string | null = musicbrainzArtistId || null; // Start with provided MBID

    if (existingArtistRecord.length > 0) {
      artistRecord = existingArtistRecord[0];
      console.log(`  Found existing artist: ${artistName} (ID: ${artistRecord.artistId}, Current MBID: ${artistRecord.musicbrainzArtistId})`);

      // Check if we need to update MBID or fetch image
      const needsMbidUpdate: boolean = mbidToUse !== null && artistRecord.musicbrainzArtistId === null;
      const needsImageUpdate: boolean = !artistRecord.artistImage && !skipRemoteImageFetch;
      
      if (needsMbidUpdate) {
        const updatedArtistWithMbid = await db.update(artists).set({
          musicbrainzArtistId: mbidToUse,
          updatedAt: sql`CURRENT_TIMESTAMP`
        }).where(eq(artists.artistId, artistRecord.artistId)).returning();
        
        if (updatedArtistWithMbid.length > 0) {
          artistRecord = updatedArtistWithMbid[0];
        }
      }
      
      // Only skip image fetch if the artist already has an image
      if (artistRecord.artistImage) {
        skipRemoteImageFetch = true;
      }
      
      // Use the artist's existing MBID if available, otherwise use the provided one
      mbidToUse = artistRecord.musicbrainzArtistId || mbidToUse; 

      if (needsImageUpdate) {
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

    // Fetch artist image from Genius API if needed and not skipped
    if (shouldFetchArtistImage && !skipRemoteImageFetch) {
      try {
        console.log(`  Fetching artist image for: ${artistName} using Genius API`);
        const config = useRuntimeConfig();
        const geniusService = new GeniusService(config.geniusApiClientId, config.geniusApiClientSecret);

        const searchResults = await geniusService.searchSongs(artistName);
        let geniusArtist: GeniusApiArtistInterface | null = null;
        let imageUrl: string | null = null;

        if (searchResults.response.hits.length > 0) {
          for (const hit of searchResults.response.hits) {
            if (hit.result.primary_artist && hit.result.primary_artist.name.toLowerCase() === artistName.toLowerCase()) {
              geniusArtist = hit.result.primary_artist;
              imageUrl = geniusArtist.image_url || geniusArtist.header_image_url || null;
              if (imageUrl) break; // Found an artist match with an image
            }
          }
        }

        if (geniusArtist && imageUrl) {
          console.log(`    Found Genius artist: ${geniusArtist.name} (ID: ${geniusArtist.id}) with image URL: ${imageUrl}`);
          const response = await fetch(imageUrl);
          if (!response.ok) {
            throw new Error(`Failed to download image from ${imageUrl}: ${response.status} ${response.statusText}`);
          }
          const imageBuffer = await response.arrayBuffer();

          const publicDir = resolve('./public');
          const imageDir = join(publicDir, 'images', 'artists');
          await mkdir(imageDir, { recursive: true });

          const imageName = `${slugify(artistName)}-${geniusArtist.id}.webp`;
          const localImagePath = join(imageDir, imageName);

          await sharp(imageBuffer)
            .resize(500, 500, { fit: 'cover' })
            .webp({ quality: 80 })
            .toFile(localImagePath);

          const dbImagePath = `/images/artists/${imageName}`;
          const updatedArtist = await db.update(artists).set({
            artistImage: dbImagePath,
            updatedAt: sql`CURRENT_TIMESTAMP`
          }).where(eq(artists.artistId, artistRecord.artistId)).returning();

          if (updatedArtist.length > 0) {
            artistRecord = updatedArtist[0];
            console.log(`    Saved artist image from Genius: ${dbImagePath}`);
          }
        } else {
          console.log(`    No suitable image found on Genius for artist: ${artistName}`);
        }
      } catch (error: any) {
        console.error(`  Error fetching/processing artist image for ${artistName} from Genius:`, error.message || error);
      }
    }

    if (userId) {
      await linkUserToArtist(userId, artistRecord.artistId, artistName);
    }

    // Store in cache before returning
    artistCache.set(cacheKey, artistRecord);
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
  if (!albumTitle || !artistsArray || artistsArray.length === 0 || !userId) return null;
  
  try {
    // Quick check for album in cache first
    const primaryArtist = artistsArray.find(a => a.isPrimary);
    if (!primaryArtist) return null;
    
    // First check cache by album title and primary artist ID
    const cachedAlbums = Array.from(albumCache.values());
    const existingAlbumByTitle = cachedAlbums.find(album => {
      // Get the album's artists from cache
      const albumArtists = albumArtistsCache.get(album.albumId);
      
      return album.title === albumTitle && 
             albumArtists?.some(a => a.artistId === primaryArtist.artistId && a.isPrimary);
    });
    
    if (existingAlbumByTitle) {
      // Found in cache, return it directly
      return existingAlbumByTitle;
    }
    
    // If not found by title, check by MusicBrainz ID if available
    if (musicbrainzReleaseId) {
      // Check cache by MBID
      const existingAlbumByMbid = cachedAlbums.find(album => 
        album.musicbrainzReleaseId === musicbrainzReleaseId
      );
      
      if (existingAlbumByMbid) {
        return existingAlbumByMbid;
      }
      
      // Then check database directly by MBID
      const albumsByMbid = await db
        .select()
        .from(albums)
        .where(eq(albums.musicbrainzReleaseId, musicbrainzReleaseId))
        .limit(1);
      
      if (albumsByMbid.length > 0) {
        const albumRecord = albumsByMbid[0];
        
        // Store in cache before returning
        albumCache.set(albumRecord.albumId, albumRecord);
        return albumRecord;
      }
    }
    
    // If not found in cache or by MBID, check database by title and primary artist
    let existingAlbumQuery;
    
    if (primaryArtist) {
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
          eq(albumArtists.artistId, primaryArtist.artistId),
          eq(albumArtists.isPrimaryArtist, 1)
        ))
        .limit(1);
    } else {
      // Fallback: if no primary artist specified, try by title only (less reliable)
      existingAlbumQuery = db.select().from(albums).where(eq(albums.title, albumTitle)).limit(1);
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
        albumRecord = firstResultItem as Album;
      }
      
      // If album exists, ensure MBID is up-to-date if provided
      if (musicbrainzReleaseId && albumRecord.musicbrainzReleaseId !== musicbrainzReleaseId) {
        const updatedResult = await db.update(albums)
          .set({ musicbrainzReleaseId: musicbrainzReleaseId, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(albums.albumId, albumRecord.albumId))
          .returning();
        if (updatedResult.length > 0) albumRecord = updatedResult[0];
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
        return null;
      }
      albumRecord = newAlbumResult[0];
    }

    // --- Attempt to find MusicBrainz Release ID if missing ---
    if (!albumRecord.musicbrainzReleaseId && primaryArtist && albumTitle) {
      const primaryArtistRecordResult = await db
        .select({ name: artists.name })
        .from(artists)
        .where(eq(artists.artistId, primaryArtist.artistId))
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

    // Now handle artist relationships
    // First, get existing artist relationships
    const existingArtistRelationships = await getAlbumArtists(albumRecord.albumId);
    
    // Compare existing relationships with the ones we want to create
    const relationshipsNeedUpdate = !compareArtistRelationships(existingArtistRelationships, artistsArray);
    
    if (relationshipsNeedUpdate) {
      // Delete existing relationships
      await db.delete(albumArtists)
        .where(eq(albumArtists.albumId, albumRecord.albumId));
      
      // Create new relationships
      for (const artistInfo of artistsArray) {
        await db.insert(albumArtists).values({
          albumId: albumRecord.albumId,
          artistId: artistInfo.artistId,
          role: artistInfo.role || null,
          isPrimaryArtist: artistInfo.isPrimary ? 1 : 0, // Database uses 1/0 instead of true/false
        });
        
        // Link user to artist
        await linkUserToArtist(userId, artistInfo.artistId, "");
      }
      
      // Update cache with normalized values
      albumArtistsCache.set(albumRecord.albumId, artistsArray.map(info => ({
        artistId: info.artistId,
        role: info.role || null,
        isPrimary: info.isPrimary
      })));
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
      }
    } else if (coverPath && !albumRecord.coverPath) {
      // If a local coverPath is provided and the album doesn't have one, update it
      const updatedResult = await db
        .update(albums)
        .set({ coverPath: coverPath, updatedAt: sql`CURRENT_TIMESTAMP` })
        .where(eq(albums.albumId, albumRecord.albumId))
        .returning();
      if (updatedResult.length > 0) albumRecord = updatedResult[0];
    }

    // Store in cache before returning
    albumCache.set(albumRecord.albumId, albumRecord);
    return albumRecord;
  } catch (error: any) {
    // console.error(`  Database error with album ${albumTitle}: ${error.message}`);
    return null;
  }
}

/**
 * Compares two arrays of artist relationships to determine if they are equivalent.
 * @param existing The existing artist relationships.
 * @param incoming The incoming artist relationships.
 * @returns True if the relationships are equivalent, false otherwise.
 */
function compareArtistRelationships(
  existing: { artistId: string; role: string | null; isPrimary: boolean }[],
  incoming: AlbumArtistInfo[]
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }
  
  // Sort both arrays by artistId to ensure consistent comparison
  const sortedExisting = [...existing].sort((a, b) => a.artistId.localeCompare(b.artistId));
  const sortedIncoming = [...incoming].sort((a, b) => a.artistId.localeCompare(b.artistId));
  
  for (let i = 0; i < sortedExisting.length; i++) {
    const existingItem = sortedExisting[i];
    const incomingItem = sortedIncoming[i];
    
    if (
      existingItem.artistId !== incomingItem.artistId ||
      existingItem.role !== (incomingItem.role || null) ||
      existingItem.isPrimary !== incomingItem.isPrimary
    ) {
      return false;
    }
  }
  
  return true;
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
    const cacheKey = filePath;
    if (trackCache.has(cacheKey)) {
      return trackCache.get(cacheKey)!;
    }

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
      
      // Check if any track data has actually changed before updating
      const needsUpdate: boolean = 
        trackRecord.title !== title ||
        trackRecord.albumId !== albumId ||
        trackRecord.duration !== metadata.duration ||
        trackRecord.trackNumber !== metadata.trackNumber ||
        trackRecord.diskNumber !== metadata.diskNumber ||
        trackRecord.year !== metadata.year ||
        trackRecord.musicbrainzTrackId !== musicbrainzTrackId ||
        trackRecord.explicit !== (metadata.explicit ?? false);
      
      if (needsUpdate) {
        // Update existing track with new data
        const updatedTrackResult = await db
          .update(tracks)
          .set({
            ...trackData,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(tracks.trackId, trackRecord.trackId))
          .returning();
        
        if (updatedTrackResult.length > 0) {
          trackRecord = updatedTrackResult[0];
        }
      }
    } else {
      const newTrackId: string = uuidv7();
      const newTrackResult = await db
        .insert(tracks)
        .values({
          trackId: newTrackId,
          ...trackData, // Spread new data
        })
        .returning();
      
      if (!newTrackResult || newTrackResult.length === 0) {
        return null;
      }
      
      trackRecord = newTrackResult[0];
    }

    // Cache the track record
    trackCache.set(cacheKey, trackRecord);
    
    // Handle artist relationships
    if (trackArtists && trackArtists.length > 0) {
      // Get existing artist relationships
      const existingArtistRelationships = await getTrackArtists(trackRecord.trackId);
      
      // Compare existing relationships with the ones we want to create
      const relationshipsNeedUpdate = !compareTrackArtistRelationships(existingArtistRelationships, trackArtists);
      
      if (relationshipsNeedUpdate) {
        // Delete existing relationships
        await db.delete(artistsTracks)
          .where(eq(artistsTracks.trackId, trackRecord.trackId));
        
        // Create new relationships
        for (const artistInfo of trackArtists) {
          try {
            await db.insert(artistsTracks).values({
              trackId: trackRecord.trackId,
              artistId: artistInfo.artistId,
              role: artistInfo.role || null,
              isPrimaryArtist: artistInfo.isPrimary ? 1 : 0,
            });
          } catch (linkError: any) {
            console.error(`Error linking artist ${artistInfo.artistId} to track ${trackRecord.trackId}: ${linkError.message}`);
          }
        }
      }

      // Handle genre (linking to album, as tracks don't directly link to genres in this schema)
      if (metadata.genre) {
        const genreId = await findOrCreateGenre(metadata.genre);
        if (genreId && albumId) { 
          await linkAlbumToGenre(albumId, genreId);
        }
      }
    }

    // Store track-artist relationships in cache
    trackArtistsCache.set(trackRecord.trackId, trackArtists.map(info => ({
      artistId: info.artistId,
      role: info.role || null,
      isPrimary: info.isPrimary
    })));

    return trackRecord; // Return the full track object
  } catch (error: any) {
    // console.error(`  Database error with track ${title}: ${error.message}`);
    return null;
  }
}

/**
 * Compares two arrays of track artist relationships to determine if they are equivalent.
 * @param existing The existing artist relationships.
 * @param incoming The incoming artist relationships.
 * @returns True if the relationships are equivalent, false otherwise.
 */
function compareTrackArtistRelationships(
  existing: { artistId: string; role: string | null; isPrimary: boolean }[],
  incoming: TrackArtistInfo[]
): boolean {
  if (existing.length !== incoming.length) {
    return false;
  }
  
  // Sort both arrays by artistId to ensure consistent comparison
  const sortedExisting = [...existing].sort((a, b) => a.artistId.localeCompare(b.artistId));
  const sortedIncoming = [...incoming].sort((a, b) => a.artistId.localeCompare(b.artistId));
  
  for (let i = 0; i < sortedExisting.length; i++) {
    const existingItem = sortedExisting[i];
    const incomingItem = sortedIncoming[i];
    
    if (
      existingItem.artistId !== incomingItem.artistId ||
      existingItem.role !== (incomingItem.role || null) ||
      existingItem.isPrimary !== incomingItem.isPrimary
    ) {
      return false;
    }
  }
  
  return true;
}

/**
 * Finds or creates a genre in the database.
 * @param genreName The name of the genre.
 * @returns The ID of the found or created genre, or null if an error occurs or name is empty.
 */
export async function findOrCreateGenre(genreName: string): Promise<string | null> {
  if (!genreName) return null;

  try {
    // Check cache first
    if (genreCache.has(genreName)) {
      return genreCache.get(genreName)!;
    }

    const existingGenre = await db
      .select()
      .from(genres)
      .where(eq(genres.name, genreName))
      .limit(1);

    if (existingGenre.length > 0) {
      const genreId: string = existingGenre[0].genreId;
      genreCache.set(genreName, genreId);
      return genreId;
    }

    // Genre doesn't exist, create a new one
    const newGenreId: string = uuidv7();
    await db.insert(genres).values({
      genreId: newGenreId,
      name: genreName,
    });
    
    genreCache.set(genreName, newGenreId);
    return newGenreId;
  } catch (error: any) {
    return null;
  }
}

/**
 * Links an album to a genre in the database if the link does not already exist.
 * @param albumId The ID of the album.
 * @param genreId The ID of the genre.
 */
export async function linkAlbumToGenre(albumId: string, genreId: string): Promise<void> {
  try {
    // Check if the link already exists
    const existingLink = await db
      .select()
      .from(albumGenres)
      .where(and(
        eq(albumGenres.albumId, albumId),
        eq(albumGenres.genreId, genreId)
      ))
      .limit(1);

    if (existingLink.length === 0) {
      // Link doesn't exist, create it
      await db.insert(albumGenres).values({
        albumId: albumId,
        genreId: genreId,
      });
      albumGenresCache.set(albumId, true);
    }
  } catch (error: any) {
    // console.error(`Error linking album ${albumId} to genre ${genreId}: ${error.message}`);
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
    if (albumGenresCache.has(albumId)) {
      return albumGenresCache.get(albumId)!;
    }
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(albumGenres)
      .where(eq(albumGenres.albumId, albumId));
    const hasGenres = result[0].count > 0;
    albumGenresCache.set(albumId, hasGenres);
    return hasGenres;
  } catch (error) {
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
    }
  } catch (error: any) {
    // Silent error handling - this is a non-critical operation
  }
}

/**
 * Resets the scan session by clearing all caches.
 */
export async function resetScanSession(): Promise<void> {
  // Clear all caches
  artistCache.clear();
  albumCache.clear();
  trackCache.clear();
  genreCache.clear();
  albumArtistsCache.clear();
  albumGenresCache.clear();
  trackArtistsCache.clear();
  return Promise.resolve();
}

/**
 * Gets the artists associated with an album.
 * @param albumId The ID of the album.
 * @returns Array of album artist relationships.
 */
export async function getAlbumArtists(albumId: string): Promise<{ artistId: string; role: string | null; isPrimary: boolean }[]> {
  if (!albumId) return [];
  
  try {
    // Check cache first
    if (albumArtistsCache.has(albumId)) {
      return albumArtistsCache.get(albumId)!;
    }
    
    const existingLinks = await db
      .select({
        artistId: albumArtists.artistId,
        role: albumArtists.role,
        isPrimaryArtist: albumArtists.isPrimaryArtist
      })
      .from(albumArtists)
      .where(eq(albumArtists.albumId, albumId));
    
    // Convert database 0/1 values to boolean and normalize the structure
    const normalizedLinks = existingLinks.map(link => ({
      artistId: link.artistId,
      role: link.role,
      isPrimary: link.isPrimaryArtist === 1
    }));
    
    // Store in cache
    albumArtistsCache.set(albumId, normalizedLinks);
    
    return normalizedLinks;
  } catch (error) {
    return [];
  }
}

/**
 * Gets the artists associated with a track.
 * @param trackId The ID of the track.
 * @returns Array of track artist relationships.
 */
export async function getTrackArtists(trackId: string): Promise<{ artistId: string; role: string | null; isPrimary: boolean }[]> {
  if (!trackId) return [];
  
  try {
    // Check cache first
    if (trackArtistsCache.has(trackId)) {
      return trackArtistsCache.get(trackId)!;
    }
    
    const existingLinks = await db
      .select({
        artistId: artistsTracks.artistId,
        role: artistsTracks.role,
        isPrimaryArtist: artistsTracks.isPrimaryArtist
      })
      .from(artistsTracks)
      .where(eq(artistsTracks.trackId, trackId));
    
    // Convert database 0/1 values to boolean and normalize the structure
    const normalizedLinks = existingLinks.map(link => ({
      artistId: link.artistId,
      role: link.role,
      isPrimary: link.isPrimaryArtist === 1
    }));
    
    // Store in cache
    trackArtistsCache.set(trackId, normalizedLinks);
    
    return normalizedLinks;
  } catch (error) {
    return [];
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
  resetScanSession,
  getAlbumArtists,
  getTrackArtists,
};
