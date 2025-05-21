import fs from 'fs-extra';
import path from 'path';
import * as mm from 'music-metadata';
import crypto from 'crypto'; // Import crypto for hashing
import { db } from '~/server/db';
import { artists, albums, tracks, mediaFolders } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Define supported audio file extensions
const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wav'];
// Define path for storing album covers (relative to public dir)
const COVERS_DIR = path.join(process.cwd(), 'public', 'images', 'covers');
// Define common cover art filenames to search for in album folders
const EXTERNAL_COVER_FILENAMES = [
  'cover.jpg', 'cover.jpeg', 'cover.png', 'cover.gif', 'cover.webp',
  'folder.jpg', 'folder.jpeg', 'folder.png', 'folder.gif', 'folder.webp',
  'album.jpg', 'album.jpeg', 'album.png', 'album.gif', 'album.webp',
  'front.jpg', 'front.jpeg', 'front.png', 'front.gif', 'front.webp',
];

/**
 * Checks if a file extension is supported for metadata scanning.
 * @param filePath - The path to the file.
 * @returns True if the file extension is supported, false otherwise.
 */
function isSupportedAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return SUPPORTED_EXTENSIONS.includes(ext);
}

/**
 * Recursively scans a directory for supported audio files.
 * @param dirPath - The directory path to scan.
 * @returns An array of paths to supported audio files found.
 */
async function findAudioFiles(dirPath: string): Promise<string[]> {
  let audioFiles: string[] = [];
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        audioFiles = audioFiles.concat(await findAudioFiles(fullPath));
      } else if (entry.isFile() && isSupportedAudioFile(fullPath)) {
        audioFiles.push(fullPath);
      }
    }
  } catch (error: any) {
    console.error(`Error reading directory ${dirPath}: ${error.message}`);
    // Decide if we should stop the scan or just skip this directory
    // For now, we log and continue
  }
  return audioFiles;
}

/**
 * Ensures the covers directory exists.
 */
async function ensureCoversDirectory(): Promise<void> {
  await fs.ensureDir(COVERS_DIR);
}

/**
 * Saves image data to the covers cache directory with a hash-based filename.
 * @param imageData The image data buffer.
 * @param imageFormat The format of the image (e.g., 'image/jpeg' or 'jpeg').
 * @param sourceDescription A description of where the art came from (for logging).
 * @returns The web-relative path to the saved art (e.g., /images/covers/hash.ext), or null if saving failed.
 */
async function saveArtToCacheAndGetPath(
  imageData: Buffer,
  imageFormat: string,
  sourceDescription: string,
): Promise<string | null> {
  try {
    await ensureCoversDirectory();
    const hash = crypto.createHash('sha256').update(imageData).digest('hex');
    const extension = (imageFormat.split('/')[1] || imageFormat).toLowerCase().replace('jpeg', 'jpg');
    const coverFilename = `${hash}.${extension}`;
    const coverFullPath = path.join(COVERS_DIR, coverFilename);

    if (!await fs.pathExists(coverFullPath)) {
      await fs.writeFile(coverFullPath, imageData);
      console.log(`  Saved album art from ${sourceDescription} to: ${coverFullPath}`);
    }
    return `/images/covers/${coverFilename}`;
  } catch (error: any) {
    console.error(`  Failed to save album art from ${sourceDescription}: ${error.message}`);
    return null;
  }
}

/**
 * Scans a specific media library directory, extracts metadata, and updates the database.
 * @param libraryId - The ID of the library being scanned.
 * @param libraryPath - The root path of the library directory.
 */
