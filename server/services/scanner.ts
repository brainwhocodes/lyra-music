// server/services/scanner.ts
import path from 'node:path';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto'; // Import crypto for hashing
import * as mm from 'music-metadata'; // Already installed dependency
import { db } from '~/server/db';
import { artists, albums, tracks, NewTrack, NewAlbum } from '~/server/db/schema';
import { eq, sql, and } from 'drizzle-orm';

// Supported audio file extensions
const SUPPORTED_EXTENSIONS: ReadonlySet<string> = new Set(['.mp3', '.flac', '.m4a', '.ogg', '.wav', '.aac']); // Add more as needed

// Define the directory to save covers relative to the project root
const COVERS_DIR_RELATIVE = path.join('public', 'images', 'covers');
const COVERS_DIR_ABSOLUTE = path.join(process.cwd(), COVERS_DIR_RELATIVE);

// --- New: Config for external cover art search ---
const EXTERNAL_COVER_FILENAMES: ReadonlyArray<string> = ['cover', 'folder', 'album', 'front', 'albumart'];
const EXTERNAL_COVER_EXTENSIONS: ReadonlyArray<string> = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
// --- End New ---

// Ensure the covers directory exists
const ensureCoversDirectory = async () => {
    try {
        await fs.mkdir(COVERS_DIR_ABSOLUTE, { recursive: true });
    } catch (error: any) {
        console.error(`Failed to create covers directory at ${COVERS_DIR_ABSOLUTE}:`, error);
        // Decide if this is a fatal error for the scan
    }
};

// Call this once when the service loads or before the first scan
ensureCoversDirectory();

// --- New Helper: Function to process and save cover art data ---
const processAndSaveCoverArt = async (
    imageData: Buffer | Uint8Array, // Accept both Buffer and Uint8Array
    imageFormat: string, // e.g., 'image/jpeg' or just 'jpeg'
    sourceDescription: string // e.g., 'embedded' or 'external file path'
): Promise<string | undefined> => {
    try {
        // Ensure we have a Buffer for hashing and writing
        const imageBuffer = Buffer.isBuffer(imageData) ? imageData : Buffer.from(imageData);

        const hash = createHash('sha256').update(imageBuffer).digest('hex');
        // Normalize format to just the extension
        const extension = (imageFormat.split('/')[1]?.split(';')[0] || 'jpg').toLowerCase();
        // Validate extension is in our allowed list? Optional, but good practice.
        const filename = `${hash}.${extension}`;
        const fullSavePath = path.join(COVERS_DIR_ABSOLUTE, filename);
        const relativePath = `/${COVERS_DIR_RELATIVE.replace(/\\/g, '/')}/${filename}`;

        try {
            await fs.access(fullSavePath);
             // console.log(`Cover art (${sourceDescription}) already exists: ${relativePath}`);
        } catch (accessError) {
            await fs.writeFile(fullSavePath, imageBuffer); // Use the buffer
            console.log(`Saved cover art (${sourceDescription}) to: ${relativePath}`);
        }
        return relativePath;
    } catch (artError: any) {
        console.error(`Error processing cover art (${sourceDescription}):`, artError.message);
        return undefined;
    }
};
// --- End New Helper ---


// Interface for album data derived from the first track
interface AlbumInfo {
    title: string;
    year: number | null;
    albumArtistId: number;
}

// Interface for track data before album assignment
interface PendingTrackData {
    title: string;
    artistId: number; // Track artist ID
    genre?: string;
    year?: number;
    trackNumber?: number; // Expect undefined for optional
    diskNumber?: number; // Expect undefined for optional
    duration?: number;
    filePath: string;
    path: string; // Duplicate path to satisfy NOT NULL constraint
}


/**
 * Processes a single folder assumed to contain tracks for one album.
 *
 * @param folderPath - The absolute path to the album folder.
 * @returns Promise<{ scanned: number; added: number; errors: number }> - Counts for this folder.
 */
