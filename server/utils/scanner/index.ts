import * as mm from 'music-metadata';
import path from 'path';
import { db } from '~/server/db';
import { albums } from '~/server/db/schema';
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

    // Attempt to extract MusicBrainz Release ID
    let musicbrainzReleaseIdFromMeta: string | undefined = undefined;
    const rawMbReleaseId = (common as any).musicbrainz_releaseid; // Use 'as any' to bypass strict type check for now
    if (Array.isArray(rawMbReleaseId) && rawMbReleaseId.length > 0) {
      musicbrainzReleaseIdFromMeta = String(rawMbReleaseId[0]); // Ensure it's a string
    } else if (typeof rawMbReleaseId === 'string') {
      musicbrainzReleaseIdFromMeta = rawMbReleaseId;
    }
    // As a fallback, you could check other potential MBID fields if the above is not found:
    // if (!musicbrainzReleaseIdFromMeta) {
    //   const rawMbAlbumId = (common as any).musicbrainz_albumid;
    //   if (Array.isArray(rawMbAlbumId) && rawMbAlbumId.length > 0) {
    //     musicbrainzReleaseIdFromMeta = String(rawMbAlbumId[0]);
    //   } else if (typeof rawMbAlbumId === 'string') {
    //     musicbrainzReleaseIdFromMeta = rawMbAlbumId;
    //   }
    // }

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
      musicbrainzReleaseId: musicbrainzReleaseIdFromMeta, // Pass to findOrCreateAlbum
    });

    // --- Start: MusicBrainz Genre Fetching ---
    if (albumId) {
      let mbReleaseId: string | undefined = musicbrainzReleaseIdFromMeta; // Use extracted ID
      console.log(`  [Genre Fetch] Album ID: ${albumId}, MB Release ID from metadata: ${mbReleaseId}`);

      // If no MBID from metadata, try searching MusicBrainz by album/artist
      if (!mbReleaseId && trackAlbumTitle) {
        console.log(`  [Genre Fetch] No MBID from metadata. Searching MusicBrainz for album: "${trackAlbumTitle}", artist: "${trackArtistName || 'Unknown'}"`);
        const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, trackArtistName);
        if (searchResultMbId) {
          console.log(`  [Genre Fetch] Found MBID from search: ${searchResultMbId}`);
          mbReleaseId = searchResultMbId;
          // Optionally, update the album in the DB with this found MBID
          // await dbOperations.updateAlbumMbId(albumId, searchResultMbId);
        } else {
          console.log(`  [Genre Fetch] MusicBrainz search found no results for "${trackAlbumTitle}".`);
        }
      }

      if (mbReleaseId) {
        try {
          console.log(`  [Genre Fetch] Fetching MusicBrainz info for MB Release ID ${mbReleaseId}`);
          const releaseInfo = await getReleaseInfoWithTags(mbReleaseId);
          console.log('  [Genre Fetch] Raw MusicBrainz Release Info:', JSON.stringify(releaseInfo, null, 2)); // Added log for raw response
          
          if (releaseInfo && releaseInfo.genres && Array.isArray(releaseInfo.genres) && releaseInfo.genres.length > 0) { // Added length check
            const musicBrainzGenres: { name: string }[] = releaseInfo.genres;
            console.log(`    [Genre Fetch] Found ${musicBrainzGenres.length} genres from MusicBrainz:`, musicBrainzGenres.map(g => g.name).join(', '));

            for (const genreFromMb of musicBrainzGenres) {
              if (genreFromMb.name) {
                console.log(`    [Genre Fetch] Processing genre: ${genreFromMb.name}`); // Added log
                const genreId = await dbOperations.findOrCreateGenre(genreFromMb.name);
                if (genreId) {
                  await dbOperations.linkAlbumToGenre(albumId, genreId);
                }
              }
            }
          } else if (releaseInfo && releaseInfo.tags && Array.isArray(releaseInfo.tags) && releaseInfo.tags.length > 0) { // Added length check
            const musicBrainzTags: { name: string, count: number }[] = releaseInfo.tags;
            console.log(`    [Genre Fetch] No 'genres' found. Found ${musicBrainzTags.length} tags from MusicBrainz:`, musicBrainzTags.map(t => t.name).join(', '));

            for (const tagFromMb of musicBrainzTags) {
              if (tagFromMb.name) {
                console.log(`    [Genre Fetch] Processing tag as genre: ${tagFromMb.name}`); // Added log
                const genreId = await dbOperations.findOrCreateGenre(tagFromMb.name);
                if (genreId) {
                  await dbOperations.linkAlbumToGenre(albumId, genreId);
                }
              }
            }
          } else {
            console.log(`    [Genre Fetch] No genres or tags found in MusicBrainz response for MB Release ID ${mbReleaseId}.`); // Added log
          }
        } catch (error: any) {
          console.error(`  [Genre Fetch] Error fetching or processing MusicBrainz genres for ${mbReleaseId}: ${error.message}`);
        }
      } else {
        console.log(`  Skipping MusicBrainz genre fetch for album ID ${albumId} as no MBReleaseID is available.`);
      }
    }
    // --- End: MusicBrainz Genre Fetching ---

    // Find or create track
    await dbOperations.findOrCreateTrack({
      title: trackTitle,
      filePath,
      albumId,
      artistId,
      metadata,
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
