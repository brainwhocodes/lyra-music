import fs from 'fs-extra';
import path from 'path';
import * as mm from 'music-metadata';
import crypto from 'crypto'; // Import crypto for hashing
import { db } from '~/server/db';
import { artists, albums, tracks, userArtists } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
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
 * @param userId - The ID of the user who owns this library.
 */
export async function scanLibrary(libraryId: string, libraryPath: string, userId: string): Promise<void> {
  console.log(`Starting scan for library ID: ${libraryId}, Path: ${libraryPath}, User ID: ${userId}`);
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

        // 1. Find or Create Artist (Global) & Link to User
        let artistId: string | null = null;
        if (trackArtistName) {
          try {
            // Check if artist already exists globally
            let [existingArtist] = await db.select({ artistId: artists.artistId }).from(artists).where(eq(artists.name, trackArtistName)).limit(1);
            
            if (existingArtist) {
              artistId = existingArtist.artistId;
               console.log(`  Found existing global artist: ${trackArtistName} (ID: ${artistId})`);
            } else {
              // Insert new global artist if not found
              const [newArtistEntry] = await db.insert(artists).values({ name: trackArtistName, artistId: uuidv7() }).returning({ artistId: artists.artistId });
              if (newArtistEntry) {
                 artistId = newArtistEntry.artistId;
                 console.log(`  Created new global artist: ${trackArtistName} (ID: ${artistId})`);
              } else {
                console.error(`  Failed to insert global artist: ${trackArtistName}`);
                // Decide how to handle - skip track? Use a default? For now, log and continue
              }
            }

            // Ensure user-artist link exists
            if (artistId && userId) {
              const [existingUserArtistLink] = await db.select()
                .from(userArtists)
                .where(and(eq(userArtists.userId, userId), eq(userArtists.artistId, artistId)))
                .limit(1);

              if (!existingUserArtistLink) {
                await db.insert(userArtists).values({
                  userId: userId,
                  artistId: artistId,
                  userArtistId: uuidv7() // Or let DB handle if it's auto-increment/default
                });
                console.log(`  Linked user ${userId} to artist ${artistId} (${trackArtistName})`);
              } else {
                console.log(`  User ${userId} already linked to artist ${artistId} (${trackArtistName})`);
              }
            }

          } catch (dbError: any) {
            console.error(`  Database error finding/creating artist ${trackArtistName} or user-artist link: ${dbError.message}`);
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
        let albumId: string | null = null;
        if (trackAlbumTitle) {
          try {
            // Check if album exists (match title AND artistId AND userId)
            let [existingAlbum] = await db
              .select({ albumId: albums.albumId, coverPath: albums.coverPath })
              .from(albums)
              .where(and(
                eq(albums.title, trackAlbumTitle),
                artistId ? eq(albums.artistId, artistId) : sql`${albums.artistId} IS NULL`,
                eq(albums.userId, userId) // Added userId to condition
              ))
              .limit(1);

            if (existingAlbum) {
              albumId = existingAlbum.albumId;
              console.log(`  Found existing album: ${trackAlbumTitle} (ID: ${albumId}) for user ${userId}`);
              if (finalAlbumArtPath && finalAlbumArtPath !== existingAlbum.coverPath) {
                console.log(`  Updating album art for ${trackAlbumTitle} to ${finalAlbumArtPath}`);
                await db.update(albums).set({ coverPath: finalAlbumArtPath, updatedAt: sql`CURRENT_TIMESTAMP` }).where(eq(albums.albumId, albumId));
              }
            } else {
              // Insert new album if not found
              const [newAlbum] = await db.insert(albums).values({
                title: trackAlbumTitle,
                artistId: artistId, // This can be null if artist was not found/created
                userId: userId, // Added userId
                year: metadata.common.year,
                coverPath: finalAlbumArtPath,
                albumId: uuidv7()
              }).returning({ albumId: albums.albumId });

              if (newAlbum) {
                albumId = newAlbum.albumId;
                console.log(`  Created new album: ${trackAlbumTitle} (ID: ${albumId}) for user ${userId}`);
              } else {
                console.error(`  Failed to insert album: ${trackAlbumTitle} for user ${userId}`);
              }
            }
          } catch (dbError: any) {
            console.error(`  Database error finding/creating album ${trackAlbumTitle} for user ${userId}: ${dbError.message}`);
          }
        } else {
          console.warn(`  Album title not found in metadata for ${filePath}. Track will not be associated with an album.`);
        }

        // 6. Find or Create Track
        try {
          // Check if track with this path already exists
          let [existingTrack] = await db
            .select({ trackId: tracks.trackId })
            .from(tracks)
            .where(eq(tracks.filePath, filePath)) // Use tracks.filePath
            .limit(1);

          const trackData = {
            trackId: uuidv7(),
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
              console.log(`  Track exists and file still in original location: ${trackTitle} (ID: ${existingTrack.trackId}) - skipping update`);
            } else {
              // Update existing track since the file has moved or changed
              await db.update(tracks).set(trackData).where(eq(tracks.trackId, existingTrack.trackId));
              console.log(`  Updated track: ${trackTitle} (ID: ${existingTrack.trackId}) - file location changed`);
            }
          } else {
            // Insert new track
            const [newTrack] = await db.insert(tracks).values(trackData).returning({ trackId: tracks.trackId });
            if (newTrack) {
              console.log(`  Created new track: ${trackTitle} (ID: ${newTrack.trackId})`);
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
        albumId: albums.albumId,
        title: albums.title,
        coverPath: albums.coverPath,
      })
      .from(albums)
      .where(sql`${albums.coverPath} IS NOT NULL AND ${albums.coverPath} != ''`); // Ensure artPath is not null or empty

    if (albumsWithArt.length === 0) {
      console.log('No albums in the database have an artPath set. Nothing to prune.');
      return;
    }

    console.log(`Checking ${albumsWithArt.length} albums with artPaths in the database.`);
    let prunedCount = 0;

    // 3. Iterate and check
    for (const album of albumsWithArt) {
      if (!album.coverPath) { // Should not happen due to DB query, but good practice
        continue;
      }
      // album.coverPath is like '/images/covers/hash.jpg'. We need 'hash.jpg'.
      const expectedFilename = path.basename(album.coverPath);

      if (!existingCoverFilesOnDisk.has(expectedFilename)) {
        // Orphaned path found
        console.warn(`  Orphaned artPath: Album ID ${album.albumId} ("${album.title}") has artPath "${album.coverPath}", but file "${expectedFilename}" not found in ${COVERS_DIR}. Setting artPath to null.`);
        try {
          await db
            .update(albums)
            .set({ coverPath: null })
            .where(eq(albums.albumId, album.albumId));
          prunedCount++;
        } catch (dbError: any) {
          console.error(`  Failed to update artPath for album ID ${album.albumId}: ${dbError.message}`);
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
