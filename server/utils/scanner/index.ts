import * as mm from 'music-metadata';
import { dirname, basename } from 'node:path';
import { db } from '~/server/db';
import { albums, tracks, artistUsers } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import type { AlbumArtistInfo, TrackArtistInfo } from './db-operations';
import { fileUtils } from './file-utils';
import { albumArtUtils } from './album-art-utils';
import { dbOperations, type TrackFileMetadata } from './db-operations'; // Added TrackFileMetadata import
import { TrackMetadata } from './types';
import { getReleaseInfoWithTags, searchReleaseByTitleAndArtist, getReleaseTracklist } from '~/server/utils/musicbrainz';

interface ScanLibraryParams {
  libraryId: string;
  libraryPath: string;
  userId: string;
}

/**
 * Extracts metadata from an audio file.
 */
async function extractMetadata(filePath: string): Promise<{
  metadata: TrackMetadata;
  albumArtPath: string | null;
}> {
  try {
    const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const albumDir = dirname(filePath);
    
    // Process external album art first (folder.jpg, etc.)
    let albumArtPath = await albumArtUtils.processExternalAlbumArt(albumDir);
    
    // If no external art, try embedded art
    if (!albumArtPath && metadata.common.picture?.length) {
      albumArtPath = await albumArtUtils.processEmbeddedAlbumArt(metadata.common.picture);
    }

    return { metadata, albumArtPath };
  } catch (error: any) {
    console.error(`Error extracting metadata from ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Processes a single audio file, extracting metadata and updating the database.
 */
async function processAudioFile(
  filePath: string,
  { libraryId, userId }: { libraryId: string; userId: string }
): Promise<{ albumId: string; title: string; primaryArtistName: string; needsCover: boolean } | null> {
  // console.log(`Processing: ${filePath}`);
  let skipMusicBrainzDetailsFetch = false;

  try {
    const { metadata, albumArtPath } = await extractMetadata(filePath);
    const common = metadata.common || {};

    const trackTitle = common.title?.trim();
    const rawTrackArtistName = common.artist?.trim();
    const trackAlbumTitle = common.album?.trim();
    const trackYear = common.year;
    const trackExplicit = (metadata.common as any).parentaladvisory === true; // Determine explicit flag

    let musicbrainzReleaseIdFromMeta: string | undefined;
    const rawMbReleaseId = (common as any).musicbrainz_releaseid;
    if (Array.isArray(rawMbReleaseId) && rawMbReleaseId.length > 0) {
      musicbrainzReleaseIdFromMeta = String(rawMbReleaseId[0]);
    } else if (typeof rawMbReleaseId === 'string') {
      musicbrainzReleaseIdFromMeta = rawMbReleaseId;
    }

    if (!trackTitle) {
      // console.warn(`  Track title not found for ${filePath}. Skipping.`);
      return null;
    }

    // --- Initial Artist ID Gathering ---
    const allArtistNames = new Set<string>();
    if (rawTrackArtistName) allArtistNames.add(rawTrackArtistName);
    const albumArtistNameFromMeta = (common as any).albumartist?.trim();
    if (albumArtistNameFromMeta) allArtistNames.add(albumArtistNameFromMeta);
    ((common as any).artists || []).forEach((artist: string) => {
      if (artist) allArtistNames.add(artist.trim());
    });

    if (allArtistNames.size === 0) allArtistNames.add('Unknown Artist');
    const effectivePrimaryArtistName = rawTrackArtistName || albumArtistNameFromMeta || allArtistNames.values().next().value;

    const artistRecordsMinimal: import('~/server/db/schema').Artist[] = [];
    for (const name of allArtistNames) {
      const artistRec = await dbOperations.getOrCreateArtistMinimal({ artistName: name });
      if (artistRec) artistRecordsMinimal.push(artistRec);
    }

    if (artistRecordsMinimal.length === 0) {
      // console.warn(`  No artist records could be processed for ${filePath}. Skipping album/track linking.`);
      return null; // Or handle track creation without album/artist if desired
    }
    
    // Flag to track if we're dealing with existing records (optimization for rescans)
    let allEntitiesExist = false;

    // Prepare AlbumArtistInfo for findOrCreateAlbum
    const albumArtistsInfo: AlbumArtistInfo[] = artistRecordsMinimal.map(artistRec => ({
      artistId: artistRec.artistId,
      isPrimary: artistRec.name === effectivePrimaryArtistName || (artistRecordsMinimal.length === 1 && artistRec.artistId === artistRecordsMinimal[0].artistId),
      // Role determination can be enhanced later. For now, primary is 'main', others null.
      role: (artistRec.name === effectivePrimaryArtistName || (artistRecordsMinimal.length === 1 && artistRec.artistId === artistRecordsMinimal[0].artistId)) ? 'main' : null,
    }));

    // Ensure at least one primary artist if multiple artists exist and none were matched by name
    if (albumArtistsInfo.length > 1 && !albumArtistsInfo.some(a => a.isPrimary)) {
      const primaryDesignate = albumArtistsInfo.find(a => a.artistId === (artistRecordsMinimal.find(ar => ar.name === effectivePrimaryArtistName)?.artistId));
      if (primaryDesignate) {
        primaryDesignate.isPrimary = true;
        primaryDesignate.role = 'main';
      } else if (albumArtistsInfo.length > 0) {
         // Fallback: if effectivePrimaryArtistName didn't match any in the list (e.g. was from a different tag set)
         // or if there's only one artist, make it primary.
        albumArtistsInfo[0].isPrimary = true;
        albumArtistsInfo[0].role = 'main';
      }
    }

    // --- Initial Album Record Fetch/Creation ---
    let albumRecord = await dbOperations.findOrCreateAlbum({
      albumTitle: trackAlbumTitle || 'Unknown Album',
      artistsArray: albumArtistsInfo, // Use the new structure
      userId,
      year: trackYear,
      coverPath: albumArtPath,
      musicbrainzReleaseId: musicbrainzReleaseIdFromMeta,
    });

    // --- Determine skipMusicBrainzDetailsFetch ---
    if (albumRecord) {
      const hasGenres = await dbOperations.hasAlbumGenres(albumRecord.albumId);
      
      // Check if the album already existed and has complete data
      if (albumRecord.musicbrainzReleaseId && albumRecord.year !== null && hasGenres) {
        skipMusicBrainzDetailsFetch = true;
        // console.log(`  Album '${albumRecord.title}' is complete. Skipping further MusicBrainz details fetch.`);
        
        // Check if all artists also have complete data (have MusicBrainz IDs)
        const allArtistsComplete = artistRecordsMinimal.every(artist => 
          artist.musicbrainzArtistId !== null && artist.musicbrainzArtistId !== undefined);
          
        if (allArtistsComplete) {
          // All entities exist and have complete data - we can skip expensive operations
          allEntitiesExist = true;
          // console.log(`  All artists and album for track ${trackTitle} already exist with complete data. Skipping detailed processing.`);
        }
      }
    }

    // --- Full Artist Processing (Conditional Image Fetch) ---
    const finalArtistRecords: import('~/server/db/schema').Artist[] = [];
    
    // If all entities exist with complete data, we can use the minimal artist records directly
    // This avoids the expensive findOrCreateArtist calls which may trigger image fetching
    if (allEntitiesExist) {
      finalArtistRecords.push(...artistRecordsMinimal);
    } else {
      for (const minimalArtist of artistRecordsMinimal) {
        const fullArtist = await dbOperations.findOrCreateArtist({
          artistName: minimalArtist.name,
          userId,
          musicbrainzArtistId: minimalArtist.musicbrainzArtistId, // Pass MBID if available
          skipRemoteImageFetch: skipMusicBrainzDetailsFetch,
        });
        if (fullArtist) finalArtistRecords.push(fullArtist);
      }
    }
    // --- Track Artist Preparation ---
    const trackSpecificArtistNames = new Set<string>();
    if (rawTrackArtistName) {
      trackSpecificArtistNames.add(rawTrackArtistName.trim());
    }
    // Add album artist if available
    if (albumArtistNameFromMeta) {
      trackSpecificArtistNames.add(albumArtistNameFromMeta.trim());
    }
    (((common as any).artists || []) as string[]).forEach((artist: string) => {
      if (artist) trackSpecificArtistNames.add(artist.trim());
    });

    // If no specific track artists found, fall back to the effective primary artist for the file
    if (trackSpecificArtistNames.size === 0 && effectivePrimaryArtistName) {
      trackSpecificArtistNames.add(effectivePrimaryArtistName);
    }
    // If still nothing, use "Unknown Artist"
    if (trackSpecificArtistNames.size === 0) {
        trackSpecificArtistNames.add('Unknown Artist');
    }

    // --- Prepare Track Metadata (with potential MusicBrainz fallback for track/disk numbers) ---
    let trackNumberForDb: number | null = common.track?.no ?? null;
    let diskNumberForDb: number | null = common.disk?.no ?? null;
    let durationForDb: number | null = metadata.format?.duration ? Math.round(metadata.format.duration) : null;
    const musicbrainzRecordingIdFromMeta: string | undefined = (common as any).musicbrainz_recordingid || (common as any).MUSICBRAINZ_TRACKID; // music-metadata uses 'musicbrainz_recordingid', some tags might have 'MUSICBRAINZ_TRACKID'

    if (albumRecord?.musicbrainzReleaseId && (!trackNumberForDb || trackNumberForDb === 0)) {
      const releaseTracklist = await getReleaseTracklist(albumRecord.musicbrainzReleaseId);
      if (releaseTracklist && releaseTracklist.length > 0) {
        let matchedMbTrack = null;
        // Try matching by Recording ID first (most reliable)
        if (musicbrainzRecordingIdFromMeta) {
          matchedMbTrack = releaseTracklist.find(mbTrack => mbTrack.recordingId === musicbrainzRecordingIdFromMeta);
        }
        // Fallback: Try matching by title (less reliable)
        if (!matchedMbTrack && trackTitle) {
          matchedMbTrack = releaseTracklist.find(mbTrack => 
            mbTrack.title.toLowerCase() === trackTitle.toLowerCase() ||
            (mbTrack.title.length > 5 && trackTitle.toLowerCase().includes(mbTrack.title.toLowerCase().substring(0,5))) // Basic substring match for robustness
          );
        }

        if (matchedMbTrack) {
          trackNumberForDb = matchedMbTrack.trackNumber;
          diskNumberForDb = matchedMbTrack.diskNumber;
          if (!durationForDb && matchedMbTrack.length) {
            durationForDb = Math.round(matchedMbTrack.length / 1000); // MB length is in ms
          }
        } else {
        }
      } else {
      }
    }

    const trackArtistsForDb: TrackArtistInfo[] = [];
    for (const artistName of trackSpecificArtistNames) {
      const artistRecord = finalArtistRecords.find(ar => ar.name === artistName);
      if (artistRecord) {
        // Determine primary status for the track artist
        let isPrimaryTrackArtist = false;
        if (rawTrackArtistName && rawTrackArtistName === artistName) {
          isPrimaryTrackArtist = true;
        } else if (!rawTrackArtistName && trackSpecificArtistNames.size === 1) {
          isPrimaryTrackArtist = true; // Only one artist for the track, make them primary
        }

        trackArtistsForDb.push({
          artistId: artistRecord.artistId,
          isPrimary: isPrimaryTrackArtist,
          role: isPrimaryTrackArtist ? 'main' : 'artist', // Simplified role assignment
        });
      }
    }

    // Ensure at least one primary artist if multiple exist and primary wasn't clearly identified
    if (trackArtistsForDb.length > 0 && !trackArtistsForDb.some(a => a.isPrimary)) {
      // If rawTrackArtistName was present and matched an artist, that one should already be primary.
      // This handles cases where rawTrackArtistName wasn't set or didn't match any in the list.
      trackArtistsForDb[0].isPrimary = true;
      trackArtistsForDb[0].role = 'main'; 
    } else if (trackArtistsForDb.length === 1 && trackArtistsForDb[0]) {
        // If only one artist, ensure it's primary and role is main
        trackArtistsForDb[0].isPrimary = true;
        trackArtistsForDb[0].role = 'main';
    }

    // --- Conditional Album Cover Fetch (if no MBID initially and no local cover) ---
    if (!allEntitiesExist && !skipMusicBrainzDetailsFetch && albumRecord && !albumRecord.coverPath && !albumRecord.musicbrainzReleaseId) {
      console.log(`  Album '${albumRecord.title}' lacks MBID and cover. Attempting to find MBID for cover art.`);
      try {
        let mbReleaseIdForCover: string | null = null;

        if (trackAlbumTitle && trackAlbumTitle !== 'Unknown Album' && effectivePrimaryArtistName) {
          const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, effectivePrimaryArtistName);
          if (searchResultMbId) {
            mbReleaseIdForCover = searchResultMbId;
            const updatedAlbumWithMbIdResult = await db.update(albums)
              .set({ musicbrainzReleaseId: mbReleaseIdForCover, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId))
              .returning();
            if (updatedAlbumWithMbIdResult.length > 0) {
              albumRecord = updatedAlbumWithMbIdResult[0]; // Update local albumRecord instance
              console.log(`  Found and updated album '${albumRecord.title}' with MBID: ${mbReleaseIdForCover} for cover search.`);
            }
          } else {
            console.log(`  Could not find MBID for album '${trackAlbumTitle}' by '${effectivePrimaryArtistName}' for cover search.`);
          }
        } else {
          console.log(` Skipping MBID search for cover art for '${albumRecord.title}' due to missing/generic album title or missing primary artist name.`);
        }

        if (mbReleaseIdForCover) {
          console.log(`  Fetching MB cover art for '${albumRecord.title}' (MBID: ${mbReleaseIdForCover})`);
          const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbReleaseIdForCover);
          if (mbCoverPath) {
            const updatedAlbumResult = await db.update(albums)
              .set({ coverPath: mbCoverPath, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId)).returning();
            if (updatedAlbumResult.length > 0) {
              albumRecord = updatedAlbumResult[0]; // Update local albumRecord instance
              console.log(`  Successfully fetched and updated cover for '${albumRecord.title}'.`);
            }
          }
        }
      } catch (coverFetchError: any) {
        console.error(`  Error during conditional cover fetch for album '${albumRecord.title}': ${coverFetchError.message}`);
      }
    }

    // --- Conditional MusicBrainz Genre Fetching ---
    if (!allEntitiesExist && albumRecord?.albumId) {
      let mbReleaseIdToUseForGenres: string | undefined = albumRecord.musicbrainzReleaseId || musicbrainzReleaseIdFromMeta;

      if (!mbReleaseIdToUseForGenres && trackAlbumTitle && !skipMusicBrainzDetailsFetch) {
        // console.log(`  Searching MBID for album: ${trackAlbumTitle} by ${effectivePrimaryArtistName}`);
        const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, effectivePrimaryArtistName);
        if (searchResultMbId) {
          mbReleaseIdToUseForGenres = searchResultMbId;
          if (albumRecord && !albumRecord.musicbrainzReleaseId) {
            const updatedAlbumResult = await db.update(albums)
              .set({ musicbrainzReleaseId: searchResultMbId, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId)).returning();
            if (updatedAlbumResult.length > 0) albumRecord = updatedAlbumResult[0];
            // console.log(`  Found and updated album ${albumRecord.title} with MBID: ${searchResultMbId}`);
          }
        }
      }

      if (mbReleaseIdToUseForGenres && !skipMusicBrainzDetailsFetch) {
        try {
          // console.log(`  Fetching genres for album ${albumRecord.title} (MBID: ${mbReleaseIdToUseForGenres})`);
          const releaseInfo = await getReleaseInfoWithTags(mbReleaseIdToUseForGenres);
          if (releaseInfo?.genres?.length) {
            for (const genre of releaseInfo.genres) {
              const genreId = await dbOperations.findOrCreateGenre(genre.name);
              if (genreId && albumRecord?.albumId) {
                await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
              }
            }
            // console.log(`  Processed ${releaseInfo.genres.length} genres for ${albumRecord.title}.`);
          }
        } catch (genreError: any) {
          // console.error(`  Error fetching genres for ${albumRecord.title}: ${genreError.message}`);
        }
      } // Closes 'if (mbReleaseIdToUseForGenres && !skipMusicBrainzDetailsFetch)'
    } // Closes 'if (albumRecord?.albumId)' for genre fetching

    // --- Track Creation ---
    if (trackTitle && albumRecord?.albumId && trackArtistsForDb.length > 0) {
      const trackMetadataForDb: TrackFileMetadata = {
        trackNumber: trackNumberForDb,
        diskNumber: diskNumberForDb,
        duration: durationForDb,
        year: trackYear ?? common.year ?? albumRecord?.year ?? null,
        genre: common.genre?.join(', ') || null,
        explicit: trackExplicit,
      };

      const trackRecord = await dbOperations.findOrCreateTrack({
        title: trackTitle,
        filePath,
        albumId: albumRecord!.albumId, // Added non-null assertion
        artists: trackArtistsForDb,
        musicbrainzTrackId: musicbrainzRecordingIdFromMeta || (common as any).musicbrainz_trackid,
        metadata: trackMetadataForDb,
      });

      if (trackRecord) {
        // console.log(`  Processed track: ${trackTitle} (ID: ${trackRecord.trackId})`);
      }
    } else if (trackTitle) {
      // console.warn(`  Album record not found, or no artists identified for track ${trackTitle}. Track not fully linked.`);
    }

    // Return album info for batch cover processing
    return {
      albumId: albumRecord!.albumId,
      title: albumRecord!.title,
      primaryArtistName: effectivePrimaryArtistName,
      needsCover: !albumRecord!.coverPath && !albumRecord!.musicbrainzReleaseId,
    };
  } catch (error: any) { // Catch for the main try block of processAudioFile
    // console.error(`Failed to process ${filePath}:`, error.message, error.stack);
    // Here, you might want to update scan statistics if you have a global stats object
    return null;
  }
} // Closing brace for processAudioFile async function

interface ScanStats {
  scannedFiles: number;
  addedTracks: number;
  addedArtists: number;
  addedAlbums: number;
  errors: number;
}
/**
 * Scans a specific media library directory, extracts metadata, and updates the database.
 * @returns Statistics about the scan operation
 */
export async function scanLibrary({
  libraryId,
  libraryPath,
  userId,
}: ScanLibraryParams): Promise<ScanStats> {
  console.log(`Starting scan for library ID: ${libraryId}, Path: ${libraryPath}, User ID: ${userId}`);
  
  // Reset any cached data from previous scans
  await dbOperations.resetScanSession();
  
  // Initialize counters
  const stats: ScanStats = {
    scannedFiles: 0,
    addedTracks: 0,
    addedArtists: 0,
    addedAlbums: 0,
    errors: 0
  };
  
  // Track albums that need cover art for batch processing
  const albumsNeedingCovers: { albumId: string; title: string; artistName: string }[] = [];
  
  try {
    // Get initial counts from database to calculate additions
    const initialCounts = await getEntityCounts(userId);
    
    // Find all audio files in the library
    const audioFiles = await fileUtils.findAudioFiles(libraryPath);
    
    if (audioFiles.length === 0) {
      console.log(`No audio files found in library ID: ${libraryId}, Path: ${libraryPath}`);
      return stats;
    }
    
    console.log(`Found ${audioFiles.length} audio files. Starting metadata processing...`);
    stats.scannedFiles = audioFiles.length;
    
    // Process each file
    for (const filePath of audioFiles) {
      try {
        // Modified processAudioFile to collect albums needing covers
        const albumInfo = await processAudioFile(filePath, { libraryId, userId });
        
        // If the album needs a cover and has enough info to search, add to batch processing list
        if (albumInfo && albumInfo.needsCover && albumInfo.title && albumInfo.primaryArtistName) {
          albumsNeedingCovers.push({
            albumId: albumInfo.albumId,
            title: albumInfo.title,
            artistName: albumInfo.primaryArtistName
          });
        }
      } catch (error: any) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
        stats.errors++;
      }
    }
    
    // Batch process album covers after all files are processed
    if (albumsNeedingCovers.length > 0) {
      console.log(`Batch processing covers for ${albumsNeedingCovers.length} albums...`);
      await batchProcessAlbumCovers(albumsNeedingCovers);
    }
    
    // Get final counts to calculate additions
    const finalCounts = await getEntityCounts(userId);
    
    // Calculate additions
    stats.addedTracks = finalCounts.tracks - initialCounts.tracks;
    stats.addedArtists = finalCounts.artists - initialCounts.artists;
    stats.addedAlbums = finalCounts.albums - initialCounts.albums;
    
    console.log(`Scan complete. Added ${stats.addedTracks} tracks, ${stats.addedArtists} artists, ${stats.addedAlbums} albums.`);
    
    // Reset caches after scan is complete
    await dbOperations.resetScanSession();
    
    return stats;
  } catch (error: any) {
    console.error(`Scan error: ${error.message}`);
    stats.errors++;
    return stats;
  }
}

/**
 * Batch processes album covers for multiple albums at once
 */
async function batchProcessAlbumCovers(albumsToProcess: { albumId: string; title: string; artistName: string }[]): Promise<void> {
  // Process in smaller batches to avoid overwhelming the MusicBrainz API
  const batchSize = 10;
  
  for (let i = 0; i < albumsToProcess.length; i += batchSize) {
    const batch = albumsToProcess.slice(i, i + batchSize);
    
    // Process each album in the current batch
    const promises = batch.map(async (album) => {
      try {
        // Search for MusicBrainz release ID
        const mbReleaseId = await searchReleaseByTitleAndArtist(album.title, album.artistName);
        
        if (mbReleaseId) {
          // Update album with MusicBrainz release ID
          await db.update(albums)
            .set({ musicbrainzReleaseId: mbReleaseId, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, album.albumId));
          
          // Fetch and save cover art
          const coverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbReleaseId);
          
          if (coverPath) {
            await db.update(albums)
              .set({ coverPath: coverPath, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, album.albumId));
          }
        }
      } catch (error) {
        // Log error but continue with other albums
        console.error(`Error processing cover for album ${album.title}: ${error}`);
      }
    });
    
    // Wait for current batch to complete before moving to next batch
    await Promise.all(promises);
    
    // Add a small delay between batches to respect API rate limits
    if (i + batchSize < albumsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Gets the current count of entities (tracks, artists, albums) for a user
 */
async function getEntityCounts(userId: string): Promise<{ tracks: number; artists: number; albums: number }> {
  // Count tracks for the user
  const [tracksResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tracks);
  
  // Count artists for the user
  const [artistsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(artistUsers)
    .where(eq(artistUsers.userId, userId));
  
  // Count albums for the user
  const [albumsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(albums)
    .where(eq(albums.userId, userId));
  
  return {
    tracks: tracksResult?.count || 0,
    artists: artistsResult?.count || 0,
    albums: albumsResult?.count || 0
  };
}

/**
 * Scans the covers directory and updates the database by setting coverPath to null
 * for albums whose cover art files are missing from disk.
 */
export async function pruneOrphanedAlbumArtPaths(): Promise<void> {
  console.log('Starting scan to prune orphaned album art paths...');
  
  try {
    // Ensure the covers directory exists
    await fileUtils.ensureDir(albumArtUtils.COVERS_DIR);
    
    // Get all files in the covers directory
    const filesOnDisk = await fileUtils.readdir(albumArtUtils.COVERS_DIR);
    const existingCoverFiles = new Set(filesOnDisk);
    
    console.log(`Found ${existingCoverFiles.size} files in ${albumArtUtils.COVERS_DIR}.`);

    // Find all albums with a cover path
    const albumsWithArt = await db
      .select({
        albumId: albums.albumId,
        title: albums.title,
        coverPath: albums.coverPath,
      })
      .from(albums)
      .where(sql`${albums.coverPath} IS NOT NULL AND ${albums.coverPath} != ''`);

    if (albumsWithArt.length === 0) {
      console.log('No albums in the database have a cover path set. Nothing to prune.');
      return;
    }

    console.log(`Checking ${albumsWithArt.length} albums with cover paths in the database.`);
    let prunedCount = 0;

    // Check each album's cover path
    for (const album of albumsWithArt) {
      if (!album.coverPath) continue;
      
      const filename = basename(album.coverPath);
      
      if (!existingCoverFiles.has(filename)) {
        console.log(`  Found orphaned cover path for album "${album.title}" (ID: ${album.albumId}): ${album.coverPath}`);
        
        // Update the album to remove the cover path
        await db
          .update(albums)
          .set({ coverPath: null, updatedAt: sql`CURRENT_TIMESTAMP` })
          .where(eq(albums.albumId, album.albumId));
          
        prunedCount++;
      }
    }

    console.log(`Pruned ${prunedCount} orphaned album art paths.`);
  } catch (error: any) {
    console.error('Error pruning orphaned album art paths:', error.message);
    throw error;
  }
}

// Export all scanner functionality
export const scanner = {
  scanLibrary,
  pruneOrphanedAlbumArtPaths,
  batchProcessAlbumCovers,
} as const;

// Export as default for backward compatibility
export default scanner;

// Export types
export * from './types';

// Export utility functions
export * from './file-utils';
export * from './album-art-utils';
export * from './db-operations';

export { batchProcessAlbumCovers };
