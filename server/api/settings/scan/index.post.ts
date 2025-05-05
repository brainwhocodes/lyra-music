// server/api/settings/scan/index.post.ts
import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { mediaFolders } from '~/server/db/schema';
import { scanDirectory } from '~/server/services/scanner'; // Import the new service

export default defineEventHandler(async (event) => {
  console.log('Received request to start media scan...');

  try {
    // 1. Fetch all configured media folders from the database
    const foldersToScan = await db.select({
        id: mediaFolders.id,
        path: mediaFolders.path
    }).from(mediaFolders);

    if (!foldersToScan || foldersToScan.length === 0) {
      console.log('No media folders configured. Scan aborted.');
      // Consider returning a specific status or message
      return { success: true, message: 'No media folders configured.' };
    }

    console.log(`Found ${foldersToScan.length} folders to scan:`, foldersToScan.map(f => f.path));

    // 2. Scan each folder sequentially (can be parallelized later if needed)
    let totalScanned = 0;
    let totalAdded = 0;
    let totalErrors = 0;

    for (const folder of foldersToScan) {
      console.log(`Scanning folder ID ${folder.id}: ${folder.path}`);
      try {
        // Ensure the path exists before scanning (redundant with scanner but good practice)
        // const stats = await fs.stat(folder.path);
        // if (!stats.isDirectory()) {
        //   console.warn(`Path is not a directory, skipping: ${folder.path}`);
        //   totalErrors++; // Count as an error? Or just log?
        //   continue;
        // }

        // Call the scanner service
        const result = await scanDirectory(folder.path);
        totalScanned += result.scanned;
        totalAdded += result.added;
        totalErrors += result.errors;
        console.log(`Finished scanning ${folder.path}. Results:`, result);

      } catch (scanError: any) {
        console.error(`Failed to scan directory ${folder.path}:`, scanError.message);
        totalErrors++; // Count directory-level scan errors
        // Decide if one folder failing should stop the whole process or continue
        // continue; // Continue with the next folder
      }
    }

    // 3. Return overall results
    const finalMessage = `Scan complete. Processed ${totalScanned} audio files, added ${totalAdded} new tracks, encountered ${totalErrors} errors.`;
    console.log(finalMessage);
    return {
      success: true,
      message: finalMessage,
      results: {
        scanned: totalScanned,
        added: totalAdded,
        errors: totalErrors,
      },
    };

  } catch (error: any) {
    console.error('Error during the overall scan process:', error);
    // Return a server error response
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to complete media scan.',
      message: error.message || 'An internal server error occurred during scanning.',
    });
  }
});
