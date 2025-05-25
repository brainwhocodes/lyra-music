import * as mm from 'music-metadata';
import path from 'path';
import { db } from '~/server/db';
import { albums } from '~/server/db/schema';
import { eq, sql } from 'drizzle-orm';
import { fileUtils } from './file-utils';
import { albumArtUtils } from './album-art-utils';
import { dbOperations } from './db-operations';
import { ProcessedTrack, TrackMetadata } from './types';

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
    const albumDir = path.dirname(filePath);
    
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

  try {
    const { metadata, albumArtPath } = await extractMetadata(filePath);
    const common = metadata.common || {};
    
    const trackTitle = common.title?.trim();
    const trackArtistName = common.artist?.trim();
    const trackAlbumTitle = common.album?.trim();

    if (!trackTitle) {
      console.warn(`  Track title not found for ${filePath}. Skipping.`);
      return;
    }

    // Find or create artist
    const artistId = await dbOperations.findOrCreateArtist({
      artistName: trackArtistName || 'Unknown Artist',
      userId,
    });

    // Find or create album
    const albumId = await dbOperations.findOrCreateAlbum({
      albumTitle: trackAlbumTitle || 'Unknown Album',
      artistId,
      userId,
      year: common.year,
      coverPath: albumArtPath,
    });

    // Find or create track
    await dbOperations.findOrCreateTrack({
      title: trackTitle,
      filePath,
      albumId,
      artistId,
      genre: common.genre?.[0],
      duration: metadata.format?.duration ? Math.round(metadata.format.duration) : null,
      trackNumber: common.track?.no,
      libraryId,
    });
  } catch (error: any) {
    console.error(`Failed to process file ${filePath}: ${error.message}`);
  }
}

/**
 * Scans a specific media library directory, extracts metadata, and updates the database.
 */
export async function scanLibrary({
  libraryId,
  libraryPath,
  userId,
}: ScanLibraryParams): Promise<void> {
  console.log(`Starting scan for library ID: ${libraryId}, Path: ${libraryPath}, User ID: ${userId}`);
  
  try {
    // Find all audio files in the library
    const audioFiles = await fileUtils.findAudioFiles(libraryPath);
    
    if (audioFiles.length === 0) {
      console.log(`No audio files found in library ID: ${libraryId}, Path: ${libraryPath}`);
      return;
    }
    
    console.log(`Found ${audioFiles.length} audio files. Starting metadata processing...`);
    
    // Process each file
    for (const filePath of audioFiles) {
      await processAudioFile(filePath, { libraryId, userId });
    }
    
    console.log(`Finished processing all ${audioFiles.length} audio files for library ID: ${libraryId}.`);
  } catch (error: any) {
    console.error(`Error scanning library ID ${libraryId}: ${error.message}`);
    throw error;
  }
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
      
      const filename = path.basename(album.coverPath);
      
      if (!existingCoverFiles.has(filename)) {
        console.log(`  Found orphaned cover path for album "${album.title}" (ID: ${album.albumId}): ${album.coverPath}`);
        
        // Update the album to remove the cover path
        await db
          .update(albums)
          .set({ coverPath: null, updatedAt: new Date() })
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
