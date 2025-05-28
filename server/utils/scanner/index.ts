import * as mm from 'music-metadata';
import path from 'path';
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
  let skipMusicBrainzDetailsFetch = false; // Initialize here

  try {
    const { metadata, albumArtPath } = await extractMetadata(filePath);
    const common = metadata.common || {};
    
    const trackTitle = common.title?.trim();
    const trackArtistName = common.artist?.trim();
    const trackAlbumTitle = common.album?.trim();

    // Attempt to extract MusicBrainz Release ID
    let musicbrainzReleaseIdFromMeta: string | undefined = undefined;
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

    // Process primary artist
    const primaryArtistRecord = await dbOperations.findOrCreateArtist({
      artistName: trackArtistName || 'Unknown Artist',
      userId,
      skipRemoteImageFetch: skipMusicBrainzDetailsFetch, // Pass the flag
    });
    const primaryArtistId = primaryArtistRecord?.artistId; // Extract ID
    
    // Process album artists (could be multiple)
    const artistIds: string[] = [];
    
    if (primaryArtistId) {
      artistIds.push(primaryArtistId);
    }
    
    const albumArtists = (common as any).albumartist ? [(common as any).albumartist] : [];
    const artists = (common as any).artists || [];
    
    const uniqueArtistNames = new Set<string>();
    
    if (trackArtistName) {
      uniqueArtistNames.add(trackArtistName);
    }
    
    if (albumArtists.length > 0) {
      albumArtists.forEach((artist: any) => {
        if (artist && typeof artist === 'string') {
          uniqueArtistNames.add(artist.trim());
        }
      });
    }
    
    if (artists.length > 0) {
      artists.forEach((artist: any) => {
        if (artist && typeof artist === 'string') {
          uniqueArtistNames.add(artist.trim());
        }
      });
    }
    
    for (const artistName of uniqueArtistNames) {
      if (artistName && artistName !== (trackArtistName || 'Unknown Artist')) {
        const additionalArtistRecord = await dbOperations.findOrCreateArtist({
          artistName,
          userId,
          skipRemoteImageFetch: skipMusicBrainzDetailsFetch, // Pass the flag
        });
        const additionalArtistId = additionalArtistRecord?.artistId; // Extract ID
        if (additionalArtistId && !artistIds.includes(additionalArtistId)) {
          artistIds.push(additionalArtistId);
        }
      }
    }
    
    // Find or create album with all artists
    let albumRecord = await dbOperations.findOrCreateAlbum({
      albumTitle: trackAlbumTitle || 'Unknown Album',
      artistIds,
      primaryArtistId, // Pass the string ID
      userId,
      year: common.year,
      coverPath: albumArtPath,
      musicbrainzReleaseId: musicbrainzReleaseIdFromMeta,
    });

    if (albumRecord) {
      const hasGenres = await dbOperations.hasAlbumGenres(albumRecord.albumId);
      if (
        albumRecord.musicbrainzReleaseId &&
        albumRecord.year !== null && // Ensure year is explicitly checked for non-null
        hasGenres
      ) {
        skipMusicBrainzDetailsFetch = true;
      }
    }

    // If album exists, has MBID, but no cover, try fetching from MusicBrainz
    // Also, only fetch if we haven't decided to skip MusicBrainz details
    if (!skipMusicBrainzDetailsFetch && albumRecord && !albumRecord.coverPath && albumRecord.musicbrainzReleaseId) {
      try {
        const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(albumRecord.musicbrainzReleaseId);
        if (mbCoverPath) {
          const updatedAlbumResult = await db
            .update(albums)
            .set({ coverPath: mbCoverPath, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, albumRecord.albumId))
            .returning(); // return the updated album to ensure albumRecord is fresh
          if (updatedAlbumResult.length > 0) {
            albumRecord = updatedAlbumResult[0]; // Update local albumRecord with new coverPath
          }
        } else {
        }
      } catch (mbArtError: any) {
        console.error(`  Error fetching cover art from MusicBrainz for album ${albumRecord.title}: ${mbArtError.message}`);
      }
    }

    // --- Start: MusicBrainz Genre Fetching ---
    if (albumRecord?.albumId) { // Use albumRecord.albumId
      let mbReleaseId: string | undefined = albumRecord.musicbrainzReleaseId || musicbrainzReleaseIdFromMeta;

      if (!mbReleaseId && trackAlbumTitle && !skipMusicBrainzDetailsFetch) { // Only search if not skipping and no MBID yet
        const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, trackArtistName);
        if (searchResultMbId) {
          mbReleaseId = searchResultMbId;
          // Update the album in the DB with this found MBID if it wasn't there
          // This update is important even if we skip fetching full details later
          if (albumRecord && !albumRecord.musicbrainzReleaseId) {
            const updatedAlbumResult = await db.update(albums)
              .set({ musicbrainzReleaseId: searchResultMbId, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId))
              .returning();
            if (updatedAlbumResult.length > 0) albumRecord = updatedAlbumResult[0];
          }
        } else {
        }
      }

      // Proceed to fetch genre details only if we have an mbReleaseId AND we are not skipping
      if (mbReleaseId && !skipMusicBrainzDetailsFetch) {
        try {
          const releaseInfo = await getReleaseInfoWithTags(mbReleaseId);
          
          if (releaseInfo && releaseInfo.genres && Array.isArray(releaseInfo.genres) && releaseInfo.genres.length > 0) {
            const musicBrainzGenres: { name: string }[] = releaseInfo.genres;

            for (const genreFromMb of musicBrainzGenres) {
              if (genreFromMb.name) {
                const genreId = await dbOperations.findOrCreateGenre(genreFromMb.name);
                if (genreId) {
                  await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
                }
              }
            }
          } else if (releaseInfo && releaseInfo.tags && Array.isArray(releaseInfo.tags) && releaseInfo.tags.length > 0) {
            const musicBrainzTags: { name: string, count: number }[] = releaseInfo.tags;

            for (const tagFromMb of musicBrainzTags) {
              if (tagFromMb.name) {
                const genreId = await dbOperations.findOrCreateGenre(tagFromMb.name);
                if (genreId) {
                  await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
                }
              }
            }
          } else {
          }
        } catch (error: any) {
          console.error(`  [Genre Fetch] Error fetching or processing MusicBrainz genres for ${mbReleaseId}: ${error.message}`);
        }
      } else {
      }
    }
    // --- End: MusicBrainz Genre Fetching ---

    // If we are skipping MusicBrainz details (album is complete), also skip processing/updating this track from local file metadata.
    if (skipMusicBrainzDetailsFetch) {
      // Potentially increment a 'skipped tracks' counter in stats if needed
      return; // Exit processing for this file
    }

    // Create or update track
    if (albumRecord?.albumId) { // Ensure albumId is valid
      const existingTrack = await db
        .select({ trackId: tracks.trackId })
        .from(tracks)
        .where(eq(tracks.filePath, filePath))
        .limit(1);

      if (existingTrack.length > 0) {
        // Update existing track
        await db
          .update(tracks)
          .set({
            title: trackTitle,
            artistId: primaryArtistId, // Use primary artist ID string
            albumId: albumRecord.albumId, // Use album ID string
            genre: common.genre?.join(', ') || null,
            year: common.year,
            trackNumber: common.track?.no || null,
            diskNumber: common.disk?.no || null,
            duration: metadata.format?.duration ? Math.round(metadata.format.duration) : null,
            updatedAt: sql`CURRENT_TIMESTAMP`,
          })
          .where(eq(tracks.filePath, filePath));
        console.log(`  Updated track: ${trackTitle}`);
      } else {
        // Create new track
        await db.insert(tracks).values({
          title: trackTitle,
          artistId: primaryArtistId, // Use primary artist ID string
          albumId: albumRecord.albumId, // Use album ID string
          genre: common.genre?.join(', ') || null,
          year: common.year,
          trackNumber: common.track?.no || null,
          diskNumber: common.disk?.no || null,
          duration: metadata.format?.duration ? Math.round(metadata.format.duration) : null,
          filePath,
        });
        console.log(`  Added track: ${trackTitle}`);
      }
    } else {
      console.warn(`  Skipping track creation for "${trackTitle}" as album could not be processed.`);
    }
  } catch (error: any) {
    console.error(`Error processing file ${filePath}:`, error.message);
    // Increment error count in stats if you implement that
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
