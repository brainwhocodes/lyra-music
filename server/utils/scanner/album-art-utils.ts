import crypto from 'crypto';
import path from 'path';
import { fileUtils } from './file-utils';
import { EXTERNAL_COVER_FILENAMES } from './types';
import { getReleaseCoverArtUrls } from '~/server/utils/musicbrainz';

const COVERS_DIR = path.join(process.cwd(), 'public', 'images', 'covers');
const ARTIST_IMAGES_DIR = path.join(process.cwd(), 'public', 'images', 'artists');

/**
 * Ensures the covers directory exists.
 */
async function ensureCoversDirectory(): Promise<void> {
  await fileUtils.ensureDir(COVERS_DIR);
}

/**
 * Ensures the artist images directory exists.
 */
async function ensureArtistImagesDirectory(): Promise<void> {
  await fileUtils.ensureDir(ARTIST_IMAGES_DIR);
}

/**
 * Downloads an image from a URL and saves it to the artist images directory.
 */
export async function downloadArtistImage(imageUrl: string): Promise<string | null> {
  try {
    await ensureArtistImagesDirectory();
    
    // Generate a hash of the URL to use as the filename
    const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
    
    // Determine the file extension from the URL or default to jpg
    const urlPath = new URL(imageUrl).pathname;
    const extension = path.extname(urlPath).toLowerCase() || '.jpg';
    const cleanExtension = extension.replace('.', '').replace('jpeg', 'jpg');
    
    const imageFilename = `${hash}.${cleanExtension}`;
    const imageFullPath = path.join(ARTIST_IMAGES_DIR, imageFilename);
    
    // Check if the file already exists
    if (!await fileUtils.pathExists(imageFullPath)) {
      // Download the image
      const response = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Save the image to disk
      await fileUtils.writeFile(imageFullPath, imageBuffer);
      console.log(`  Saved artist image from ${imageUrl} to: ${imageFullPath}`);
    }
    
    return `/images/artists/${imageFilename}`;
  } catch (error: any) {
    console.error(`  Failed to download artist image from ${imageUrl}: ${error.message}`);
    return null;
  }
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

/**
 * Downloads album cover art from MusicBrainz using the release ID.
 * @param musicbrainzReleaseId The MusicBrainz release ID.
 * @returns A promise that resolves with the path to the downloaded cover art, or null if not found or error.
 */
export async function downloadAlbumArtFromMusicBrainz(musicbrainzReleaseId: string): Promise<string | null> {
  if (!musicbrainzReleaseId) {
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Received null/empty MBID. Skipping.`);
    return null;
  }
  
  console.log(`[MB Art DL ${musicbrainzReleaseId}] Attempting to download album art.`);
  try {
    const coverArtUrls = await getReleaseCoverArtUrls(musicbrainzReleaseId);
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Received URLs from getReleaseCoverArtUrls:`, coverArtUrls);
    
    if (!coverArtUrls || coverArtUrls.length === 0) {
      console.log(`[MB Art DL ${musicbrainzReleaseId}] No cover art URLs found by getReleaseCoverArtUrls.`);
      return null;
    }
    
    const imageUrl = coverArtUrls[0]; // Using the first URL
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Selected image URL for download: ${imageUrl}`);
    
    await ensureCoversDirectory();
    
    const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
    const urlPath = new URL(imageUrl).pathname;
    const extension = path.extname(urlPath).toLowerCase() || '.jpg';
    const cleanExtension = extension.replace('.', '').replace('jpeg', 'jpg');
    const imageFilename = `${hash}.${cleanExtension}`;
    const imageFullPath = path.join(COVERS_DIR, imageFilename);
    
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Target save path: ${imageFullPath}`);

    if (await fileUtils.pathExists(imageFullPath)) {
      console.log(`[MB Art DL ${musicbrainzReleaseId}] Image already exists at ${imageFullPath}. Skipping download.`);
      return `/images/covers/${imageFilename}`;
    }
    
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Downloading image from ${imageUrl}...`);
    const response = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await response.arrayBuffer());
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Image downloaded successfully. Size: ${imageBuffer.length} bytes.`);
    
    await fileUtils.writeFile(imageFullPath, imageBuffer);
    console.log(`[MB Art DL ${musicbrainzReleaseId}] Image saved successfully to ${imageFullPath}.`);
    
    return `/images/covers/${imageFilename}`;
  } catch (error: any) {
    console.error(`[MB Art DL ${musicbrainzReleaseId}] Failed to download or save album cover art: ${error.message}`, error.stack);
    return null;
  }
}

export const albumArtUtils = {
  saveArtToCache,
  processExternalAlbumArt,
  processEmbeddedAlbumArt,
  downloadArtistImage,
  downloadAlbumArtFromMusicBrainz,
  COVERS_DIR,
  ARTIST_IMAGES_DIR,
} as const;
