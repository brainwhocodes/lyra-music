import * as mm from 'music-metadata';
import { dirname, basename } from 'node:path';
import { db } from '~/server/db';
import { albums, tracks, artistUsers } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fileUtils } from './file-utils';
import { albumArtUtils } from './album-art-utils';
import { dbOperations } from './db-operations';
import { ProcessedTrack, TrackMetadata } from './types';
import { getReleaseInfoWithTags, searchReleaseByTitleAndArtist } from '~/server/utils/musicbrainz';

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
): Promise<void> {
  console.log(`Processing: ${filePath}`);
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
      console.warn(`  Track title not found for ${filePath}. Skipping.`);
      return;
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
      console.warn(`  No artist records could be processed for ${filePath}. Skipping album/track linking.`);
      return; // Or handle track creation without album/artist if desired
    }

    const primaryArtistMinimalRecord = artistRecordsMinimal.find(ar => ar.name === effectivePrimaryArtistName) || artistRecordsMinimal[0];
    const primaryArtistIdFromMinimal = primaryArtistMinimalRecord.artistId;
    const allArtistIdsFromMinimal = artistRecordsMinimal.map(ar => ar.artistId);

    // --- Initial Album Record Fetch/Creation ---
    let albumRecord = await dbOperations.findOrCreateAlbum({
      albumTitle: trackAlbumTitle || 'Unknown Album',
      artistIds: allArtistIdsFromMinimal,
      primaryArtistId: primaryArtistIdFromMinimal,
      userId,
      year: trackYear,
      coverPath: albumArtPath,
      musicbrainzReleaseId: musicbrainzReleaseIdFromMeta,
    });

    // --- Determine skipMusicBrainzDetailsFetch ---
    if (albumRecord) {
      const hasGenres = await dbOperations.hasAlbumGenres(albumRecord.albumId);
      if (albumRecord.musicbrainzReleaseId && albumRecord.year !== null && hasGenres) {
        skipMusicBrainzDetailsFetch = true;
        console.log(`  Album '${albumRecord.title}' is complete. Skipping further MusicBrainz details fetch.`);
      }
    }

    // --- Full Artist Processing (Conditional Image Fetch) ---
    const finalArtistRecords: import('~/server/db/schema').Artist[] = [];
    for (const minimalArtist of artistRecordsMinimal) {
      const fullArtist = await dbOperations.findOrCreateArtist({
        artistName: minimalArtist.name,
        userId,
        skipRemoteImageFetch: skipMusicBrainzDetailsFetch,
      });
      if (fullArtist) finalArtistRecords.push(fullArtist);
    }
    const finalPrimaryArtistRecord = finalArtistRecords.find(ar => ar.name === effectivePrimaryArtistName) || (finalArtistRecords.length > 0 ? finalArtistRecords[0] : null);
    const trackArtistId = finalPrimaryArtistRecord?.artistId;

    // --- Conditional Album Cover Fetch ---
    if (!skipMusicBrainzDetailsFetch && albumRecord && !albumRecord.coverPath && albumRecord.musicbrainzReleaseId) {
      try {
        console.log(`  Fetching MB cover art for ${albumRecord.title} (MBID: ${albumRecord.musicbrainzReleaseId})`);
        const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(albumRecord.musicbrainzReleaseId);
        if (mbCoverPath) {
          const updatedAlbumResult = await db.update(albums)
            .set({ coverPath: mbCoverPath, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, albumRecord.albumId)).returning();
          if (updatedAlbumResult.length > 0) albumRecord = updatedAlbumResult[0];
        }
      } catch (mbArtError: any) {
        console.error(`  Error fetching cover art from MusicBrainz for album ${albumRecord.title}: ${mbArtError.message}`);
      }
    }

    // --- Conditional MusicBrainz Genre Fetching ---
    if (albumRecord?.albumId) {
      let mbReleaseIdToUseForGenres: string | undefined = albumRecord.musicbrainzReleaseId || musicbrainzReleaseIdFromMeta;

      if (!mbReleaseIdToUseForGenres && trackAlbumTitle && !skipMusicBrainzDetailsFetch) {
        console.log(`  Searching MBID for album: ${trackAlbumTitle} by ${effectivePrimaryArtistName}`);
        const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, effectivePrimaryArtistName);
        if (searchResultMbId) {
          mbReleaseIdToUseForGenres = searchResultMbId;
          if (albumRecord && !albumRecord.musicbrainzReleaseId) {
            const updatedAlbumResult = await db.update(albums)
              .set({ musicbrainzReleaseId: searchResultMbId, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId)).returning();
            if (updatedAlbumResult.length > 0) albumRecord = updatedAlbumResult[0];
            console.log(`  Found and updated album ${albumRecord.title} with MBID: ${searchResultMbId}`);
          }
        }
      }

      if (mbReleaseIdToUseForGenres && !skipMusicBrainzDetailsFetch) {
        try {
          console.log(`  Fetching genres for album ${albumRecord.title} (MBID: ${mbReleaseIdToUseForGenres})`);
          const releaseInfo = await getReleaseInfoWithTags(mbReleaseIdToUseForGenres);
          if (releaseInfo?.genres?.length) {
            for (const genre of releaseInfo.genres) {
              const genreId = await dbOperations.findOrCreateGenre(genre.name);
              if (genreId && albumRecord?.albumId) {
                await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
              }
            }
            console.log(`  Processed ${releaseInfo.genres.length} genres for ${albumRecord.title}.`);
          }
        } catch (genreError: any) {
          console.error(`  Error fetching genres for ${albumRecord.title}: ${genreError.message}`);
        }
      }
    }

    // --- Track Creation ---
    if (trackTitle && albumRecord?.albumId) {
      const trackId = await dbOperations.findOrCreateTrack({
        title: trackTitle,
        filePath,
        albumId: albumRecord.albumId,
        artistId: trackArtistId ?? null, // Use ID from fully processed primary artist, ensure null if undefined
        metadata: { // Pass relevant metadata including the explicit flag
          duration: metadata.format?.duration,
          trackNumber: common.track?.no,
          diskNumber: common.disk?.no,
          year: common.year, // Pass original year from track metadata if needed by findOrCreateTrack
          genre: common.genre?.join(', '), // Pass original genre from track metadata
          explicit: trackExplicit, // Pass determined explicit flag
          // Pass any other common fields if findOrCreateTrack uses them
        },
      });
      if (trackId) {
        console.log(`  Processed track: ${trackTitle} (ID: ${trackId})`);
      }
    } else if (trackTitle) {
      console.warn(`  Album record not found or not processed for track ${trackTitle}. Track not fully linked.`);
      // Optionally, create track without album/artist link or log differently
    }

  } catch (error: any) {
    console.error(`Failed to process ${filePath}:`, error.message, error.stack);
    // Here, you might want to update scan statistics if you have a global stats object
  }
}

