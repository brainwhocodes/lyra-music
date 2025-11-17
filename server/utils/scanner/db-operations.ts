import { eq, and, sql, or, ne } from 'drizzle-orm';
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
import { AlbumProcessStatus } from '~/types/enums/album-process-status';
import { searchReleaseByTitleAndArtist } from '~/server/utils/musicbrainz'; // searchArtistByName, getArtistWithImages, extractArtistImageUrls removed as artist images will now be fetched from Genius
import { GeniusService, type GeniusArtist as GeniusApiArtistInterface } from '~/server/utils/genius-service';
import sharp from 'sharp';
import { mkdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { useRuntimeConfig } from '#imports';
import { albumArtUtils } from './album-art-utils';

// Constants
export const VARIOUS_ARTISTS_NAME = 'Various Artists';

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
  isVariousArtistsCompilation?: boolean;
  albumTitle: string;
  artistsArray: AlbumArtistInfo[]; // Changed from artistIds and primaryArtistId
  userId: string;
  year?: number | null;
  coverPath?: string | null;
  musicbrainzReleaseId?: string | null;
  folderPath?: string | null;
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

  // Special case for "Various Artists"
  if (artistName === VARIOUS_ARTISTS_NAME) {
    skipRemoteImageFetch = true; // Always skip image fetch for "Various Artists"
    musicbrainzArtistId = undefined; // Never assign or look up MBID for "Various Artists"
  }

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
          updatedAt: new Date().toISOString()
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

    // Fetch artist image from Genius API if needed and not skipped (and not "Various Artists")
    const config = useRuntimeConfig();
    const isGeniusDisabled = config.scannerDisableGenius === 'true' || process.env.SCANNER_DISABLE_GENIUS === 'true';
    if (shouldFetchArtistImage && !skipRemoteImageFetch && !isGeniusDisabled && artistName !== VARIOUS_ARTISTS_NAME) {
      try {
        console.log(`  Fetching artist image for: ${artistName} using Genius API`);
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
            updatedAt: new Date().toISOString()
          }).where(eq(artists.artistId, artistRecord.artistId)).returning();

          if (updatedArtist.length > 0) {
            artistRecord = updatedArtist[0];
            console.log(`Saved artist image from Genius: ${dbImagePath}`);
          }
        } else {
          console.log(`No suitable image found on Genius for artist: ${artistName}`);
        }
      } catch (error: any) {
        console.error(`Error fetching/processing artist image for ${artistName} from Genius:`, error.message || error);
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

  // Special case for "Various Artists"
  if (artistName === VARIOUS_ARTISTS_NAME) {
    musicbrainzArtistId = undefined; // Never assign or look up MBID for "Various Artists"
  }

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
          .set({ musicbrainzArtistId: musicbrainzArtistId, updatedAt: new Date().toISOString() })
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
  artistsArray,
  isVariousArtistsCompilation = false,
  userId,
  year,
  coverPath, // This is the cover path from the file's metadata, if any
  musicbrainzReleaseId,
  folderPath, // New parameter
}: FindOrCreateAlbumParams): Promise<Album | null> {
  // If it's a Various Artists compilation, artistsArray might be empty initially
  if (!albumTitle || (!isVariousArtistsCompilation && (!artistsArray || artistsArray.length === 0)) || !userId) return null;

  try {
    let primaryArtistForLookup: AlbumArtistInfo | null = null;
    
    // Handle "Various Artists" compilation album
    if (isVariousArtistsCompilation) {
      // Find or create the "Various Artists" artist record
      const variousArtistsRecord = await getOrCreateArtistMinimal({
        artistName: VARIOUS_ARTISTS_NAME
      });
      
      if (!variousArtistsRecord) {
        return null; // Failed to get/create "Various Artists" record
      }
      
      // Create a primary artist entry for "Various Artists"
      primaryArtistForLookup = {
        artistId: variousArtistsRecord.artistId,
        isPrimary: true,
        role: null
      };
      
      // Add Various Artists to artistsArray if not already present
      const hasVariousArtists = artistsArray?.some(a => a.artistId === variousArtistsRecord.artistId);
      if (!hasVariousArtists) {
        if (!artistsArray) {
          artistsArray = [primaryArtistForLookup];
        } else {
          // Ensure no other artists are marked as primary
          artistsArray = artistsArray.map(a => ({
            ...a,
            isPrimary: false
          }));
          // Add Various Artists as primary
          artistsArray.push(primaryArtistForLookup);
        }
      } else {
        // Update the existing Various Artists entry to be primary
        artistsArray = artistsArray.map(a => ({
          ...a,
          isPrimary: a.artistId === variousArtistsRecord.artistId
        }));
      }
    } else {
      // Normal album processing (not Various Artists)
      const primaryArtist = artistsArray.find(a => a.isPrimary);
      if (!primaryArtist) {
        // console.warn(`No primary artist found for album: ${albumTitle}. Skipping album creation/update.`);
        return null;
      }
      primaryArtistForLookup = primaryArtist;
    }

    let albumRecord: Album | undefined | null = null;
    let isNewAlbum: boolean = false;

    // Priority 1: Check by folderPath if provided
    if (folderPath) {
      const albumsByFolder = await db
        .select()
        .from(albums)
        .where(and(eq(albums.folderPath, folderPath), eq(albums.userId, userId)))
        .limit(1);
      if (albumsByFolder.length > 0) {
        albumRecord = albumsByFolder[0];
        albumCache.set(albumRecord.albumId, albumRecord);
      }
    }

    // Priority 2: Check cache by MusicBrainz ID if provided
    if (!albumRecord && musicbrainzReleaseId) {
      const cachedAlbums = Array.from(albumCache.values());
      albumRecord = cachedAlbums.find(album => album.musicbrainzReleaseId === musicbrainzReleaseId);
      // if (albumRecord) {
      //   console.log(`Album "${albumTitle}" found in cache by MBID: ${musicbrainzReleaseId}`);
      // }
    }

    // Priority 3: Check database by MusicBrainz ID if provided and not found in cache
    if (!albumRecord && musicbrainzReleaseId) {
      const albumsByMbid = await db
        .select()
        .from(albums)
        .where(eq(albums.musicbrainzReleaseId, musicbrainzReleaseId))
        .limit(1);
      if (albumsByMbid.length > 0) {
        albumRecord = albumsByMbid[0];
        albumCache.set(albumRecord.albumId, albumRecord);
        // console.log(`Album "${albumTitle}" found in DB by MBID: ${musicbrainzReleaseId}`);
      }
    }

    // Priority 4: Check cache by Title and Primary Artist ID if not found by other means
    if (!albumRecord) {
      const cachedAlbums = Array.from(albumCache.values());
      albumRecord = cachedAlbums.find(album => {
        const albumArtistsFromCache = albumArtistsCache.get(album.albumId);
        return album.title === albumTitle &&
               albumArtistsFromCache?.some(a => a.artistId === primaryArtistForLookup.artistId && a.isPrimary);
      });
      // if (albumRecord) {
      //   console.log(`Album "${albumTitle}" found in cache by Title & Primary Artist`);
      // }
    }

    // Priority 5: Check database by Title and Primary Artist ID if not found by other means
    if (!albumRecord) {
      const existingAlbumResult = await db.select({
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
          eq(albumArtists.artistId, primaryArtistForLookup.artistId),
          eq(albumArtists.isPrimaryArtist, 1) // Ensure primary artist match
        ))
        .limit(1);

      if (existingAlbumResult.length > 0) {
        albumRecord = existingAlbumResult[0] as Album;
        albumCache.set(albumRecord.albumId, albumRecord);
        // console.log(`Album "${albumTitle}" found in DB by Title & Primary Artist`);
      }
    }

    // If album exists, conditionally update it
    if (albumRecord) {
      isNewAlbum = false;
      const updates: Partial<Omit<Album, 'albumId' | 'userId' | 'createdAt'>> & { updatedAt?: any } = {};
      
      // Update processedStatus to COMPLETED if it's not already
      if (albumRecord.processedStatus !== AlbumProcessStatus.COMPLETED) {
        updates.processedStatus = AlbumProcessStatus.COMPLETED;
      }

      if (year !== undefined && year !== null && albumRecord.year !== year) {
        updates.year = year;
      }
      if (coverPath && albumRecord.coverPath !== coverPath) {
         updates.coverPath = coverPath;
      }
      if (musicbrainzReleaseId && albumRecord.musicbrainzReleaseId !== musicbrainzReleaseId) {
        updates.musicbrainzReleaseId = musicbrainzReleaseId;
      }
      if (folderPath && albumRecord.folderPath !== folderPath) {
        updates.folderPath = folderPath;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString();
        const updatedResult = await db.update(albums)
          .set(updates)
          .where(eq(albums.albumId, albumRecord.albumId))
          .returning();
        if (updatedResult.length > 0) {
          albumRecord = updatedResult[0];
          albumCache.set(albumRecord.albumId, albumRecord);
          // console.log(`Album "${albumTitle}" updated.`);
        }
      }
    } else {
      // Album does not exist, create it
      isNewAlbum = true;
      const newAlbumId = uuidv7();
      const newAlbumValues: typeof albums.$inferInsert = {
        albumId: newAlbumId,
        title: albumTitle,
        userId: userId,
        folderPath: folderPath, // New field
        processedStatus: AlbumProcessStatus.COMPLETED, // Set status to COMPLETED
      };
      if (year !== undefined && year !== null) newAlbumValues.year = year;
      if (coverPath) newAlbumValues.coverPath = coverPath;
      if (musicbrainzReleaseId) newAlbumValues.musicbrainzReleaseId = musicbrainzReleaseId;

      const newAlbumResult = await db
        .insert(albums)
        .values(newAlbumValues)
        .returning();

      if (!newAlbumResult || newAlbumResult.length === 0) {
        // console.error(`Failed to create new album: ${albumTitle}`);
        return null;
      }
      albumRecord = newAlbumResult[0];
      albumCache.set(albumRecord.albumId, albumRecord);
      // console.log(`Album "${albumTitle}" created with ID: ${albumRecord.albumId}`);
    }

    if (!albumRecord) { // Should not happen if creation/finding was successful
        // console.error(`Album record is null after creation/update attempt for: ${albumTitle}`);
        return null;
    }
    
    // --- Metadata Enrichment for New Albums or Missing Info ---
    if (!albumRecord.musicbrainzReleaseId && primaryArtistForLookup?.artistId) {
      const primaryArtistRecordResult = await db
        .select({ name: artists.name })
        .from(artists)
        .where(eq(artists.artistId, primaryArtistForLookup.artistId))
        .limit(1);

      if (primaryArtistRecordResult.length > 0 && primaryArtistRecordResult[0].name) {
        const primaryArtistName = primaryArtistRecordResult[0].name;
        // console.log(`Searching MBID for "${albumTitle}" by "${primaryArtistName}"`);
        const newMbId = await searchReleaseByTitleAndArtist(albumTitle, primaryArtistName);
        if (newMbId) {
          const updatedResult = await db
            .update(albums)
            .set({ musicbrainzReleaseId: newMbId, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, (albumRecord as Album).albumId))
            .returning();
          if (updatedResult.length > 0) {
            albumRecord = updatedResult[0];
            albumCache.set((albumRecord as Album).albumId, albumRecord as Album);
            // console.log(`Found and set MBID for "${albumTitle}": ${newMbId}`);
          }
        }
      }
    }

    // Artist Relationships: Always manage
    const existingArtistRelationships = await getAlbumArtists((albumRecord as Album).albumId);
    const relationshipsNeedUpdate = !compareArtistRelationships(existingArtistRelationships, artistsArray);

    if (relationshipsNeedUpdate) {
      // console.log(`Updating artist relationships for album: ${albumTitle}`);
      await db.delete(albumArtists).where(eq(albumArtists.albumId, (albumRecord as Album).albumId));

      // Insert album-artist links concurrently
      const linkPromises = artistsArray.map(async (artistInfo) => {
        try {
          await db.insert(albumArtists).values({
            albumId: (albumRecord as Album).albumId,
            artistId: artistInfo.artistId,
            role: artistInfo.role || null,
            isPrimaryArtist: artistInfo.isPrimary ? 1 : 0,
          });

          await linkUserToArtist(userId, artistInfo.artistId, 'artist from album processing');
        } catch (linkError: any) {
          console.error(`Error linking artist ${artistInfo.artistId} to album ${(albumRecord as Album).albumId}: ${linkError.message}`);
        }
      });

      await Promise.all(linkPromises);

      albumArtistsCache.set((albumRecord as Album).albumId, artistsArray.map(info => ({
        artistId: info.artistId,
        role: info.role || null,
        isPrimary: info.isPrimary,
      })));
    }
    
    // Cover Art: Fetch from MusicBrainz ONLY if (is new album OR existing album has no coverPath) AND has an MBID
    if ((isNewAlbum || !(albumRecord as Album).coverPath) && (albumRecord as Album).musicbrainzReleaseId) {
      // console.log(`Attempting to download cover art for ${albumTitle} (MBID: ${(albumRecord as Album).musicbrainzReleaseId})`);
      const downloadedArtPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz((albumRecord as Album).musicbrainzReleaseId as string);
      if (downloadedArtPath) {
        // console.log(`Downloaded cover art for ${albumTitle} to ${downloadedArtPath}`);
        const updatedResult = await db
          .update(albums)
          .set({ coverPath: downloadedArtPath, updatedAt: new Date().toISOString() })
          .where(eq(albums.albumId, (albumRecord as Album).albumId))
          .returning();
        if (updatedResult.length > 0) {
          albumRecord = updatedResult[0];
          albumCache.set((albumRecord as Album).albumId, albumRecord as Album);
        }
      }
    }

    // Final check: if a coverPath was provided from scanner and album still has no cover, apply it
    if (coverPath && !(albumRecord as Album).coverPath) {
        // console.log(`Applying local cover art ${coverPath} to album ${albumTitle}`);
        const updatedResult = await db
            .update(albums)
            .set({ coverPath: coverPath, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, (albumRecord as Album).albumId))
            .returning();
        if (updatedResult.length > 0) {
            albumRecord = updatedResult[0];
            albumCache.set((albumRecord as Album).albumId, albumRecord as Album);
        }
    }
    
    albumCache.set((albumRecord as Album).albumId, albumRecord as Album);
    return albumRecord as Album;

  } catch (error: any) {
    // console.error(`  Error in findOrCreateAlbum for "${albumTitle}": ${error.message}`);
    return null;
  }
}