const processAlbumFolder = async (folderPath: string): Promise<{ scanned: number; added: number; errors: number }> => {
    console.log(`Processing album folder: ${folderPath}`);
    let scanned = 0;
    let added = 0;
    let errors = 0;

    let albumData: AlbumInfo | null = null;
    let albumId: number | null = null;
    const trackInsertList: PendingTrackData[] = [];

    try {
        // 1. Find audio files directly within this folder
        console.log(`[Scanner Debug] Reading directory: ${folderPath}`); // <<< ADDED LOG
        const folderItems = await fs.readdir(folderPath, { withFileTypes: true });
        const audioFilesInFolder: string[] = [];
        for (const item of folderItems) {
            if (item.isFile()) {
                const ext = path.extname(item.name).toLowerCase();
                if (SUPPORTED_EXTENSIONS.has(ext)) {
                    audioFilesInFolder.push(path.join(folderPath, item.name));
                }
            }
        }

        if (audioFilesInFolder.length === 0) {
            console.log(`No audio files found in: ${folderPath}. Skipping.`);
            return { scanned: 0, added: 0, errors: 0 };
        }
        console.log(`Found ${audioFilesInFolder.length} audio files in ${folderPath}.`);

        // 2. Loop through audio files to gather track data and determine album info
        for (const filePath of audioFilesInFolder) {
            scanned++;
            try {
                console.log(`[Scanner Debug] Parsing metadata for: ${filePath}`); // <<< ADDED LOG
                const metadata = await mm.parseFile(filePath, { duration: true });
                const { common, format } = metadata;

                if (!common.title || !common.artist) {
                    console.warn(`Skipping track ${filePath}: Missing essential tags (title or artist).`);
                    errors++;
                    continue;
                }

                // --- Track Artist Handling ---
                const trackArtistName = common.artist;
                let [trackArtist] = await db.select().from(artists).where(eq(artists.name, trackArtistName)).limit(1);
                if (!trackArtist) {
                    [trackArtist] = await db.insert(artists).values({ name: trackArtistName }).returning();
                }

                // --- Album Info Determination (First Track Wins) ---
                if (!albumData) {
                    const albumTitle = common.album || path.basename(folderPath); // Fallback to folder name
                    const albumArtistName = common.albumartist || trackArtistName;
                    let albumArtist = trackArtist; // Assume same unless specified otherwise
                    if (albumArtistName !== trackArtistName) {
                        [albumArtist] = await db.select().from(artists).where(eq(artists.name, albumArtistName)).limit(1);
                        if (!albumArtist) {
                            [albumArtist] = await db.insert(artists).values({ name: albumArtistName }).returning();
                        }
                    }
                    albumData = {
                        title: albumTitle,
                        year: common.year ?? null,
                        albumArtistId: albumArtist.id
                    };
                }

                // --- Prepare Track Data ---
                const track: PendingTrackData = {
                    title: common.title,
                    artistId: trackArtist.id, // Track artist ID
                    genre: common.genre?.[0],
                    year: (common.year ?? albumData?.year) || undefined, // Fallback to album year
                    trackNumber: (common.track.no === null || common.track.no === undefined) ? undefined : common.track.no,
                    diskNumber: (common.disk.no === null || common.disk.no === undefined) ? undefined : common.disk.no,
                    duration: format.duration ? Math.round(format.duration) : undefined,
                    filePath: filePath,
                    path: filePath, // Use filePath value for 'path' column
                };
                trackInsertList.push(track);

            } catch (metaError: any) {
                console.error(`Metadata error for ${filePath}: ${metaError.message}`);
                errors++;
            }
        } // End loop through audio files

        // 3. If no valid tracks or album data, exit
        if (trackInsertList.length === 0 || !albumData) {
            console.log(`No processable tracks found or album data determined for folder: ${folderPath}`);
            return { scanned, added, errors };
        }

        // 4. Find or Create Album
        try {
            let [album] = await db.select().from(albums)
                .where(and(
                    eq(albums.title, albumData.title),
                    eq(albums.artistId, albumData.albumArtistId)
                ))
                .limit(1);

            if (!album) {
                console.log(`Creating new album: "${albumData.title}" by Artist ID ${albumData.albumArtistId}`);
                const newAlbum: NewAlbum = {
                    title: albumData.title,
                    artistId: albumData.albumArtistId,
                    year: albumData.year,
                    artPath: null, // Initially null, will be updated later if cover found
                };
                [album] = await db.insert(albums).values(newAlbum).returning();
            } else {
                 console.log(`Found existing album: "${album.title}" (ID: ${album.id})`);
            }
            albumId = album.id;

        } catch (dbError: any) {
             console.error(`Database error finding/creating album for ${folderPath}: ${dbError.message}`);
             errors++;
             return { scanned, added, errors }; // Cannot proceed without album
        }


        // 5. Assign Album ID and Insert Tracks
        if (albumId) {
            const finalTrackData: NewTrack[] = trackInsertList.map(t => ({
                ...t,
                albumId: albumId!, // Assign the found/created album ID
            }));

            // Check for existing tracks before inserting
            const existingPaths = new Set(
                (await db.select({ filePath: tracks.filePath }).from(tracks).where(
                    sql`${tracks.filePath} IN ${finalTrackData.map(t => t.filePath)}`
                )).map(row => row.filePath)
            );

            const tracksToInsert = finalTrackData.filter(t => !existingPaths.has(t.filePath));

            if (tracksToInsert.length > 0) {
                try {
                    console.log(`Inserting ${tracksToInsert.length} new tracks for album ID ${albumId}...`);
                    // Map the PendingTrackData to the NewTrack structure expected by Drizzle
                    const insertData: NewTrack[] = tracksToInsert.map(t => ({
                        title: t.title,
                        artistId: t.artistId,
                        albumId: albumId, // Use the determined albumId
                        genre: t.genre,
                        year: t.year,
                        trackNumber: t.trackNumber,
                        diskNumber: t.diskNumber,
                        duration: t.duration,
                        filePath: t.filePath,
                        path: t.path, // Ensure 'path' field is included here
                        // createdAt is handled by DB default
                    }));

                    await db.insert(tracks).values(insertData);
                    added += tracksToInsert.length;
                    console.log(`Successfully added ${tracksToInsert.length} tracks for album ID ${albumId}.`);
                } catch (dbError: any) {
                    console.error(`Database error inserting tracks for album ID ${albumId}: ${dbError.message}`);
                    errors++; // Count insert error
                }
            } else {
                 console.log(`No new tracks to add for album ID ${albumId} (all already exist).`);
            }
        }


        // 6. Folder-Level Cover Art Search (Only if album was processed successfully)
        if (albumId) {
             // Check if album already has art (maybe from a previous scan run)
             const [currentAlbumState] = await db.select({ artPath: albums.artPath }).from(albums).where(eq(albums.id, albumId));

             if (currentAlbumState?.artPath === null) { // Only search if art is currently missing
                let foundCover = false;
                for (const baseFilename of EXTERNAL_COVER_FILENAMES) {
                    if (foundCover) break;
                    for (const ext of EXTERNAL_COVER_EXTENSIONS) {
                        const potentialCoverPath = path.join(folderPath, `${baseFilename}${ext}`);
                        try {
                            await fs.access(potentialCoverPath); // Check exists
                            console.log(`Found potential cover art for album ID ${albumId}: ${potentialCoverPath}`);
                            const coverData = await fs.readFile(potentialCoverPath);
                            const formatFromExt = `image/${ext.substring(1)}`;
                            const relativePath = await processAndSaveCoverArt(coverData, formatFromExt, potentialCoverPath);

                            if (relativePath) {
                                await db.update(albums)
                                    .set({ artPath: relativePath })
                                    .where(eq(albums.id, albumId));
                                console.log(`Updated album ID ${albumId} with cover art: ${relativePath}`);
                                foundCover = true;
                                break; // Exit inner loop
                            }
                        } catch (err: any) {
                            if (err.code !== 'ENOENT') {
                                console.error(`Error accessing/reading cover file ${potentialCoverPath}:`, err.message);
                                errors++;
                            }
                        }
                    } // end ext loop
                } // end filename loop
                 if (!foundCover) {
                     console.log(`No external cover art found for album ID ${albumId} in ${folderPath}. Checking for embedded art...`);
                     // --- Task 3: Check for Embedded Cover Art ---
                     if (currentAlbumState?.artPath === null && trackInsertList.length > 0) {
                         const firstTrackPath = trackInsertList[0].filePath;
                         try {
                             // Re-parse the first track, ensuring covers are NOT skipped
                             const firstTrackMetadata = await mm.parseFile(firstTrackPath, { skipCovers: false });
                             if (firstTrackMetadata.common.picture && firstTrackMetadata.common.picture.length > 0) {
                                 const embeddedPicture = firstTrackMetadata.common.picture[0];
                                 console.log(`Found embedded cover art in ${path.basename(firstTrackPath)} (Format: ${embeddedPicture.format}).`);
                                 const relativePath = await processAndSaveCoverArt(embeddedPicture.data, embeddedPicture.format, firstTrackPath); // Use track path as identifier source

                                 if (relativePath) {
                                     await db.update(albums)
                                         .set({ artPath: relativePath })
                                         .where(eq(albums.id, albumId));
                                     console.log(`Updated album ID ${albumId} with embedded cover art from track: ${relativePath}`);
                                     // foundCover = true; // Optional: update flag if needed elsewhere
                                 } else {
                                      console.log(`Failed to process/save embedded cover art for album ID ${albumId}.`);
                                 }
                             } else {
                                 console.log(`No embedded cover art found in the first track (${path.basename(firstTrackPath)}) for album ID ${albumId}.`);
                             }
                         } catch (embedError: any) {
                             console.error(`Error checking/processing embedded cover art from ${firstTrackPath}:`, embedError.message);
                             errors++; // Increment errors if checking embedded art fails
                         }
                     }
                     // --- End Task 3 ---
                 }
             } else {
                 console.log(`Album ID ${albumId} already has cover art: ${currentAlbumState?.artPath}. Skipping external search.`);
             }
        } // End cover art search block

    } catch (folderError: any) {
        console.error(`Unexpected error processing folder ${folderPath}:`, folderError.message);
        errors++;
    }

    console.log(`Finished processing folder ${folderPath}: Scanned ${scanned}, Added ${added}, Errors ${errors}`);
    return { scanned, added, errors };
};
// --- End processAlbumFolder ---


