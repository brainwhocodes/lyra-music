// MusicBrainz API base URL
const MUSICBRAINZ_API_BASE_URL = 'https://musicbrainz.org/ws/2/';

// Get User-Agent from environment variable
const config = useRuntimeConfig();
const userAgent = config.public.musicbrainzUserAgent;

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
export async function getReleaseInfoWithTags(mbid: string): Promise<any> { 
  return musicBrainzApiRequest(`release/${mbid}`, { 
    inc: 'artist-credits+labels+recordings+release-groups+media+discids+aliases+tags+genres+url-rels' 
  });
}

/**
 * Interface for MusicBrainz release with relations
 */
interface MusicBrainzReleaseWithRelations extends MusicBrainzRelease {
  relations?: Array<{
    type: string;
    url?: {
      resource: string;
    };
  }>;
}

/**
 * Interface for Cover Art Archive response
 */
interface CoverArtArchiveResponse {
  images?: Array<{
    front?: boolean;
    image?: string;
  }>;
}

/**
 * Fetches cover art URLs for a release from MusicBrainz.
 * @param mbid The MusicBrainz ID (MBID) of the release.
 * @returns A promise that resolves with an array of cover art URLs, or an empty array if none found.
 */
export async function getReleaseCoverArtUrls(mbid: string): Promise<string[]> {
  try {
    const release = await musicBrainzApiRequest<MusicBrainzReleaseWithRelations>(`release/${mbid}`, { 
      inc: 'url-rels' 
    });
    
    const coverArtUrls: string[] = [];
    console.log(`[CAA Debug ${mbid}] Initial release relations:`, JSON.stringify(release?.relations, null, 2));

    if (release?.relations) {
      for (const relation of release.relations) {
        if (relation.type === 'cover art' && relation.url?.resource) {
          const coverArtArchiveUrl = relation.url.resource;
          console.log(`[CAA Debug ${mbid}] Found relation URL to Cover Art Archive: ${coverArtArchiveUrl}`);
          try {
            const response = await fetch(coverArtArchiveUrl, {
              headers: { 'User-Agent': typeof userAgent === 'string' ? userAgent : 'Otogami/0.0.1 (UserAgentNotSet)' },
              retry: 2, 
              retryDelay: 1000,
            } as any);
            const caaResponse = await response.json() as CoverArtArchiveResponse;
            console.log(`[CAA Debug ${mbid}] Response from ${coverArtArchiveUrl}:`, JSON.stringify(caaResponse, null, 2));

            if (caaResponse && caaResponse.images && caaResponse.images.length > 0) {
              for (const image of caaResponse.images) {
                if (image.front && image.image) { 
                  coverArtUrls.push(image.image);
                  console.log(`[CAA Debug ${mbid}] Added front cover from relation: ${image.image}`);
                }
              }
              if (coverArtUrls.length === 0 && caaResponse.images[0]?.image) {
                 coverArtUrls.push(caaResponse.images[0].image);
                 console.log(`[CAA Debug ${mbid}] Added first available cover from relation (no front found): ${caaResponse.images[0].image}`);
              }
            } else {
              console.log(`[CAA Debug ${mbid}] No images found in CAA response from relation URL ${coverArtArchiveUrl}. Images array:`, caaResponse?.images);
            }
          } catch (caaError: any) {
            console.warn(`[CAA Debug ${mbid}] Could not fetch or parse from Cover Art Archive URL ${coverArtArchiveUrl}: ${caaError.message}`);
          }
        }
      }
    }
    
    if (coverArtUrls.length === 0) {
      console.log(`[CAA Debug ${mbid}] No direct cover art URLs found via relations. Attempting fallback to direct CAA query.`);
      try {
        const caaDirectUrl = `https://coverartarchive.org/release/${mbid}`;
        console.log(`[CAA Debug ${mbid}] Fetching directly from CAA: ${caaDirectUrl}`);
        const response = await fetch(caaDirectUrl, {
          headers: { 'User-Agent': typeof userAgent === 'string' ? userAgent : 'Otogami/0.0.1 (UserAgentNotSet)' },
          retry: 2,
          retryDelay: 1000,
        } as any);
        const caaResponse = await response.json() as CoverArtArchiveResponse;
        console.log(`[CAA Debug ${mbid}] Response from direct CAA query ${caaDirectUrl}:`, JSON.stringify(caaResponse, null, 2));

        if (caaResponse && caaResponse.images && caaResponse.images.length > 0) {
          for (const image of caaResponse.images) {
            if (image.front && image.image) {
              coverArtUrls.push(image.image);
              console.log(`[CAA Debug ${mbid}] Added front cover from direct CAA query: ${image.image}`);
            }
          }
          if (coverArtUrls.length === 0 && caaResponse.images[0]?.image) {
             coverArtUrls.push(caaResponse.images[0].image);
             console.log(`[CAA Debug ${mbid}] Added first available cover from direct CAA query (no front found): ${caaResponse.images[0].image}`);
          }
        } else {
          console.log(`[CAA Debug ${mbid}] No images found in direct CAA response from ${caaDirectUrl}. Images array:`, caaResponse?.images);
        }
      } catch (directCaaError: any) {
        console.warn(`[CAA Debug ${mbid}] Error fetching directly from Cover Art Archive for ${mbid}: ${directCaaError.message}`);
      }
    }

    if (coverArtUrls.length > 0) {
      console.log(`[CAA Debug ${mbid}] Final cover art URLs found for ${mbid}:`, coverArtUrls);
    } else {
      console.log(`[CAA Debug ${mbid}] No cover art URLs found for release ${mbid} after all checks.`);
    }
    
    return coverArtUrls;
  } catch (error: any) {
    console.error(`[CAA Debug ${mbid}] Error fetching release relations for cover art (MBID: ${mbid}): ${error.message}`);
    return [];
  }
}

