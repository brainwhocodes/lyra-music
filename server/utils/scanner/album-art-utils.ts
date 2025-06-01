import crypto from 'crypto';
import { join, extname } from 'node:path';
import { fileUtils } from './file-utils';
import { EXTERNAL_COVER_FILENAMES } from './types';
import type { CoverArtArchiveResponse, CoverArtArchiveImage, MusicBrainzReleaseWithRelations } from '~/types/musicbrainz/musicbrainz';
import { musicBrainzApiRequest } from '~/server/utils/musicbrainz';

const COVERS_DIR = join(process.cwd(), 'public', 'images', 'covers');
const ARTIST_IMAGES_DIR = join(process.cwd(), 'public', 'images', 'artists');

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
    const extension = extname(urlPath).toLowerCase() || '.jpg';
    const cleanExtension = extension.replace('.', '').replace('jpeg', 'jpg');
    
    const imageFilename = `${hash}.${cleanExtension}`;
    const imageFullPath = join(ARTIST_IMAGES_DIR, imageFilename);
    
    // Check if the file already exists
    if (!await fileUtils.pathExists(imageFullPath)) {
      // Download the image
      const response = await fetch(imageUrl);
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Save the image to disk
      await fileUtils.writeFile(imageFullPath, imageBuffer);
      // console.log(`  Saved artist image from ${imageUrl} to: ${imageFullPath}`);
    }
    
    return `/images/artists/${imageFilename}`;
  } catch (error: any) {
    // console.error(`  Failed to download artist image from ${imageUrl}: ${error.message}`);
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
    const coverFullPath = join(COVERS_DIR, coverFilename);

    if (!await fileUtils.pathExists(coverFullPath)) {
      await fileUtils.writeFile(coverFullPath, imageData);
      // console.log(`  Saved album art from ${sourceDescription} to: ${coverFullPath}`);
    }
    
    return `/images/covers/${coverFilename}`;
  } catch (error: any) {
    // console.error(`  Failed to save album art from ${sourceDescription}: ${error.message}`);
    return null;
  }
}

/**
 * Processes external album art files in the same directory as the audio file.
 */
