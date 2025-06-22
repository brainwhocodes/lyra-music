import { $fetch } from 'ofetch';

interface GeniusTokenResponse {
  access_token: string;
  token_type: string;
  expires_in?: number; 
  scope?: string;
}

interface GeniusApiErrorMeta {
  status: number;
  message: string;
}

interface GeniusApiError {
  meta: GeniusApiErrorMeta;
  response?: any; 
}

export interface GeniusArtist {
  id: number;
  name: string;
  url: string;
  header_image_url?: string;
  image_url?: string;
  iq?: number;
}

export interface GeniusSong {
  id: number;
  title: string;
  url: string;
  header_image_url: string;
  song_art_image_url: string;
  release_date_for_display?: string;
  artist_names?: string; 
  primary_artist?: GeniusArtist;
  featured_artists?: GeniusArtist[];
  producer_artists?: GeniusArtist[];
  writer_artists?: GeniusArtist[];
  // When fetching with text_format, description and other annotations might be available
  description_annotation?: { annotations: { body: { dom: any, plain: string } }[] }; // Simplified
  // Add other fields as needed
}

interface GeniusSearchHit {
  index: string;
  type: 'song';
  result: GeniusSong;
}

export interface GeniusSearchResponse {
  meta: GeniusApiErrorMeta;
  response: {
    hits: GeniusSearchHit[];
  };
}

export interface GeniusSongResponse {
  meta: GeniusApiErrorMeta;
  response: {
    song: GeniusSong;
  };
}

const GENIUS_API_BASE_URL = 'https://api.genius.com';
const GENIUS_TOKEN_URL = 'https://api.genius.com/oauth/token';

type RequestQueueItem<T> = {
  endpoint: string;
  params?: Record<string, string | number | string[]>;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
};

export class GeniusService {
  private readonly clientId: string;
  private readonly clientSecret: string;
  private accessToken: string | null = null;
  private tokenExpiryTime: number | null = null;

  // --- Rate Limiting ---
  private requestQueue: RequestQueueItem<any>[] = [];
  private isProcessingQueue = false;
  private readonly requestTimestamps: number[] = [];
  private readonly rateLimitCount = 50; // Max requests
  private readonly rateLimitWindow = 60 * 1_000; // Per 1 minute (in ms)

  constructor(clientId: string, clientSecret: string, initialAccessToken?: string) {
    this.clientId = clientId;
    this.clientSecret = clientSecret;
    if (initialAccessToken) {
      this.accessToken = initialAccessToken;
    }
  }

  private async ensureValidToken(): Promise<void> {
    if (this.accessToken && (this.tokenExpiryTime === null || this.tokenExpiryTime > Date.now() + 60 * 1000)) {
      return;
    }

    try {
      const response = await $fetch<GeniusTokenResponse>(GENIUS_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
        },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: this.clientId,
          client_secret: this.clientSecret,
        }).toString(),
      });

      this.accessToken = response.access_token;
      if (response.expires_in) {
        this.tokenExpiryTime = Date.now() + (response.expires_in - 300) * 1000; // Refresh 5 mins before expiry
      } else {
        this.tokenExpiryTime = null;
      }
      console.info('Successfully obtained Genius API access token.');
    } catch (error: any) {
      const errorMessage = error.data?.meta?.message || error.data?.error_description || error.data?.error || error.message || 'Unknown error';
      console.error('Error obtaining Genius API access token:', errorMessage, error.data);
      this.accessToken = null;
      throw new Error(
        `Failed to obtain Genius API access token: ${errorMessage}. ` +
        'Please verify client_credentials grant support with Genius API or use a pre-generated Client Access Token.'
      );
    }
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue) return;
    this.isProcessingQueue = true;

    while (this.requestQueue.length > 0) {
      const item = this.requestQueue.shift();
      if (!item) continue;

      try {
        // --- Wait for rate limit window ---
        const now = Date.now();
        // Remove timestamps older than the window
        while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < now - this.rateLimitWindow) {
          this.requestTimestamps.shift();
        }

        if (this.requestTimestamps.length >= this.rateLimitCount) {
          const oldestRequestTime = this.requestTimestamps[0];
          const waitTime = this.rateLimitWindow - (now - oldestRequestTime);
          if (waitTime > 0) {
            // console.log(`Genius rate limit reached. Waiting for ${waitTime}ms`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
        // --------------------------------

        await this.ensureValidToken();
        if (!this.accessToken) {
          throw new Error('Genius API access token is not available.');
        }

        const url = new URL(`${GENIUS_API_BASE_URL}${item.endpoint}`);
        if (item.params) {
          Object.entries(item.params).forEach(([key, value]) => {
            if (Array.isArray(value)) {
              value.forEach(v => url.searchParams.append(`${key}[]`, String(v)));
            } else {
              url.searchParams.append(key, String(value));
            }
          });
        }

        const data = await $fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${this.accessToken}`,
            'Accept': 'application/json',
          },
        });

        this.requestTimestamps.push(Date.now());
        item.resolve(data);

      } catch (error: any) {
        const errorMessage = error.data?.meta?.message || error.data?.error_description || error.data?.error || error.message || 'Unknown error';
        console.error(`Error fetching from Genius API endpoint ${item.endpoint}:`, errorMessage, error.data);
        const geniusError = error.data as GeniusApiError;
        if (geniusError?.meta?.message) {
          item.reject(new Error(`Genius API Error: ${geniusError.meta.message} (Status: ${geniusError.meta.status})`));
        } else {
          item.reject(new Error(`Failed to fetch from Genius API endpoint ${item.endpoint}: ${errorMessage}`));
        }
      }
    }

    this.isProcessingQueue = false;
  }

  private _request<T>(endpoint: string, params?: Record<string, string | number | string[]>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this.requestQueue.push({ endpoint, params, resolve, reject });
      this.processQueue();
    });
  }

  public async searchSongs(query: string): Promise<GeniusSearchResponse> {
    return this._request<GeniusSearchResponse>('/search', { q: query });
  }

  public async getSongById(songId: number, textFormat: string[] = ['dom', 'plain']): Promise<GeniusSongResponse> {
    return this._request<GeniusSongResponse>(`/songs/${songId}`, { text_format: textFormat.join(',') });
  }
}

/*
// Example usage (e.g., in a Nuxt server route):
import { useRuntimeConfig } from '#imports';

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event);
  const geniusService = new GeniusService(config.geniusApiClientId, config.geniusApiClientSecret);

  try {
    const query = getQuery(event).q as string || 'Blinding Lights';
    const searchResults = await geniusService.searchSongs(query);
    
    if (searchResults.response.hits.length > 0) {
      const firstHit = searchResults.response.hits[0].result;
      const songDetails = await geniusService.getSongById(firstHit.id);
      return {
        searchHit: firstHit,
        songDetails: songDetails.response.song,
      };
    }
    return { message: 'No songs found' };
  } catch (error: any) {
    console.error('Error in Genius API route:', error.message);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch data from Genius API: ' + error.message,
    });
  }
});
*/
