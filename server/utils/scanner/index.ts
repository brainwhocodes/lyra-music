import * as fs from 'fs/promises';
import * as mm from 'music-metadata';
import { basename, dirname, extname, join } from 'path';
import { db } from '~/server/db';
import { type Album, type Artist, albums, tracks, artistUsers } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { AlbumArtistInfo, TrackArtistInfo } from './db-operations';
import { fileUtils } from '~/server/utils/scanner/file-utils';
import { albumArtUtils } from '~/server/utils/scanner/album-art-utils';
import * as dbOperations from '~/server/utils/scanner/db-operations';
import type { TrackFileMetadata } from '~/server/utils/scanner/db-operations';
import { TrackMetadata } from '~/server/utils/scanner/types';
import { getReleaseInfoWithTags, searchReleaseByTitleAndArtist, getReleaseTracklist } from '~/server/utils/musicbrainz';
import { AlbumProcessStatus } from '~/types/enums/album-process-status';
import { splitArtistString } from '~/server/utils/artist-utils';


interface ScanLibraryParams {
  libraryId: string;
  libraryPath: string;
  userId: string;
  processOnlyUnprocessed?: boolean;
}

function isSingleFolder(audioFiles: string[]): boolean {
  return audioFiles.length === 1;
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
export async function processAudioFile(
  filePath: string,
  { userId, isVariousArtistsCompilation, artistsProcessedForImages }: { 
    userId: string; 
    isVariousArtistsCompilation?: boolean;
    artistsProcessedForImages: Set<string>;
  }
): Promise<{ albumId: string; title: string; primaryArtistName: string; needsCover: boolean } | null> {
  console.log(`[processAudioFile] Starting: ${filePath}`);
  try {
    const { metadata, albumArtPath } = await extractMetadata(filePath);
    if (!metadata) {
      console.error(`[processAudioFile] Failed to extract metadata for: ${filePath}`);
      return null;
    }
    console.log(`[processAudioFile] OK: Metadata extracted for: ${filePath}`);

    const common = metadata.common || {};
    const trackTitle = common.title?.trim();
    if (!trackTitle) {
      console.warn(`[processAudioFile] Skipping file due to missing track title: ${filePath}`);
      return null;
    }

    const allArtistNames = new Set<string>();
    splitArtistString(common.artist || '').forEach(name => allArtistNames.add(name));
    splitArtistString((common as any).albumartist || '').forEach(name => allArtistNames.add(name));
    if (allArtistNames.size === 0) allArtistNames.add('Unknown Artist');
    console.log(`[processAudioFile] OK: Artists identified: ${[...allArtistNames].join(', ')}`);

    const artistPromises = Array.from(allArtistNames).map(name => {
      const shouldSkipFetch = artistsProcessedForImages.has(name);
      if (!shouldSkipFetch) artistsProcessedForImages.add(name);
      return dbOperations.findOrCreateArtist({ artistName: name, userId, skipRemoteImageFetch: shouldSkipFetch });
    });
    const artistRecords = (await Promise.all(artistPromises)).filter((rec): rec is Artist => !!rec);
    if (artistRecords.length === 0) {
      console.error(`[processAudioFile] Failed to find or create any artist records for: ${filePath}`);
      return null;
    }
    console.log(`[processAudioFile] OK: Artist records processed: ${artistRecords.map(a => a.name).join(', ')}`);

    const primaryArtist = artistRecords[0]!;
    const albumArtists = artistRecords.map(ar => ({ artistId: ar.artistId, isPrimary: ar.artistId === primaryArtist.artistId, role: ar.artistId === primaryArtist.artistId ? 'main' : 'artist' }));

    const albumRecord = await dbOperations.findOrCreateAlbum({
      albumTitle: common.album || 'Unknown Album',
      artistsArray: albumArtists,
      userId,
      year: common.year,
      coverPath: albumArtPath,
      musicbrainzReleaseId: (common as any).musicbrainz_releasegroupid,
      folderPath: dirname(filePath),
    });

    if (!albumRecord) {
      console.error(`[processAudioFile] Failed to find or create album for: ${filePath}`);
      return null;
    }
    console.log(`[processAudioFile] OK: Album record processed: ${albumRecord.title}`);

    // Handle genres, preferring MusicBrainz data
    let genresProcessed = false;
    if (albumRecord.musicbrainzReleaseId) {
      console.log(`[processAudioFile] Fetching MusicBrainz genres for album: ${albumRecord.title}`);
      try {
        const releaseInfo = await getReleaseInfoWithTags(albumRecord.musicbrainzReleaseId);
        if (releaseInfo?.genres && releaseInfo.genres.length > 0) {
          for (const genre of releaseInfo.genres) {
            const genreId = await dbOperations.findOrCreateGenre(genre.name);
            if (genreId) {
              await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
            }
          }
          console.log(`[processAudioFile] OK: MusicBrainz genres processed for album: ${albumRecord.title}`);
          genresProcessed = true;
        }
      } catch (error: any) {
        console.warn(`[processAudioFile] Failed to fetch MusicBrainz genres for ${albumRecord.title}: ${error.message}`);
      }
    }

    // Fallback to local file metadata if MusicBrainz genres were not processed
    if (!genresProcessed && common.genre && common.genre.length > 0) {
      console.log(`[processAudioFile] Using local metadata for genres for album: ${albumRecord.title}`);
      for (const genreName of common.genre) {
        const genreId = await dbOperations.findOrCreateGenre(genreName);
        if (genreId) {
          await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
        }
      }
      console.log(`[processAudioFile] OK: Local genres processed for album: ${albumRecord.title}`);
    }

    const trackArtists = artistRecords.map(ar => ({ artistId: ar.artistId, isPrimary: ar.artistId === primaryArtist.artistId, role: ar.artistId === primaryArtist.artistId ? 'main' : 'artist' }));

    const trackRecord = await dbOperations.findOrCreateTrack({
      title: trackTitle,
      filePath,
      albumId: albumRecord.albumId,
      artists: trackArtists,
      musicbrainzTrackId: (common as any).musicbrainz_recordingid,
      metadata: {
        duration: metadata.format?.duration ? Math.round(metadata.format.duration) : null,
        trackNumber: common.track?.no ?? null,
        diskNumber: common.disk?.no ?? null,
        year: common.year,
        explicit: (common as any).parentaladvisory === true,
      },
    });

    if (!trackRecord) {
      console.error(`[processAudioFile] Failed to find or create track for: ${filePath}`);
      return null;
    }
    console.log(`[processAudioFile] OK: Track record processed: ${trackRecord.title}`);

    return {
      albumId: albumRecord.albumId,
      title: albumRecord.title,
      primaryArtistName: primaryArtist.name,
      needsCover: !albumRecord.coverPath && !albumRecord.musicbrainzReleaseId,
    };
  } catch (error: any) {
    console.error(`[processAudioFile] CRITICAL ERROR for ${filePath}: ${error.message}`, error.stack);
    return null;
  }
} // Closing brace for processAudioFile async function

interface ScanStats {
  scannedFiles: number;
  addedTracks: number;
  addedArtists: number;
  addedAlbums: number;
  completedAlbums: number;
  failedAlbums: number;
  errors: number;
}

/**
 * Scans a specific media library directory, extracts metadata, and updates the database.
 * This implements a two-phase approach:
 * 1. First phase: Create initial album records for each folder in PENDING status
 * 2. Second phase: Process audio files in each album, updating metadata and status
 * @returns Statistics about the scan operation
 */
export async function scanLibrary({
  libraryId,
  libraryPath,
  userId,
  processOnlyUnprocessed = false,
}: ScanLibraryParams): Promise<ScanStats> {
  console.log(`\n--- Starting scan for library: ${libraryId} ---`);
  await dbOperations.resetScanSession();
  const stats: ScanStats = { scannedFiles: 0, addedTracks: 0, addedArtists: 0, addedAlbums: 0, completedAlbums: 0, failedAlbums: 0, errors: 0 };

  try {
    const allFiles = await fs.readdir(libraryPath, { recursive: true });
    const audioFiles = allFiles.map(file => join(libraryPath, file.toString())).filter(file => {
      const ext = extname(file).toLowerCase();
      return ['.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav'].includes(ext);
    });
    stats.scannedFiles = audioFiles.length;
    console.log(`Found ${stats.scannedFiles} audio files.`);

    const filesByFolder: Record<string, string[]> = {};
    audioFiles.forEach(filePath => {
      const folder = dirname(filePath);
      if (!filesByFolder[folder]) filesByFolder[folder] = [];
      filesByFolder[folder].push(filePath);
    });
    console.log(`Found ${Object.keys(filesByFolder).length} potential album folders.`);

    console.log('\n--- PHASE 1: Creating initial album records ---');
    const albumCreationPromises = Object.keys(filesByFolder).map(async (folderPath) => {
      const filesInFolder = filesByFolder[folderPath]!;
      const firstFilePath = filesInFolder[0]!;
      let albumTitle = 'Unknown Album';
      try {
        const { metadata } = await extractMetadata(firstFilePath);
        albumTitle = metadata?.common?.album?.trim() || basename(folderPath);
      } catch { albumTitle = basename(folderPath); }
      return dbOperations.createInitialAlbumRecord({ folderPath, albumTitle, userId });
    });
    const createdAlbums = (await Promise.all(albumCreationPromises)).filter((album): album is Album => !!album);
    console.log(`PHASE 1 Complete: ${createdAlbums.length} albums identified.`);

    console.log('\n--- PHASE 2: Processing files for each album ---');
    const artistsProcessedForImages = new Set<string>();
    const albumsNeedingCovers: { albumId: string; title: string; artistName: string }[] = [];

    for (const albumRecord of createdAlbums) {
      console.log(`\nProcessing Album: ${albumRecord.title} (${albumRecord.albumId})`);
      const filesInFolder = filesByFolder[albumRecord.folderPath!]!;
      const isSingle = isSingleFolder(filesInFolder);
      const { isVariousArtistsCompilation } = await detectVariousArtistsAlbum(filesInFolder, userId, isSingle);

      const fileProcessingPromises = filesInFolder.map(filePath =>
        processAudioFile(filePath, { userId, isVariousArtistsCompilation, artistsProcessedForImages })
      );
      const fileProcessingResults = await Promise.allSettled(fileProcessingPromises);

      const successfulTracks = fileProcessingResults.filter(r => r.status === 'fulfilled' && r.value) as PromiseFulfilledResult<{ albumId: string; title: string; primaryArtistName: string; needsCover: boolean }>[];
      stats.addedTracks += successfulTracks.length;
      successfulTracks.forEach(r => {
        if (r.value.needsCover) {
          albumsNeedingCovers.push({
            albumId: r.value.albumId,
            title: r.value.title,
            artistName: r.value.primaryArtistName,
          });
        }
      });

      const finalStatus = successfulTracks.length === filesInFolder.length ? AlbumProcessStatus.IN_PROGRESS : AlbumProcessStatus.FAILED;
      if (finalStatus === AlbumProcessStatus.IN_PROGRESS) stats.completedAlbums++; else stats.failedAlbums++;
      await db.update(albums).set({ processedStatus: finalStatus, updatedAt: new Date().toISOString() }).where(eq(albums.albumId, albumRecord.albumId));
      console.log(`Album ${albumRecord.title} finished processing. Status: ${finalStatus}. Tracks added: ${successfulTracks.length}/${filesInFolder.length}`);
    }

    if (albumsNeedingCovers.length > 0) {
      console.log(`\n--- PHASE 3: Processing ${albumsNeedingCovers.length} album covers ---`);
      await batchProcessAlbumCovers(albumsNeedingCovers);
    }

    console.log(`\n--- Scan Complete ---`);
    console.log(`Summary: ${stats.addedTracks} tracks, ${stats.completedAlbums} completed albums, ${stats.failedAlbums} failed albums.`);
    return stats;
  } catch (error: any) {
    console.error(`[SCANNER] CRITICAL ERROR during scan: ${error.message}`, error.stack);
    stats.errors++;
    return stats;
  }
}

/**
 * Determines if an album folder should be treated as a Various Artists compilation
 * An album is considered a Various Artists compilation when:
 * - It contains tracks from multiple distinct primary artists
 * - No single artist has more than 5 tracks in that album folder
 * @param audioFilesInFolder Audio files in the same album folder
 * @param userId The user ID (for processing files)
 * @returns Object containing the various artists determination and optional various artists ID
 */
async function detectVariousArtistsAlbum(audioFilesInFolder: string[], userId: string, isSingle: boolean = false): Promise<{
  isVariousArtistsCompilation: boolean;
  primaryArtistCounts: Record<string, { count: number; name: string }>;
  albumTitle?: string;
}> {
  if (audioFilesInFolder.length === 0) {
    return { isVariousArtistsCompilation: false, primaryArtistCounts: {} };
  }

  if (isSingle) {
    try {
      const { metadata } = await extractMetadata(audioFilesInFolder[0]!);
      const singleAlbumTitle = metadata.common.album?.trim();
      return { isVariousArtistsCompilation: false, primaryArtistCounts: {}, albumTitle: singleAlbumTitle };
    } catch {
      return { isVariousArtistsCompilation: false, primaryArtistCounts: {} };
    }
  }

  // Maximum number of tracks by the same artist before we no longer consider it a compilation
  const ARTIST_DOMINANCE_THRESHOLD = 5;
  
  const primaryArtistCounts: Record<string, { count: number; name: string }> = {};
  let albumTitle: string | undefined;

  // First pass: collect primary artist information in parallel
  const fileProcessingPromises = audioFilesInFolder.map(async (filePath) => {
    try {
      const { metadata } = await extractMetadata(filePath);
      const common = metadata.common || {};
      
      const localAlbumTitle = common.album?.trim();

      const primaryTrackArtists = new Set<string>();
      if (common.artist) {
        splitArtistString(common.artist).forEach(artist => primaryTrackArtists.add(artist));
      }
      if (primaryTrackArtists.size === 0 && (common as any).albumartist) {
        splitArtistString((common as any).albumartist).forEach(artist => primaryTrackArtists.add(artist));
      }
      if (primaryTrackArtists.size === 0) {
        primaryTrackArtists.add('Unknown Artist');
      }

      const artistRecords = await Promise.all(
        Array.from(primaryTrackArtists).map(artistName => dbOperations.getOrCreateArtistMinimal({ artistName }))
      );

      return {
        albumTitle: localAlbumTitle,
        artists: artistRecords.filter((rec): rec is Artist => !!rec),
      };
    } catch (error) {
      console.error(`Error analyzing file ${filePath} for artist distribution: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  });

  const processedFiles = (await Promise.all(fileProcessingPromises)).filter((res): res is NonNullable<typeof res> => !!res);

  for (const { albumTitle: localAlbumTitle, artists } of processedFiles) {
    if (!albumTitle && localAlbumTitle) {
      albumTitle = localAlbumTitle;
    }
    for (const artistRecord of artists) {
      const { artistId, name } = artistRecord;
      if (!primaryArtistCounts[artistId]) {
        primaryArtistCounts[artistId] = { count: 0, name };
      }
      primaryArtistCounts[artistId].count++;
    }
  }

  // Analyze the distribution of primary artists
  const uniqueArtistCount = Object.keys(primaryArtistCounts).length;
  const hasDominantArtist = Object.values(primaryArtistCounts).some(info => info.count > ARTIST_DOMINANCE_THRESHOLD);
  
  // It's a Various Artists compilation if:
  // 1. There are multiple unique primary artists, AND
  // 2. No single artist has more than the threshold number of tracks
  const isVariousArtistsCompilation = uniqueArtistCount > 1 && !hasDominantArtist;
  
  return {
    isVariousArtistsCompilation,
    primaryArtistCounts,
    albumTitle
  };
}

/**
    });
    
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

    const promises = batch.map(async (album) => {
      try {
        const mbReleaseId = await searchReleaseByTitleAndArtist(album.title, album.artistName);
        if (mbReleaseId) {
          await db.update(albums)
            .set({ musicbrainzReleaseId: mbReleaseId, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, album.albumId));
          
          const coverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbReleaseId);
          
          if (coverPath) {
            await db.update(albums)
              .set({ coverPath: coverPath, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, album.albumId));
          }
        }
      } catch (error) {
        console.error(`Error processing cover for album ${album?.title}:`, error);
      } finally {
        // Mark the album as completed since the processing attempt (success or fail) is done.
        await db.update(albums)
          .set({ processedStatus: AlbumProcessStatus.COMPLETED, updatedAt: new Date().toISOString() })
          .where(eq(albums.albumId, album.albumId));
      }
    });

    // We use Promise.all here because errors are caught within the map function.
    await Promise.all(promises);

    // Wait for 1 second before processing the next batch to respect rate limits
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
          .set({ coverPath: null, updatedAt: new Date().toISOString() })
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

/**
 * Gets album covers in batches, optimizing API calls.
 * @param albumsNeedingCovers Albums that need cover art
 * @returns Array of processed album IDs
 */
async function getBatchedCovers(albumsNeedingCovers: { albumId: string; title: string; artistName: string }[]): Promise<string[]> {
  const processedAlbumIds: string[] = [];
  
  console.log(`Processing batch cover fetching for ${albumsNeedingCovers.length} albums`);
  
  // Process in smaller batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < albumsNeedingCovers.length; i += batchSize) {
    const batch = albumsNeedingCovers.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (album) => {
      try {
        const coverPath = await albumArtUtils.searchAndDownloadAlbumArt(album.title, album.artistName);
        
        if (coverPath) {
          await db.update(albums)
            .set({ coverPath, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, album.albumId));
            
          return album.albumId;
        }
      } catch (error) {
        console.error(`Error fetching cover for album ${album.title} by ${album.artistName}:`, error);
      }
      return null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const albumId of batchResults) {
      if (albumId) processedAlbumIds.push(albumId);
    }
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < albumsNeedingCovers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`Successfully fetched ${processedAlbumIds.length} album covers out of ${albumsNeedingCovers.length} requested`);
  return processedAlbumIds;
}

/**
 * Identifies potential album folders from a list of audio files.
 * @param audioFiles Array of audio file paths
 * @returns Map of folder paths to audio files in that folder
 */
function identifyAlbumFolders(audioFiles: string[]): Map<string, string[]> {
  const albumFolders = new Map<string, string[]>();
  
  // Group audio files by their parent folder
  for (const filePath of audioFiles) {
    const folderPath = dirname(filePath);
    if (!albumFolders.has(folderPath)) {
      albumFolders.set(folderPath, []);
    }
    albumFolders.get(folderPath)!.push(filePath);
  }
  
  return albumFolders;
}

/**
 * Creates initial album records for each folder in PENDING status.
 * @param folderMap Map of folder paths to audio files in that folder
 * @param params Parameters needed for album creation
 * @returns Array of created album records
 */
async function createInitialAlbumRecords(
  folderMap: Map<string, string[]>,
  { libraryId, userId }: { libraryId: string; userId: string }
): Promise<Album[]> {
  const createdAlbums: Album[] = [];
  let counter = 0;
  const totalFolders = folderMap.size;
  
  for (const [folderPath, audioFiles] of folderMap.entries()) {
    counter++;
    console.log(`[${counter}/${totalFolders}] Creating initial album record for folder: ${folderPath}`);
    
    try {
      if (audioFiles.length === 0) continue;
      
      // Try to get album name from folder
      const folderName = basename(folderPath);
      
      // Create album record in PENDING status
      const newAlbum = await dbOperations.createInitialAlbumRecord({
        folderPath,
        albumTitle: folderName || 'Unknown Album',
        userId,
      });
      
      if (newAlbum) {
        createdAlbums.push(newAlbum);
      }
    } catch (error) {
      console.error(`Error creating initial album record for folder ${folderPath}:`, error);
    }
  }
  
  console.log(`Created initial records for ${createdAlbums.length} albums`);
  return createdAlbums;
}

// Create a grouped export object that includes all scanner functions
const scanner = {
  scanLibrary,
  extractMetadata,
  pruneOrphanedAlbumArtPaths,
  processAudioFile,
  getBatchedCovers,
  identifyAlbumFolders,
  createInitialAlbumRecords,
  detectVariousArtistsAlbum,
  isSingleFolder,
};

// Export as default for backward compatibility
export default scanner;

// Export types
export * from './types';

// Export utility functions
export * from './file-utils';
export * from './album-art-utils';
export * from './db-operations';

export { batchProcessAlbumCovers, detectVariousArtistsAlbum, isSingleFolder };