export async function processExternalAlbumArt(albumDir: string): Promise<string | null> {
  for (const coverFilename of EXTERNAL_COVER_FILENAMES) {
    const potentialCoverPath = join(albumDir, coverFilename);
    
    if (await fileUtils.pathExists(potentialCoverPath)) {
      try {
        const coverData = await fileUtils.readFile(potentialCoverPath);
        const format = extname(potentialCoverPath).substring(1);
        return await saveArtToCache(coverData, format, `external file ${coverFilename}`);
      } catch (error: any) {
        // console.error(`  Error processing external cover ${potentialCoverPath}:`, error.message);
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
  // console.log(`  Found embedded cover art (Format: ${picture.format}).`);
  const pictureBuffer = Buffer.from(picture.data);
  return await saveArtToCache(pictureBuffer, picture.format, 'embedded metadata');
}

/**
 * Downloads album cover art from MusicBrainz using the release ID.
 * @param musicbrainzReleaseId The MusicBrainz release ID.
 * @returns A promise that resolves with the path to the downloaded cover art, or null if not found or error.
 */
async function getReleaseCoverArtUrlsInternal(musicbrainzReleaseId: string, userAgent: string): Promise<string[]> {
  const potentialImageUrls: string[] = [];

  try {
    // 1. Try fetching via release relations
    const release = await musicBrainzApiRequest<MusicBrainzReleaseWithRelations>(`release/${musicbrainzReleaseId}`, {
      inc: 'url-rels'
    });

    if (release?.relations) {
      for (const relation of release.relations) {
        if (relation.type === 'cover art' && relation.url?.resource) {
          const coverArtArchiveUrlFromRelation = relation.url.resource;
          try {
            const caaResponseFromRelation = await fetch(coverArtArchiveUrlFromRelation, { headers: { 'User-Agent': userAgent } });
            if (caaResponseFromRelation.ok) {
              const caaData = await caaResponseFromRelation.json() as CoverArtArchiveResponse;
              if (caaData?.images?.length) {
                const frontImage = caaData.images.find(img => img.front && img.image);
                if (frontImage?.image) potentialImageUrls.push(frontImage.image);
                // Fallback to first approved, then first image if no front
                if (!frontImage) {
                  const approvedImage = caaData.images.find(img => img.approved && img.image);
                  if (approvedImage?.image) potentialImageUrls.push(approvedImage.image);
                  else if (caaData.images[0]?.image) potentialImageUrls.push(caaData.images[0].image);
                }
              }
            }
          } catch (e) { /* Silently ignore, will try direct CAA query */ }
        }
      }
    }

    // 2. If no URLs from relations, try direct CAA query
    if (potentialImageUrls.length === 0) {
      const directCaaUrl = `https://coverartarchive.org/release/${musicbrainzReleaseId}`;
      try {
        const directCaaResponse = await fetch(directCaaUrl, { headers: { 'User-Agent': userAgent } });
        if (directCaaResponse.ok) {
          const caaData = await directCaaResponse.json() as CoverArtArchiveResponse;
          if (caaData?.images?.length) {
            const frontImage = caaData.images.find(img => img.front && img.image);
            if (frontImage?.image) potentialImageUrls.push(frontImage.image);
            if (!frontImage) {
              const approvedImage = caaData.images.find(img => img.approved && img.image);
              if (approvedImage?.image) potentialImageUrls.push(approvedImage.image);
              else if (caaData.images[0]?.image) potentialImageUrls.push(caaData.images[0].image);
            }
          }
        }
      } catch (e) { /* Silently ignore */ }
    }
  } catch (error: any) {
    // console.warn(`Error fetching release relations or direct CAA for ${musicbrainzReleaseId}: ${error.message}`);
  }
  // Return unique URLs, prioritizing earlier finds (relations over direct)
  return [...new Set(potentialImageUrls)];
}

export async function downloadAlbumArtFromMusicBrainz(musicbrainzReleaseId: string): Promise<string | null> {
  if (!musicbrainzReleaseId) {
    return null;
  }

  const userAgent = process.env.MUSICBRAINZ_USER_AGENT || 'Otogami/1.0.0 (https://otogami.app)';
  let imageUrl: string | undefined;

  try {
    const foundUrls = await getReleaseCoverArtUrlsInternal(musicbrainzReleaseId, userAgent);
    if (foundUrls.length > 0) {
      imageUrl = foundUrls[0]; // Already prioritized by getReleaseCoverArtUrlsInternal
    }

    if (!imageUrl) {
      return null;
    }

    await ensureCoversDirectory();

    // Check cache before downloading
    const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
    const urlPath = new URL(imageUrl).pathname;
    // Prioritize extension from URL, fallback to jpg for safety if missing/uncommon
    let extension = extname(urlPath).toLowerCase().replace('.', '');
    if (!['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension)) {
        extension = 'jpg'; 
    }
    const cleanExtension = extension === 'jpeg' ? 'jpg' : extension;
    const imageFilename = `${hash}.${cleanExtension}`;
    const imageFullPath = join(COVERS_DIR, imageFilename);

    if (await fileUtils.pathExists(imageFullPath)) {
      return `/images/covers/${imageFilename}`;
    }

    // Fetch the actual image file
    const imageResponse = await fetch(imageUrl, { headers: { 'User-Agent': userAgent } }); // Add User-Agent for image fetch too
    if (!imageResponse.ok || !imageResponse.body) {
      return null;
    }
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Save to cache using saveArtToCache or similar logic (here, directly writing)
    // If saveArtToCache is preferred, this part needs to adapt to its signature (e.g., getting imageFormat)
    await fileUtils.writeFile(imageFullPath, imageBuffer);
    return `/images/covers/${imageFilename}`; // Return the relative path for client use

  } catch (error: any) {
    // console.error(`Error in downloadAlbumArtFromMusicBrainz for MBID ${musicbrainzReleaseId}: ${error.message}`);
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
