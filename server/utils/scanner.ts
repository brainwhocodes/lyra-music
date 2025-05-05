import fs from 'fs-extra';
import path from 'path';
import * as mm from 'music-metadata';
import crypto from 'crypto'; // Import crypto for hashing
import { db } from '~/server/db';
import { artists, albums, tracks, mediaLibraries } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';

// Define supported audio file extensions
const SUPPORTED_EXTENSIONS = ['.mp3', '.flac', '.ogg', '.m4a', '.aac', '.wav'];
// Define path for storing album covers (relative to public dir)
const COVERS_DIR = path.join(process.cwd(), 'public', 'covers');

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
 * Scans a specific media library directory, extracts metadata, and updates the database.
 * @param libraryId - The ID of the library being scanned.
 * @param libraryPath - The root path of the library directory.
 */
export async function scanLibrary(libraryId: number, libraryPath: string): Promise<void> {
  console.log(`Starting scan for library ID: ${libraryId}, Path: ${libraryPath}`);

  const audioFilePaths = await findAudioFiles(libraryPath);
  console.log(`Found ${audioFilePaths.length} potential audio files.`);

  for (const filePath of audioFilePaths) {
    try {
      console.log(`Processing: ${filePath}`);
      // 1. Extract metadata using music-metadata
      const metadata = await mm.parseFile(filePath, { duration: true });
      console.log('  Metadata:', metadata.common.title, metadata.common.artist, metadata.common.album);

      // 2. Handle Album Art (extract, save, get path)
      let albumArtPath: string | null = null;
      if (metadata.common.picture && metadata.common.picture.length > 0) {
        const picture = metadata.common.picture[0]; // Use the first picture
        try {
          // Ensure covers directory exists
          await fs.ensureDir(COVERS_DIR);
          
          // Generate a unique filename based on image content hash
          const hash = crypto.createHash('sha256').update(picture.data).digest('hex');
          const fileExtension = picture.format.split('/')[1] || 'jpg'; // e.g., 'jpeg' -> 'jpg'
          const coverFilename = `${hash}.${fileExtension}`;
          const coverFullPath = path.join(COVERS_DIR, coverFilename);

          // Save the file only if it doesn't already exist
          if (!await fs.pathExists(coverFullPath)) {
             await fs.writeFile(coverFullPath, picture.data);
             console.log(`  Saved album art to: ${coverFullPath}`);
          }
          
          // Store the relative path for DB/frontend use
          albumArtPath = `/covers/${coverFilename}`;

        } catch (artError: any) {
          console.error(`  Failed to save album art for ${filePath}: ${artError.message}`);
          // Continue without album art if saving fails
        }
      }

      // 3. Find or Create Artist in DB
      let artistId: number | null = null;
      const artistName = metadata.common.artist?.trim(); // Get artist name

      if (artistName) {
        try {
          // Check if artist already exists
          let [existingArtist] = await db.select({ id: artists.id }).from(artists).where(eq(artists.name, artistName)).limit(1);
          
          if (existingArtist) {
            artistId = existingArtist.id;
             console.log(`  Found existing artist: ${artistName} (ID: ${artistId})`);
          } else {
            // Insert new artist if not found
            const [newArtist] = await db.insert(artists).values({ name: artistName }).returning({ id: artists.id });
            if (newArtist) {
               artistId = newArtist.id;
               console.log(`  Created new artist: ${artistName} (ID: ${artistId})`);
            } else {
              console.error(`  Failed to insert artist: ${artistName}`);
              // Decide how to handle - skip track? Use a default? For now, log and continue
            }
          }
        } catch (dbError: any) {
          console.error(`  Database error finding/creating artist ${artistName}: ${dbError.message}`);
          // Continue processing? Skip track?
        }
      } else {
        console.warn(`  Artist name not found in metadata for ${filePath}.`);
        // Decide how to handle tracks without an artist - skip? Use 'Unknown Artist'?
        // For now, artistId will remain null, and we might need to handle this when creating the album/track.
      }

      // 4. Find or Create Album in DB (link to artist, add art path)
      let albumId: number | null = null;
      const albumTitle = metadata.common.album?.trim(); // Get album title

      if (albumTitle) {
        try {
          // Check if album exists (match title AND artistId)
          let [existingAlbum] = await db
            .select({ id: albums.id })
            .from(albums)
            .where(and(
              eq(albums.title, albumTitle),
              // Use eq or isNull based on whether artistId was found
              artistId ? eq(albums.artistId, artistId) : sql`${albums.artistId} IS NULL`
            ))
            .limit(1);

          if (existingAlbum) {
            albumId = existingAlbum.id;
            console.log(`  Found existing album: ${albumTitle} (ID: ${albumId})`);
            // Optionally: Update album art path if a new one was found and the existing one is null?
            // This requires careful consideration (e.g., what if multiple tracks from the same album have different art?)
            // For now, we only set it on creation.
          } else {
            // Insert new album
            const [newAlbum] = await db
              .insert(albums)
              .values({
                title: albumTitle,
                artistId: artistId, // Can be null if artist wasn't found
                year: metadata.common.year,
                artPath: albumArtPath // Can be null if art wasn't found/saved
              })
              .returning({ id: albums.id });
            
            if (newAlbum) {
              albumId = newAlbum.id;
              console.log(`  Created new album: ${albumTitle} (ID: ${albumId})`);
            } else {
              console.error(`  Failed to insert album: ${albumTitle}`);
            }
          }
        } catch (dbError: any) {
           console.error(`  Database error finding/creating album ${albumTitle}: ${dbError.message}`);
        }
      } else {
         console.warn(`  Album title not found in metadata for ${filePath}.`);
         // Decide how to handle tracks without an album - skip? Use 'Unknown Album'?
         // For now, albumId remains null.
      }

      // 5. Find or Create/Update Track in DB
      const trackTitle = metadata.common.title?.trim();
      if (!trackTitle) {
        console.warn(`  Track title not found in metadata for ${filePath}. Skipping track.`);
        continue; // Skip this file if it doesn't have a title
      }

      try {
        // Check if track with this path already exists
        let [existingTrack] = await db
          .select({ id: tracks.id })
          .from(tracks)
          .where(eq(tracks.path, filePath))
          .limit(1);

        const trackData = {
          title: trackTitle,
          albumId: albumId,       // Can be null
          artistId: artistId,     // Can be null
          genre: metadata.common.genre?.[0], // Use first genre if available
          duration: metadata.format.duration ? Math.round(metadata.format.duration) : null,
          trackNumber: metadata.common.track.no,
          path: filePath,
        };

        if (existingTrack) {
          // Update existing track
          await db.update(tracks).set(trackData).where(eq(tracks.id, existingTrack.id));
          console.log(`  Updated track: ${trackTitle} (ID: ${existingTrack.id})`);
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

  console.log(`Finished scan for library ID: ${libraryId}`);
}

// Example of how to potentially trigger a scan (e.g., from an API route)
// async function triggerScanForUserLibrary(userId: number, libraryId: number) {
//   const library = await db.select().from(mediaLibraries).where(and(eq(mediaLibraries.id, libraryId), eq(mediaLibraries.userId, userId))).limit(1);
//   if (library.length > 0) {
//     await scanLibrary(library[0].id, library[0].path);
//   } else {
//     console.error(`Library ${libraryId} not found for user ${userId}`);
//   }
// }
