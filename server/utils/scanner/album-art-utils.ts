import crypto from 'crypto';
import { join, extname } from 'node:path';
import sharp from 'sharp';
import { fileUtils } from './file-utils';
import { EXTERNAL_COVER_FILENAMES } from './types';
import type { CoverArtArchiveResponse, CoverArtArchiveImage, MusicBrainzReleaseWithRelations } from '~/types/musicbrainz/musicbrainz';
import { musicBrainzApiRequest } from '~/server/utils/musicbrainz';

// Determine base path for runtime-uploaded assets
const projectRoot = process.cwd(); // Assuming process.cwd() is the project root

// We now store runtime generated files in a dedicated `uploads` directory that is
// available both in dev & prod via Nitro `publicAssets` configuration.
const uploadsDir = join(projectRoot, 'uploads');
const COVERS_DIR = join(uploadsDir, 'images', 'covers');
const ARTIST_IMAGES_DIR = join(uploadsDir, 'images', 'artists');

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
 * Downloads an image from a URL and saves it to the artist images directory as WebP format.
 */
export async function downloadArtistImage(imageUrl: string): Promise<string | null> {
  try {
    await ensureArtistImagesDirectory();
    
    // Generate a hash of the URL to use as the filename
    const hash = crypto.createHash('sha256').update(imageUrl).digest('hex');
    
    // Always use WebP extension for the destination file
    const imageFilename = `${hash}.webp`;
    const imageFullPath = join(ARTIST_IMAGES_DIR, imageFilename);
    
    // Check if the file already exists
    if (!await fileUtils.pathExists(imageFullPath)) {
      // Download the image
      const response = await fetch(imageUrl);
      if (!response.ok) {
        return null;
      }
      
      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      try {
        // Convert the image to WebP format using Sharp
        const webpBuffer = await sharp(imageBuffer)
          .webp({ quality: 80 }) // You can adjust quality as needed (0-100)
          .toBuffer();
        
        // Save the WebP image to disk
        await fileUtils.writeFile(imageFullPath, webpBuffer);
      } catch (sharpError) {
        // If Sharp conversion fails, return null
        return null;
      }
    }
    
    return `/uploads/images/artists/${imageFilename}`;
  } catch (error: any) {
    return null;
  }
}

/**
 * Saves image data to the covers directory with a hash-based filename, converting to WebP format.
 */
export async function saveArtToCache(
  imageData: Buffer,
): Promise<string | null> {
  try {
    await ensureCoversDirectory();
    const hash = crypto.createHash('sha256').update(imageData).digest('hex');
    const coverFilename = `${hash}.webp`;
    const coverFullPath = join(COVERS_DIR, coverFilename);

    if (!await fileUtils.pathExists(coverFullPath)) {
      // Convert the image to WebP format using Sharp
      const webpBuffer = await sharp(imageData)
        .webp({ quality: 80 }) // You can adjust quality as needed (0-100)
        .toBuffer();

      await fileUtils.writeFile(coverFullPath, webpBuffer);
    }
    
    return `/uploads/images/covers/${coverFilename}`;
  } catch (error: any) {
    // Handle specific sharp errors better
    if (error.message?.includes('Input buffer contains unsupported image format')) {
      // If Sharp can't process it, try saving original format as a fallback (optional)
      return null;
    }
    return null;
  }
}

/**
 * Processes external album art files in the same directory as the audio file.
 * Converts all found covers to WebP format.
 */
export async function processExternalAlbumArt(albumDir: string): Promise<string | null> {
  for (const coverFilename of EXTERNAL_COVER_FILENAMES) {
    const potentialCoverPath = join(albumDir, coverFilename);
    
    if (await fileUtils.pathExists(potentialCoverPath)) {
      try {
        const coverData = await fileUtils.readFile(potentialCoverPath);
        // We're using 'image/webp' as format as it's handled by saveArtToCache which now always outputs WebP
        return await saveArtToCache(coverData);
      } catch (error: any) {
        // Silent error - try next potential cover file
      }
    }
  }
  
  return null;
}

