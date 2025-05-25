// server/api/settings/scan/index.post.ts
import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema'; 
import { scanLibrary } from '~/server/utils/scanner'; 
import { desc, eq, and } from 'drizzle-orm'; 
import { getUserFromEvent } from '~/server/utils/auth'; 

export default defineEventHandler(async (event) => {
  console.log('Received request to start media scan...');

  const user = getUserFromEvent(event); 
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
    let totalScanned = 0;
    let totalAdded = 0;
    let totalErrors = 0;

    // Sequentially scan each folder to avoid overwhelming the system
    // and to ensure logs are easier to follow per library.
    for (const folder of foldersToScan) {
      if (!folder.mediaFolderId) {
        console.warn(`Folder with path ${folder.path} is missing an ID. Skipping.`);
        totalErrors++;
        continue;
      }
      console.log(`Scanning folder: ${folder.path} (ID: ${folder.mediaFolderId}) for user ${user.userId}`);
      try {
        // Call the scanLibrary function with a single object parameter
        await scanLibrary({
          libraryId: folder.mediaFolderId,
          libraryPath: folder.path,
          userId: user.userId
        });
        console.log(`Successfully scanned folder: ${folder.path}`);
        totalScanned++;
      } catch (error: any) {
        console.error(`Error scanning folder ${folder.path}: ${error.message}`);
        totalErrors++;
      }
    }

    console.log(`Scan completed for user ${user.userId}. Processed ${totalScanned} folders with ${totalErrors} errors.`);
    return {
      success: true,
      message: `Scan completed for ${totalScanned} folders.`,
      scanned: totalScanned,
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