export async function scanLibrary(libraryId: number, libraryPath: string): Promise<void> {
  console.log(`Starting scan for library ID: ${libraryId}, Path: ${libraryPath}`);
  let audioFilePaths: string[] = [];
  const albumsProcessedForExternalArtThisScan = new Set<string>(); // Use albumId or a unique album key (title+artist)

  try {
    audioFilePaths = await findAudioFiles(libraryPath);
    if (audioFilePaths.length === 0) {
      console.log(`No audio files found in library ID: ${libraryId}, Path: ${libraryPath}`);
    } else {
      console.log(`Found ${audioFilePaths.length} audio files in library ID: ${libraryId}. Starting metadata processing...`);
    }

    for (const filePath of audioFilePaths) {
      try {
        console.log(`Processing: ${filePath}`);
        const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
        console.log('  Metadata:', metadata.common.title, metadata.common.artist, metadata.common.album);

        const trackArtistName = metadata.common.artist?.trim();
        const trackAlbumTitle = metadata.common.album?.trim();
        const trackTitle = metadata.common.title?.trim();

        if (!trackTitle) {
          console.warn(`  Track title not found for ${filePath}. Skipping.`);
          continue;
        }

        let finalAlbumArtPath: string | null = null;
        const currentAlbumDirectory = path.dirname(filePath);

        // 1. Find or Create Artist
        let artistId: number | null = null;
        if (trackArtistName) {
          try {
            // Check if artist already exists
            let [existingArtist] = await db.select({ id: artists.id }).from(artists).where(eq(artists.name, trackArtistName)).limit(1);
            
            if (existingArtist) {
              artistId = existingArtist.id;
               console.log(`  Found existing artist: ${trackArtistName} (ID: ${artistId})`);
            } else {
              // Insert new artist if not found
              const [newArtist] = await db.insert(artists).values({ name: trackArtistName }).returning({ id: artists.id });
              if (newArtist) {
                 artistId = newArtist.id;
                 console.log(`  Created new artist: ${trackArtistName} (ID: ${artistId})`);
              } else {
                console.error(`  Failed to insert artist: ${trackArtistName}`);
                // Decide how to handle - skip track? Use a default? For now, log and continue
              }
            }
          } catch (dbError: any) {
            console.error(`  Database error finding/creating artist ${trackArtistName}: ${dbError.message}`);
            // Continue processing? Skip track?
          }
        } else {
          console.warn(`  Artist name not found in metadata for ${filePath}.`);
          // Decide how to handle tracks without an artist - skip? Use 'Unknown Artist'?
          // For now, artistId will remain null, and we might need to handle this when creating the album/track.
        }

        // 2. Album Identification (needed for external art search key)
        // An album is uniquely identified by its title and artistId for the purpose of the external art search set.
        const albumScanKey = trackAlbumTitle && artistId ? `${trackAlbumTitle}_${artistId}` : trackAlbumTitle ? `${trackAlbumTitle}_nullArtist` : null;

        // 3. External Cover Art Search (once per album per scan)
        if (albumScanKey && !albumsProcessedForExternalArtThisScan.has(albumScanKey)) {
          console.log(`  Searching for external cover art in ${currentAlbumDirectory} for album: ${trackAlbumTitle}`);
          for (const coverFilename of EXTERNAL_COVER_FILENAMES) {
            const potentialCoverPath = path.join(currentAlbumDirectory, coverFilename);
            if (await fs.pathExists(potentialCoverPath)) {
              try {
                const coverData = await fs.readFile(potentialCoverPath);
                const format = path.extname(potentialCoverPath).substring(1);
                finalAlbumArtPath = await saveArtToCacheAndGetPath(coverData, format, `external file ${coverFilename}`);
                if (finalAlbumArtPath) {
                  console.log(`    Found and processed external cover: ${coverFilename}`);
                  break; // Found one, use it
                }
              } catch (e: any) {
                console.error(`    Error processing external cover ${potentialCoverPath}:`, e.message);
              }
            }
          }
          albumsProcessedForExternalArtThisScan.add(albumScanKey);
        }

        // 4. Embedded Cover Art (if no external art was found or prioritized)
        if (!finalAlbumArtPath && metadata.common.picture && metadata.common.picture.length > 0) {
          const picture = metadata.common.picture[0];
          console.log(`  Found embedded cover art (Format: ${picture.format}).`);
          // Convert Uint8Array to Buffer before passing to saveArtToCacheAndGetPath
          const pictureBuffer = Buffer.from(picture.data);
          finalAlbumArtPath = await saveArtToCacheAndGetPath(pictureBuffer, picture.format, 'embedded metadata');
        }

        // 5. Find or Create Album & Update Art
        let albumId: number | null = null;
        if (trackAlbumTitle) {
          try {
            // Check if album exists (match title AND artistId)
            let [existingAlbum] = await db
              .select({ id: albums.id, artPath: albums.artPath })
              .from(albums)
              .where(and(
                eq(albums.title, trackAlbumTitle),
                // Use eq or isNull based on whether artistId was found
                artistId ? eq(albums.artistId, artistId) : sql`${albums.artistId} IS NULL`
              ))
              .limit(1);

            if (existingAlbum) {
              albumId = existingAlbum.id;
              console.log(`  Found existing album: ${trackAlbumTitle} (ID: ${albumId})`);
              if (finalAlbumArtPath) { // New art was found (external or embedded)
                if (existingAlbum.artPath !== finalAlbumArtPath) {
                  console.log(`  Updating artPath for existing album ${albumId} from "${existingAlbum.artPath}" to "${finalAlbumArtPath}"`);
                  await db.update(albums).set({ artPath: finalAlbumArtPath }).where(eq(albums.id, albumId));
                }
              } else { // No new art found for this track/album folder check
                if (existingAlbum.artPath) { // DB has an art path, let's check if its file exists
                  const existingArtFileOnDisk = path.join(COVERS_DIR, path.basename(existingAlbum.artPath));
                  if (!await fs.pathExists(existingArtFileOnDisk)) {
                    console.warn(`  Album ${albumId} (${trackAlbumTitle}) has artPath "${existingAlbum.artPath}" in DB, but file not found. Clearing artPath.`);
                    await db.update(albums).set({ artPath: null }).where(eq(albums.id, albumId));
                  }
                }
              }
            } else { // Create new album
              const [newAlbum] = await db.insert(albums).values({
                title: trackAlbumTitle,
                artistId: artistId,
                year: metadata.common.year,
                artPath: finalAlbumArtPath // This will be the new art, or null
              }).returning({ id: albums.id });
              if (newAlbum) {
                albumId = newAlbum.id;
                console.log(`  Created new album: ${trackAlbumTitle} (ID: ${albumId}) with artPath: ${finalAlbumArtPath}`);
              }
            }
          } catch (dbError: any) {
            console.error(`  Database error finding/creating album ${trackAlbumTitle}: ${dbError.message}`);
          }
        } else {
          console.warn(`  Album title not found in metadata for ${filePath}. Track will not be associated with an album.`);
        }

        // 6. Find or Create/Update Track
        try {
          // Check if track with this path already exists
          let [existingTrack] = await db
            .select({ id: tracks.id })
            .from(tracks)
            .where(eq(tracks.filePath, filePath)) // Use tracks.filePath
            .limit(1);

          const trackData = {
            title: trackTitle!,
            albumId: albumId,
            artistId: artistId,
            genre: metadata.common.genre?.[0],
            duration: metadata.format.duration ? Math.round(metadata.format.duration) : null,
            trackNumber: metadata.common.track.no,
            filePath: filePath,
            libraryId: libraryId,
          };

          if (existingTrack) {
            // Check if the file exists in the original location before updating
            const fileExists = await fs.pathExists(filePath);
            if (fileExists) {
              console.log(`  Track exists and file still in original location: ${trackTitle} (ID: ${existingTrack.id}) - skipping update`);
            } else {
              // Update existing track since the file has moved or changed
              await db.update(tracks).set(trackData).where(eq(tracks.id, existingTrack.id));
              console.log(`  Updated track: ${trackTitle} (ID: ${existingTrack.id}) - file location changed`);
            }
          } else {
            // Insert new track
            const [newTrack] = await db.insert(tracks).values(trackData).returning({ id: tracks.id });
            if (newTrack) {
              console.log(`  Created new track: ${trackTitle} (ID: ${newTrack.id})`);
            } else {
              console.error(`  Failed to insert track: ${trackTitle}`);
            }
          }
        } catch (dbError: any) {
          console.error(`  Database error finding/creating/updating track ${trackTitle} (${filePath}): ${dbError.message}`);
        }

      } catch (error: any) {
        console.error(`Failed to process file ${filePath}: ${error.message}`);
        // Removed specific ParseError check as it might not be exported directly
        // Continue to the next file
      }
    }

    console.log(`Finished processing all ${audioFilePaths.length} audio files for library ID: ${libraryId}.`);
  } catch (error: any) {
    console.error(`Error scanning library ID ${libraryId}: ${error.message}`);
  } finally {
    console.log(`Finished scan for library ID: ${libraryId}`);
    // Prune orphaned art paths as a final step
    await pruneOrphanedAlbumArtPaths();
  }
}