/**
 * Processes embedded album art from audio file metadata.
 * Converts to WebP format regardless of original format.
 */
export async function processEmbeddedAlbumArt(pictures: Array<{ format: string; data: Uint8Array }>): Promise<string | null> {
  if (!pictures || pictures.length === 0) return null;
  
  // Use the first available picture
  const picture = pictures[0];
  const pictureBuffer = Buffer.from(picture.data);
  
  // saveArtToCache will handle the WebP conversion
  return await saveArtToCache(pictureBuffer);
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

/**
 * Downloads album cover art from MusicBrainz using the release ID and converts it to WebP format.
 * @param musicbrainzReleaseId The MusicBrainz release ID
 * @returns A promise that resolves with the path to the downloaded cover art in WebP format, or null if not found or error
 */
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

    // Fetch the actual image file
    const imageResponse = await fetch(imageUrl, { headers: { 'User-Agent': userAgent } });
    if (!imageResponse.ok || !imageResponse.body) {
      return null;
    }
    
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
    
    // Use our saveArtToCache function which now converts all images to WebP
    // The format doesn't matter since we're converting to WebP regardless
    return await saveArtToCache(imageBuffer);

  } catch (error: any) {
    return null;
  }
}

/**
 * Downloads artist image from MusicBrainz using the artist ID.
 * @param musicbrainzArtistId The MusicBrainz artist ID.
 * @returns A promise that resolves with the path to the downloaded artist image, or null if not found or error.
 */
export async function downloadArtistImageFromMusicBrainz(musicbrainzArtistId: string): Promise<string | null> {
  if (!musicbrainzArtistId) {
    return null;
  }

  const userAgent = process.env.MUSICBRAINZ_USER_AGENT || 'Otogami/1.0.0 (https://otogami.app)';

  try {
    // Import at function level to avoid circular dependencies
    const { getArtistWithImages, extractArtistImageUrls } = await import('~/server/utils/musicbrainz');
    
    // Get artist data with relations that include image URLs
    const artist = await getArtistWithImages(musicbrainzArtistId);
    if (!artist) {
      return null;
    }
    
    // Extract image URLs from the artist relations
    const imageUrls = extractArtistImageUrls(artist);
    
    // If we found image URLs, download the first one
    if (imageUrls.length > 0) {
      const imageUrl = imageUrls[0]; // Use the first image URL
      return await downloadArtistImage(imageUrl);
    }
    
    return null;
  } catch (error: any) {
    // console.error(`Failed to download artist image from MusicBrainz for ${musicbrainzArtistId}: ${error.message}`);
    return null;
  }
}

/**
 * Searches MusicBrainz for an album by title and artist and downloads its cover art if found.
 * Falls back gracefully and returns null when no cover can be retrieved.
 * @param albumTitle The album title
 * @param artistName The primary artist name
 * @returns Absolute path (relative to project) to the downloaded cover WebP file, or null
 */
export async function searchAndDownloadAlbumArt(albumTitle: string, artistName: string): Promise<string | null> {
  if (!albumTitle || !artistName) return null;

  try {
    // Defer import to avoid circular deps
    const { searchReleaseByTitleAndArtist } = await import('~/server/utils/musicbrainz');

    const releaseId = await searchReleaseByTitleAndArtist(albumTitle, artistName);
    if (!releaseId) {
      return null;
    }

    const coverPath = await downloadAlbumArtFromMusicBrainz(releaseId);
    return coverPath;
  } catch (error) {
    // Non-fatal – just log & continue
    console.error(`searchAndDownloadAlbumArt error for ${albumTitle} – ${artistName}:`, error);
    return null;
  }
}

export const albumArtUtils = {
  saveArtToCache,
  processExternalAlbumArt,
  processEmbeddedAlbumArt,
  downloadArtistImage,
  downloadAlbumArtFromMusicBrainz,
  downloadArtistImageFromMusicBrainz,
  searchAndDownloadAlbumArt,
  ensureCoversDirectory,
  ensureArtistImagesDirectory,
  COVERS_DIR,
  ARTIST_IMAGES_DIR,
} as const;
