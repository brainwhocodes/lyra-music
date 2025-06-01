// MusicBrainz API base URL
const MUSICBRAINZ_API_BASE_URL = 'https://musicbrainz.org/ws/2/';

import type {
  MusicBrainzArtist,
  MusicBrainzArtistCredit,
  MusicBrainzArtistSearchResponse,
  MusicBrainzRecording,
  MusicBrainzRecordingSearchResult,
  MusicBrainzRelease,
  MusicBrainzReleaseSearchResponse,
  MusicBrainzTrackInfo,
  MusicBrainzReleaseWithRelations as MusicBrainzReleaseWithRelationsImport, // aliasing to avoid potential naming conflicts if used internally
  CoverArtArchiveResponse as CoverArtArchiveResponseImport // aliasing
} from '../../types/musicbrainz/musicbrainz';

// Get User-Agent from environment variable
const config = useRuntimeConfig();
const userAgent = config.musicbrainzUserAgent;

if (!userAgent) {
  console.warn(
    'MUSICBRAINZ_USER_AGENT environment variable is not set. ' +
    'Please set it to comply with MusicBrainz API usage guidelines. ' +
    'Example: YourAppName/1.0.0 ( yourcontact@example.com )'
  );
}

const MAX_REQUESTS_PROCESSED_AT_ONCE = 1; // Process one request at a time from queue for delay logic
const INTRA_BURST_DELAY_MS = 200;    // 200ms = 5 requests per second within a burst

// New burst parameters
const BURST_SIZE = 50;
const BURST_PAUSE_MS = 5000; // 5 seconds

// Options for musicBrainzApiRequest, extending fetch options
interface MusicBrainzRequestOptions extends Record<string, any> {
  bypassBurstIncrement?: boolean;
}

const requestTimestamps: number[] = []; // Used for INTRA_BURST_DELAY_MS
const requestQueue: Array<{
  url: string;
  fetchOptions: Record<string, any>; // For fetch options, excluding bypassBurstIncrement
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
  bypassBurstIncrement?: boolean; // Flag to bypass burst counter increment
}> = [];
let isProcessingQueue = false;
let burstRequestCount = 0; // Counter for requests in the current burst

/**
 * Removes timestamps older than the defined intra-burst interval from the log.
 */
function cleanupTimestamps(): void {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - INTRA_BURST_DELAY_MS) {
    requestTimestamps.shift();
  }
}

/**
 * Processes the request queue, respecting the rate limit.
 */
async function processQueue(): Promise<void> {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  try {
    while (requestQueue.length > 0) {
      cleanupTimestamps(); // For intra-burst pacing

      if (burstRequestCount >= BURST_SIZE) {
        console.log(`MusicBrainz burst limit of ${BURST_SIZE} requests reached. Pausing for ${BURST_PAUSE_MS / 1000} seconds.`);
        await new Promise(resolve => setTimeout(resolve, BURST_PAUSE_MS));
        burstRequestCount = 0; // Reset burst counter
        requestTimestamps.length = 0; // Clear timestamps for the new burst pacing
        console.log(`MusicBrainz pause finished. Resuming queue. Queue size: ${requestQueue.length}`);
        continue; // Re-evaluate conditions for the next request
      }

      if (requestTimestamps.length < MAX_REQUESTS_PROCESSED_AT_ONCE) {
        const requestDetails = requestQueue.shift();
        if (requestDetails) {
          requestTimestamps.push(Date.now()); // Mark time for intra-burst pacing
          try {
            const headers = {
              'User-Agent': typeof userAgent === 'string' ? userAgent : 'Otogami/0.0.1 (UserAgentNotSet)', // Default UA if not set
              'Accept': 'application/json',
              ...(requestDetails.fetchOptions.headers || {}),
            };
            // Configure fetch retries for server errors and rate limit responses
            const response = await fetch(requestDetails.url, {
              ...requestDetails.fetchOptions,
              headers,
              retry: 3,
              retryDelay: 2000, // ms
              retryStatusCodes: [408, 429, 500, 502, 503, 504]
            } as any);
            const data = await response.json();
            requestDetails.resolve(data);
            if (!requestDetails.bypassBurstIncrement) {
              burstRequestCount++; // Increment only if not bypassed
            }
          } catch (error: any) {
            console.error(`MusicBrainz API Error for URL: ${requestDetails.url}. Status: ${error.status || 'N/A'}. Message: ${error.message}.`);
            // Still increment burst count even if request fails, if not bypassed, as an attempt was made
            if (!requestDetails.bypassBurstIncrement) {
              burstRequestCount++; 
            }
            requestDetails.reject(error);
          }
        }
      } else {
        // Intra-burst delay needed to maintain desired rate (e.g., 5 req/s)
        const oldestRequestTime = requestTimestamps[0];
        const waitTime = (oldestRequestTime + INTRA_BURST_DELAY_MS) - Date.now();
        // Optional: log intra-burst delay if needed for debugging
        // if (requestQueue.length > 0) {
        //   console.log(`MusicBrainz intra-burst delay. Waiting for ${Math.max(0, waitTime) + 10}ms. Burst: ${burstRequestCount}/${BURST_SIZE}. Queue: ${requestQueue.length}`);
        // }
        await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime) + 10)); 
      }
    }
  } finally {
    isProcessingQueue = false;
  }
}

