// server/api/settings/scan/index.post.ts
import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema'; 
import { scanLibrary } from '~/server/utils/scanner'; 
import { desc } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  console.log('Received request to start media scan...');

  try {
    // Fetch all folders without user filtering for now
    const foldersToScan = await db.select({ id: mediaFolders.id, path: mediaFolders.path })
      .from(mediaFolders)
      .orderBy(desc(mediaFolders.createdAt))
      .all();

    if (!foldersToScan || foldersToScan.length === 0) {
      console.log('No media folders configured for scan.');
      return { success: true, message: 'No media folders configured for scanning.', scanned: 0, added: 0, errors: 0 };
    }

    console.log(`Starting scan for ${foldersToScan.length} media folder(s)...`);
    let totalScanned = 0;
    let totalAdded = 0;
    let totalErrors = 0;

    // Sequentially scan each folder to avoid overwhelming the system
    // and to ensure logs are easier to follow per library.
    for (const folder of foldersToScan) {
      if (!folder.id) {
        console.warn(`Folder with path ${folder.path} is missing an ID. Skipping.`);
        totalErrors++;
        continue;
      }
      console.log(`Scanning folder: ${folder.path} (ID: ${folder.id})`);
      try {
        // Call the scanLibrary function
        await scanLibrary(folder.id, folder.path);
        console.log(`Successfully scanned folder: ${folder.path}`);
        totalScanned++;
      } catch (error: any) {
        console.error(`Error scanning folder ${folder.path}: ${error.message}`);
        totalErrors++;
      }
    }

    console.log(`Scan completed. Processed ${totalScanned} folders with ${totalErrors} errors.`);
    return {
      success: true,
      message: `Scan completed for ${totalScanned} folders.`,
      scanned: totalScanned,
      errors: totalErrors
    };
  } catch (error: any) {
    console.error(`Error during scan operation: ${error.message}`);
    throw createError({
      statusCode: 500,
      statusMessage: `Internal server error: ${error.message}`
    });
  }
});