/**
 * Tracks statistics for a scan operation
 */
export interface ScanStats {
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
  
  // Initialize counters
  const stats: ScanStats = {
    scannedFiles: 0,
    addedTracks: 0,
    addedArtists: 0,
    addedAlbums: 0,
    errors: 0
  };
  
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
        await processAudioFile(filePath, { libraryId, userId });
      } catch (error: any) {
        console.error(`Error processing file ${filePath}: ${error.message}`);
        stats.errors++;
      }
    }
    
    // Get final counts to calculate additions
    const finalCounts = await getEntityCounts(userId);
    
    // Calculate additions
    stats.addedTracks = finalCounts.tracks - initialCounts.tracks;
    stats.addedArtists = finalCounts.artists - initialCounts.artists;
    stats.addedAlbums = finalCounts.albums - initialCounts.albums;
    
    console.log(`Finished processing all ${audioFiles.length} audio files for library ID: ${libraryId}.`);
    console.log(`Added: ${stats.addedTracks} tracks, ${stats.addedArtists} artists, ${stats.addedAlbums} albums. Errors: ${stats.errors}`);
    
    return stats;
  } catch (error: any) {
    console.error(`Error scanning library ID ${libraryId}: ${error.message}`);
    stats.errors++;
    return stats;
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
} as const;

// Export as default for backward compatibility
export default scanner;

// Export types
export * from './types';

// Export utility functions
export * from './file-utils';
export * from './album-art-utils';
export * from './db-operations';
