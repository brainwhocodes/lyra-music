// server/api/settings/scan/index.post.ts
import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { scanLibrary } from '~/server/utils/scanner';
import { batchMap } from '~/utils/concurrency';
import { desc, eq, and } from 'drizzle-orm'; 
import { getUserFromEvent } from '~/server/utils/auth'; 

export default defineEventHandler(async (event) => {
  console.log('Received request to start media scan...');

  const user = await getUserFromEvent(event); 
  if (!user) { 
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  try {
    // Fetch folders for the authenticated user
    const foldersToScan = await db.select({ 
        mediaFolderId: mediaFolders.mediaFolderId, 
        path: mediaFolders.path 
      })
      .from(mediaFolders)
      .where(eq(mediaFolders.userId, user.userId)) 
      .orderBy(desc(mediaFolders.createdAt))
      .all();

    if (!foldersToScan || foldersToScan.length === 0) {
      console.log('No media folders configured for scan for this user.');
      return { success: true, message: 'No media folders configured for scanning for this user.', scanned: 0, added: 0, errors: 0 };
    }

    console.log(`Starting scan for ${foldersToScan.length} media folder(s) for user ${user.userId}...`);
    
    // Initialize counters
    let totalScanned = 0;
    let totalAddedTracks = 0;
    let totalAddedArtists = 0;
    let totalAddedAlbums = 0;
    let totalErrors = 0;

    // Scan folders concurrently in small batches to reduce overall time
    const scanResults = await batchMap(foldersToScan, 2, async (folder) => {
      if (!folder.mediaFolderId) {
        console.warn(`Folder with path ${folder.path} is missing an ID. Skipping.`);
        return { stats: null, error: true };
      }

      console.log(`Scanning folder: ${folder.path} (ID: ${folder.mediaFolderId}) for user ${user.userId}`);

      try {
        const scanStats = await scanLibrary({
          libraryId: folder.mediaFolderId,
          libraryPath: folder.path,
          userId: user.userId,
        });

        console.log(`Successfully scanned folder: ${folder.path}`);
        return { stats: scanStats, error: false };
      } catch (error: any) {
        console.error(`Error scanning folder ${folder.path}: ${error.message}`);
        return { stats: null, error: true };
      }
    });

    for (const result of scanResults) {
      if (result.error) {
        totalErrors++;
        continue;
      }
      if (result.stats) {
        totalScanned++;
        totalAddedTracks += result.stats.addedTracks;
        totalAddedArtists += result.stats.addedArtists;
        totalAddedAlbums += result.stats.addedAlbums;
        totalErrors += result.stats.errors;
      }
    }

    console.log(`Scan completed for user ${user.userId}. Processed ${totalScanned} folders with ${totalErrors} errors.`);
    return {
      success: true,
      message: `Scan completed for ${totalScanned} folders.`,
      scanned: totalScanned,
      addedTracks: totalAddedTracks,
      addedArtists: totalAddedArtists,
      addedAlbums: totalAddedAlbums,
      errors: totalErrors
    };
  } catch (error: any) {
    console.error(`Error during scan operation for user ${user.userId}: ${error.message}`);
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message}`
    });
  }
});
