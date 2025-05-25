import crypto from 'crypto';
import path from 'path';
import { fileUtils } from './file-utils';
import { EXTERNAL_COVER_FILENAMES } from './types';

const COVERS_DIR = path.join(process.cwd(), 'public', 'images', 'covers');

/**
 * Ensures the covers directory exists.
 */
async function ensureCoversDirectory(): Promise<void> {
  await fileUtils.ensureDir(COVERS_DIR);
}

/**
 * Saves image data to the covers directory with a hash-based filename.
 */
export async function saveArtToCache(
  imageData: Buffer,
  imageFormat: string,
  sourceDescription: string
): Promise<string | null> {
  try {
    await ensureCoversDirectory();
    const hash = crypto.createHash('sha256').update(imageData).digest('hex');
    const extension = (imageFormat.split('/')[1] || imageFormat).toLowerCase().replace('jpeg', 'jpg');
    const coverFilename = `${hash}.${extension}`;
    const coverFullPath = path.join(COVERS_DIR, coverFilename);

    if (!await fileUtils.pathExists(coverFullPath)) {
      await fileUtils.writeFile(coverFullPath, imageData);
      console.log(`  Saved album art from ${sourceDescription} to: ${coverFullPath}`);
    }
    
    return `/images/covers/${coverFilename}`;
  } catch (error: any) {
    console.error(`  Failed to save album art from ${sourceDescription}: ${error.message}`);
    return null;
  }
}

/**
 * Processes external album art files in the same directory as the audio file.
 */
export async function processExternalAlbumArt(albumDir: string): Promise<string | null> {
  for (const coverFilename of EXTERNAL_COVER_FILENAMES) {
    const potentialCoverPath = path.join(albumDir, coverFilename);
    
    if (await fileUtils.pathExists(potentialCoverPath)) {
      try {
        const coverData = await fileUtils.readFile(potentialCoverPath);
        const format = path.extname(potentialCoverPath).substring(1);
        return await saveArtToCache(coverData, format, `external file ${coverFilename}`);
      } catch (error: any) {
        console.error(`  Error processing external cover ${potentialCoverPath}:`, error.message);
      }
    }
  }
  
  return null;
}

/**
 * Processes embedded album art from audio file metadata.
 */
export async function processEmbeddedAlbumArt(pictures: Array<{ format: string; data: Uint8Array }>): Promise<string | null> {
  if (!pictures || pictures.length === 0) return null;
  
  const picture = pictures[0];
  console.log(`  Found embedded cover art (Format: ${picture.format}).`);
  const pictureBuffer = Buffer.from(picture.data);
  return await saveArtToCache(pictureBuffer, picture.format, 'embedded metadata');
}

export const albumArtUtils = {
  saveArtToCache,
  processExternalAlbumArt,
  processEmbeddedAlbumArt,
  COVERS_DIR,
} as const;