/**
 * Searches for an artist on MusicBrainz by name.
 * @param artistName The name of the artist.
 * @returns The MusicBrainz ID (MBID) of the first matching artist, or null if not found or error.
 */
export async function searchArtistByName(
  artistName: string
): Promise<string | null> {
  if (!artistName) return null;

  try {
    const response = await musicBrainzApiRequest<MusicBrainzArtistSearchResponse>('artist', { 
      query: `artist:"${artistName}"`, 
      limit: 1 
    });

    if (response && response.artists && response.artists.length > 0) {
      const firstArtist = response.artists[0];
      console.log(`  [MusicBrainz Search] Found artist: ${firstArtist.name} (ID: ${firstArtist.id})`);
      return firstArtist.id;
    }
    console.log(`  [MusicBrainz Search] No artists found for query: ${artistName}`);
    return null;
  } catch (error: any) {
    console.error(`  [MusicBrainz Search] Error searching for artist: ${error.message}`);
    return null;
  }
}

/**
 * Fetches artist information including relationships to get image URLs.
 * @param mbid The MusicBrainz ID (MBID) of the artist.
 * @returns A promise that resolves with the artist data including relationships.
 */
export async function getArtistWithImages(mbid: string): Promise<MusicBrainzArtist | null> { 
  try {
    const artist = await musicBrainzApiRequest<MusicBrainzArtist>(`artist/${mbid}`, { 
      inc: 'url-rels' 
    });
    return artist;
  } catch (error: any) {
    console.error(`  [MusicBrainz] Error fetching artist data: ${error.message}`);
    return null;
  }
}

/**
 * Extracts image URLs from artist relationships.
 * @param artist The MusicBrainz artist object with relationships.
 * @returns An array of image URLs, or null if none found.
 */
export function extractArtistImageUrls(artist: MusicBrainzArtist): string[] {
  const imageUrls: string[] = [];
  
  if (!artist.relations) return imageUrls;
  
  for (const relation of artist.relations) {
    // Check for image relations
    if (relation.type === 'image' && relation.url?.resource) {
      // Convert Wikimedia Commons URLs to direct image URLs if needed
      const url = relation.url.resource;
      imageUrls.push(url);
    }
  }
  
  return imageUrls;
}

// Interface for the structure of a release object in MusicBrainz API responses
interface MusicBrainzRelease { 
  id: string;
  title: string;
  // Add other relevant fields if needed, e.g., 'artist-credit', 'date'
}

// Interface for the structure of an artist object in MusicBrainz API responses
interface MusicBrainzArtist {
  id: string;
  name: string;
  relations?: Array<{
    type: string;
    url?: {
      resource: string;
    };
  }>;
}

// Interface for the MusicBrainz API response when searching for artists
interface MusicBrainzArtistSearchResponse {
  created?: string;
  count?: number;
  offset?: number;
  artists: MusicBrainzArtist[];
}

// Interface for the MusicBrainz API response when searching for releases
interface MusicBrainzReleaseSearchResponse {
  created?: string;
  count?: number;
  offset?: number;
  releases: MusicBrainzRelease[];
}

/**
 * Searches for a release on MusicBrainz by album title and optionally artist name.
 * @param albumTitle The title of the album.
 * @param artistName The name of the artist (optional).
 * @returns The MusicBrainz ID (MBID) of the first matching release, or null if not found or error.
 */
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
    console.log(`  [MusicBrainz Search] Searching for release with query: ${query}`);
    const response = await musicBrainzApiRequest('release', { query, limit: 1 }) as MusicBrainzReleaseSearchResponse;

    if (response && response.releases && response.releases.length > 0) {
      const firstRelease = response.releases[0];
      console.log(`  [MusicBrainz Search] Found release: ${firstRelease.title} (ID: ${firstRelease.id})`);
      return firstRelease.id;
    }
    console.log(`  [MusicBrainz Search] No releases found for query: ${query}`);
    return null;
  } catch (error: any) {
    console.error(`  [MusicBrainz Search] Error searching for release: ${error.message}`);
    return null;
  }
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