/**
 * Compares two arrays of album artist relationships to determine if they are equivalent.
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
            updatedAt: new Date().toISOString(),
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

        // Create new relationships concurrently
        const linkPromises = trackArtists.map(async (artistInfo) => {
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
        });

        await Promise.all(linkPromises);
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

/**
 * Gets albums to process based on their processing status.
 * @param userId The ID of the user.
 * @param processOnlyUnprocessed If true, only fetches albums that have not been processed or have failed.
 * @returns An array of albums to be processed.
 */
export async function getAlbumsToProcess(userId: string, processOnlyUnprocessed: boolean): Promise<Album[]> {
  if (processOnlyUnprocessed) {
    // Process albums that are not yet processed or have failed previously.
    return db
      .select()
      .from(albums)
      .where(and(
        eq(albums.userId, userId),
        ne(albums.processedStatus, AlbumProcessStatus.COMPLETED),
      ));
  }

  // Otherwise, fetch all albums for the user.
  return db
    .select()
    .from(albums)
    .where(eq(albums.userId, userId));
}

/**
 * Finds or creates an initial album record in the database.
 * If the album already exists, it resets its status to PENDING for reprocessing.
 * @param params Parameters for initial album creation
 * @returns The found or created album record, or null on error
 */
export async function createInitialAlbumRecord({
  folderPath,
  albumTitle,
  userId,
}: {
  folderPath: string;
  albumTitle: string;
  userId: string;
}): Promise<Album | null> {
  try {
    // Check if an album with this folderPath already exists for the user
    const existingAlbum = await db.query.albums.findFirst({
      where: and(eq(albums.folderPath, folderPath), eq(albums.userId, userId)),
    });

    if (existingAlbum) {
      // If the album has already been fully processed, skip it
      if (existingAlbum.processedStatus === AlbumProcessStatus.COMPLETED) {
        return null;
      }

      // Album exists but isn't completed, reset its status for reprocessing
      const [updatedAlbum] = await db
        .update(albums)
        .set({ processedStatus: AlbumProcessStatus.PENDING, updatedAt: new Date().toISOString() })
        .where(eq(albums.albumId, existingAlbum.albumId))
        .returning();
      return updatedAlbum || existingAlbum;
    }

    // If not, create a new one
    const newAlbumId = uuidv7();
    const [newAlbum] = await db
      .insert(albums)
      .values({
        albumId: newAlbumId,
        title: albumTitle,
        userId,
        folderPath,
        processedStatus: AlbumProcessStatus.PENDING,
      })
      .returning();

    return newAlbum || null;
  } catch (error: any) {
    console.error(`Error in createInitialAlbumRecord for ${albumTitle}: ${error.message}`);
    return null;
  }
}

export const dbOperations = {
  findOrCreateArtist,
  getOrCreateArtistMinimal,
  findOrCreateAlbum,
  getAlbumsToProcess,
  findOrCreateTrack,
  findOrCreateGenre,
  linkAlbumToGenre,
  hasAlbumGenres,
  linkUserToArtist,
  resetScanSession,
  getAlbumArtists,
  getTrackArtists,
  createInitialAlbumRecord,
};