/**
 * Makes a rate-limited request to the MusicBrainz API.
 * @param endpoint The API endpoint (e.g., 'artist', 'release-group').
 * @param params Query parameters for the API request.
 * @param options Additional fetch options if needed.
 * @returns A promise that resolves with the API response.
 */
export async function musicBrainzApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: MusicBrainzRequestOptions = {} // Use our custom options type
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) { // Only append defined parameters
      query.append(key, String(value));
    }
  }
  query.append('fmt', 'json'); // Always request JSON format

  const url = `${MUSICBRAINZ_API_BASE_URL}${endpoint}?${query.toString()}`;

  // Separate our custom option from fetch options
  const { bypassBurstIncrement, ...fetchOptions } = options;

  return new Promise<T>((resolve, reject) => {
    requestQueue.push({
      url,
      fetchOptions, // Pass the remaining (fetch) options
      resolve,
      reject,
      bypassBurstIncrement, // Store our custom flag
    });
    if (!isProcessingQueue) {
      processQueue().catch(error => {
        // This catch is for errors within processQueue itself, though unlikely with the current structure.
        // Individual request errors are handled and passed to their specific promise.
        console.error('Error in MusicBrainz request queue processing:', error);
        // Potentially reject all pending requests if the queue mechanism itself fails critically.
        while(requestQueue.length > 0) {
          requestQueue.shift()?.reject(new Error('Queue processing failed'));
        }
      });
    }
  });
}

/**
 * Fetches release information including artist credits, labels, recordings,
 * release groups, media, discids, aliases, tags, genres, and cover art relationships.
 * @param mbid The MusicBrainz ID (MBID) of the release.
 * @returns A promise that resolves with the release data including tags, genres, and cover art URLs.
 */
/**
 * Fetches detailed track information (recording) from MusicBrainz, including artist credits.
 * @param musicbrainzTrackId The MusicBrainz ID (MBID) of the recording.
 * @returns A promise that resolves with the track data.
 */
export async function getTrackInfo(musicbrainzTrackId: string): Promise<MusicBrainzTrackInfo | null> {
  try {
    const data = await musicBrainzApiRequest<MusicBrainzTrackInfo>(
      `recording/${musicbrainzTrackId}`,
      { inc: 'artist-credits+releases' }, // Include artist credits and associated releases
    );
    return data;
  } catch (error: any) {
    console.error(`Error fetching track info for MBID ${musicbrainzTrackId}:`, error.message);
    return null;
  }
}

/**
 * Searches for a track on MusicBrainz by title, and optionally artist and/or album title.
 * @param title The title of the track.
 * @param artistName The name of the primary artist (optional).
 * @param albumTitle The title of the album the track appears on (optional).
 * @returns A promise that resolves with search results, or null if an error occurs.
 */
export async function searchTrackOnMusicBrainz(
  title: string,
  artistName?: string,
  albumTitle?: string,
): Promise<MusicBrainzRecordingSearchResult | null> {
  let query = `recording:\"${title.replace(/:/g, '\\:')}\"`; // Escape colons in title
  if (artistName) {
    query += ` AND artistname:\"${artistName.replace(/:/g, '\\:')}\"`;
  }
  if (albumTitle) {
    query += ` AND release:\"${albumTitle.replace(/:/g, '\\:')}\"`;
  }

  try {
    // It's good practice to limit results if you only need a few, e.g., limit: 5
    const data = await musicBrainzApiRequest<MusicBrainzRecordingSearchResult>('recording', { query, limit: 10 });
    return data;
  } catch (error: any) {
    console.error(`Error searching MusicBrainz for track "${title}":`, error.message);
    return null;
  }
}

export async function getReleaseInfoWithTags(mbid: string): Promise<any> { 
  return musicBrainzApiRequest(`release/${mbid}`, { 
    inc: 'artist-credits+labels+recordings+release-groups+media+discids+aliases+tags+genres+url-rels' 
  });
}