/**
 * Scans the public/images/covers directory and updates the database by setting artPath to null
 * for albums whose cover art files are missing from disk.
 */
export async function pruneOrphanedAlbumArtPaths(): Promise<void> {
  console.log('Starting scan to prune orphaned album art paths...');

  try {
    // 1. Ensure the COVERS_DIR exists, though it might be empty
    await fs.ensureDir(COVERS_DIR);
    const filesOnDisk = await fs.readdir(COVERS_DIR);
    const existingCoverFilesOnDisk = new Set(filesOnDisk); // Set of filenames like 'hash.jpg'
    console.log(`Found ${existingCoverFilesOnDisk.size} files in ${COVERS_DIR}.`);

    // 2. Fetch all albums from DB that have a non-null artPath
    const albumsWithArt = await db
      .select({
        id: albums.id,
        title: albums.title,
        artPath: albums.artPath,
      })
      .from(albums)
      .where(sql`${albums.artPath} IS NOT NULL AND ${albums.artPath} != ''`); // Ensure artPath is not null or empty

    if (albumsWithArt.length === 0) {
      console.log('No albums in the database have an artPath set. Nothing to prune.');
      return;
    }

    console.log(`Checking ${albumsWithArt.length} albums with artPaths in the database.`);
    let prunedCount = 0;

    // 3. Iterate and check
    for (const album of albumsWithArt) {
      if (!album.artPath) { // Should not happen due to DB query, but good practice
        continue;
      }
      // album.artPath is like '/images/covers/hash.jpg'. We need 'hash.jpg'.
      const expectedFilename = path.basename(album.artPath);

      if (!existingCoverFilesOnDisk.has(expectedFilename)) {
        // Orphaned path found
        console.warn(`  Orphaned artPath: Album ID ${album.id} ("${album.title}") has artPath "${album.artPath}", but file "${expectedFilename}" not found in ${COVERS_DIR}. Setting artPath to null.`);
        try {
          await db
            .update(albums)
            .set({ artPath: null })
            .where(eq(albums.id, album.id));
          prunedCount++;
        } catch (dbError: any) {
          console.error(`  Failed to update artPath for album ID ${album.id}: ${dbError.message}`);
        }
      }
    }

    if (prunedCount > 0) {
      console.log(`Successfully pruned ${prunedCount} orphaned album art paths.`);
    } else {
      console.log('No orphaned album art paths found to prune.');
    }

  } catch (error: any) {
    console.error(`Error during pruning of orphaned album art paths: ${error.message}`);
  }
  console.log('Finished pruning orphaned album art paths.');
}

// Example of how to potentially trigger a scan (e.g., from an API route)
// async function triggerScanForUserLibrary(userId: number, libraryId: number) {
//   const library = await db.select().from(mediaFolders).where(and(eq(mediaFolders.id, libraryId), eq(mediaFolders.userId, userId))).limit(1);
//   if (library.length > 0) {
//     await scanLibrary(library[0].id, library[0].path);
//   } else {
//     console.error(`Library ${libraryId} not found for user ${userId}`);
//   }
// }
