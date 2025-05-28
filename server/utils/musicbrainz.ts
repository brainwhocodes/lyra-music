import { ofetch } from 'ofetch';

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

const MAX_REQUESTS_PER_INTERVAL = 50;
const INTERVAL_MS = 1000; // 1 second

const requestTimestamps: number[] = [];
const requestQueue: Array<{
  url: string;
  options: Record<string, any>; // For ofetch options
  resolve: (value: any) => void;
  reject: (reason?: any) => void;
}> = [];
let isProcessingQueue = false;

/**
 * Removes timestamps older than the defined interval from the log.
 */
function cleanupTimestamps(): void {
  const now = Date.now();
  while (requestTimestamps.length > 0 && requestTimestamps[0] <= now - INTERVAL_MS) {
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
      cleanupTimestamps();

      if (requestTimestamps.length < MAX_REQUESTS_PER_INTERVAL) {
        const requestDetails = requestQueue.shift();
        if (requestDetails) {
          requestTimestamps.push(Date.now());
          try {
            const headers = {
              'User-Agent': typeof userAgent === 'string' ? userAgent : 'Otogami/0.0.1 (UserAgentNotSet)', // Default UA if not set
              'Accept': 'application/json',
              ...(requestDetails.options.headers || {}),
            };
            const response = await ofetch(requestDetails.url, { ...requestDetails.options, headers });
            requestDetails.resolve(response);
          } catch (error) {
            requestDetails.reject(error);
          }
        }
      } else {
        // Rate limit hit, calculate wait time for the oldest request in the window to expire
        const oldestRequestTime = requestTimestamps[0];
        const waitTime = (oldestRequestTime + INTERVAL_MS) - Date.now();
        await new Promise(resolve => setTimeout(resolve, Math.max(0, waitTime) + 10)); // Add a small buffer (10ms)
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
 * @param options Additional ofetch options if needed.
 * @returns A promise that resolves with the API response.
 */
export async function musicBrainzApiRequest<T>(
  endpoint: string,
  params: Record<string, string | number | undefined> = {},
  options: Record<string, any> = {}
): Promise<T> {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) { // Only append defined parameters
      query.append(key, String(value));
    }
  }
  query.append('fmt', 'json'); // Always request JSON format

  const url = `${MUSICBRAINZ_API_BASE_URL}${endpoint}?${query.toString()}`;

  return new Promise<T>((resolve, reject) => {
    requestQueue.push({
      url,
      options,
      resolve,
      reject,
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
    
    if (release?.relations) {
      for (const relation of release.relations) {
        // Check for cover art relations
        if (relation.type === 'cover art' && relation.url?.resource) {
          const url = relation.url.resource;
          
          // Check if it's a Cover Art Archive URL
          if (url.includes('coverartarchive.org')) {
            try {
              // Fetch the actual image URLs from Cover Art Archive
              const coverArtData = await ofetch<CoverArtArchiveResponse>(`${url}`, { 
                headers: { 'User-Agent': typeof userAgent === 'string' ? userAgent : 'Otogami/0.0.1 (default)' }
              });
              
              if (coverArtData?.images) {
                for (const image of coverArtData.images) {
                  if (image.front && image.image) {
                    coverArtUrls.push(image.image);
                    break; // Just get the front cover
                  }
                }
              }
            } catch (coverArtError: any) {
              console.error(`  Error fetching cover art from Cover Art Archive: ${coverArtError.message}`);
            }
          } else {
            // Direct image URL
            coverArtUrls.push(url);
          }
        }
      }
    }
    
    return coverArtUrls;
  } catch (error: any) {
    console.error(`  Error fetching cover art URLs for release ${mbid}: ${error.message}`);
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