/**
 * Scans the top-level media directory for subdirectories (assumed to be albums)
 * and processes each one.
 *
 * @param directoryPath - The absolute path to the top-level media directory.
 */
export const scanDirectory = async (directoryPath: string): Promise<{ scanned: number; added: number; errors: number }> => {
    console.log(`Starting scan for directory: ${directoryPath}`);
    let totalScanned = 0;
    let totalAdded = 0;
    let totalErrors = 0;

    try {
        // 1. Read the contents of the top-level directory
        const dirents = await fs.readdir(directoryPath, { withFileTypes: true });
        console.log(`Found ${dirents.length} items in ${directoryPath}. Looking for directories...`);

        // 2. Iterate through items and process only directories
        for (const dirent of dirents) {
            if (dirent.isDirectory()) {
                const subDirectoryPath = path.join(directoryPath, dirent.name);
                try {
                    // Process this subdirectory (assumed album folder)
                    const result = await processAlbumFolder(subDirectoryPath);
                    totalScanned += result.scanned;
                    totalAdded += result.added;
                    totalErrors += result.errors;
                } catch (folderError: any) {
                    console.error(`Error processing folder ${subDirectoryPath}:`, folderError.message);
                    totalErrors++; // Increment error count for the folder processing itself
                }
            } else if (dirent.isFile()) {
                 // Optional: Decide how to handle files directly in the root
                 const fileExtension = path.extname(dirent.name).toLowerCase();
                 if (SUPPORTED_EXTENSIONS.has(fileExtension)) {
                    console.warn(`Skipping audio file found directly in root: ${dirent.name}. Please organize into album folders.`);
                    // Or implement logic to handle them as single-track albums
                 }
            }
        }

    } catch (scanError: any) {
        console.error(`Error reading top-level directory ${directoryPath}:`, scanError);
        // Depending on the error, might want to return immediately
        // For now, we'll just log and return the counts accumulated so far (likely zero)
        // Re-throw or handle specific errors like EACCES or ENOENT if needed
        totalErrors++; // Count this as a major error
    }

    console.log(`Scan finished for ${directoryPath}: ${totalScanned} files processed across all folders, ${totalAdded} new tracks added, ${totalErrors} errors encountered.`);
    return { scanned: totalScanned, added: totalAdded, errors: totalErrors };
};