export async function searchReleaseByTitleAndArtist(
  albumTitle: string,
  artistName?: string
): Promise<string | null> {
  if (!albumTitle) return null;

  let query = `release:"${albumTitle}"`;
  if (artistName) {
    query += ` AND artist:"${artistName}"`;
  }

  try {
    const response = await musicBrainzApiRequest('release', { query, limit: 1 }) as MusicBrainzReleaseSearchResponse;

    if (response && response.releases && response.releases.length > 0) {
      const firstRelease = response.releases[0];
      return firstRelease.id;
    }
    return null;
  } catch (error: any) {
    // Consider logging this error to a more permanent logging solution if available
    // console.error(`  [MusicBrainz Search] Error searching for release: ${error.message}`);
    return null;
  }
}

/**
 * Searches for an artist on MusicBrainz by name.
 * @param artistName The name of the artist to search for.
 * @returns A promise that resolves with the first matching artist, or null if not found or an error occurs.
 */
export async function searchArtistByName(artistName: string): Promise<MusicBrainzArtist | null> {
  if (!artistName) return null;

  const query = `artist:"${artistName.replace(/:/g, '\\:')}"`;
  try {
    console.log(`  [MusicBrainz Search] Searching for artist with query: ${query}`);
    const response = await musicBrainzApiRequest<MusicBrainzArtistSearchResponse>('artist', { query, limit: 5 });

    if (response && response.artists && response.artists.length > 0) {
      // Potentially add more sophisticated logic here to pick the best match
      const firstArtist = response.artists[0];
      console.log(`  [MusicBrainz Search] Found artist: ${firstArtist.name} (ID: ${firstArtist.id})`);
      return firstArtist;
    }
    console.log(`  [MusicBrainz Search] No artists found for query: ${query}`);
    return null;
  } catch (error: any) {
    console.error(`  [MusicBrainz Search] Error searching for artist "${artistName}": ${error.message}`);
    return null;
  }
}

/**
 * Fetches an artist by their MusicBrainz ID, including URL relations for images.
 * @param artistId The MusicBrainz ID (MBID) of the artist.
 * @returns A promise that resolves with the artist data, or null if an error occurs.
 */
export async function getArtistWithImages(artistId: string): Promise<MusicBrainzArtist | null> {
  if (!artistId) return null;

  try {
    const artistData = await musicBrainzApiRequest<MusicBrainzArtist>(
      `artist/${artistId}`,
      { inc: 'url-rels' } // Include URL relations
    );
    return artistData;
  } catch (error: any) {
    console.error(`Error fetching artist with images for MBID ${artistId}:`, error.message);
    return null;
  }
}

/**
 * Extracts image URLs from an artist's relations.
 * @param artist The MusicBrainzArtist object (should include relations).
 * @returns An array of image URLs.
 */
export function extractArtistImageUrls(artist: MusicBrainzArtist): string[] {
  const imageUrls: string[] = [];
  if (!artist.relations || artist.relations.length === 0) {
    return imageUrls;
  }

  for (const relation of artist.relations) {
    if (relation.type === 'image' && relation.url && relation.url.resource) {
      imageUrls.push(relation.url.resource);
      continue;
    }
    // Add more specific checks if needed, e.g., for wikidata, fanart.tv, etc.
    // Example: Check for Wikimedia Commons images often linked via 'url' relation type
    if (relation.url && relation.url.resource) {
      const resourceUrl = relation.url.resource.toLowerCase();
      if (resourceUrl.includes('wikimedia.org') && (resourceUrl.endsWith('.jpg') || resourceUrl.endsWith('.jpeg') || resourceUrl.endsWith('.png'))) {
        imageUrls.push(relation.url.resource);
      }
      // Fanart.tv images might be linked differently, often via a specific relation type or a URL to a fanart.tv page
      // This might require fetching the fanart.tv API if only a page URL is provided.
      // For simplicity, we're currently only looking for direct image links or easily identifiable ones.
    }
  }

  // Deduplicate URLs
  return [...new Set(imageUrls)];
}

/**
 * Example: Search for a release group by its title.
 * @param title The title of the release group to search for.
 * @returns A promise that resolves with the search results.
 */
/*
export async function searchReleaseGroup(title: string): Promise<any> {
  return musicBrainzApiRequest('release-group', { query: `releasegroup:"${title}"` });
}
*/

/**
 * Example: Fetch a release by its MBID.
 * @param mbid The MusicBrainz ID of the release.
 * @returns A promise that resolves with the release data.
 */
/*
export async function getReleaseByMbid(mbid: string): Promise<any> {
  return musicBrainzApiRequest(`release/${mbid}`, { inc: 'artist-credits+labels+recordings+release-groups+media+discids+aliases' });
}
*/
