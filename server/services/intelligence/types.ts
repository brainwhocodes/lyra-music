export const EMBEDDING_MODEL = 'google/embeddinggemma-2';
export const EMBEDDING_REVISION = '914f7f89142e33e77833254d9c9b90c3cef7303b';
export const EMBEDDING_DIMENSIONS = 256;

export type EmbeddingTask = 'document' | 'query' | 'classification' | 'similarity';
export interface EmbeddingInput { text: string; task: EmbeddingTask }
export interface EmbeddingOptions {
  embeddingPython?: string;
  embeddingModel?: string;
  embeddingRevision?: string;
  embeddingTimeoutMs?: string | number;
  embeddingDimensions?: string | number;
  embeddingMaxTracks?: string | number;
}
export interface LibraryTrack {
  trackId: string;
  title: string;
  albumId: string;
  albumTitle: string;
  artists: string[];
  genre: string | null;
  year: number | null;
  duration: number | null;
  coverPath: string | null;
  lyrics: string;
  createdAt: string;
}
export interface IndexedTrack extends LibraryTrack {
  retrievalVector: number[];
  classificationVector: number[];
  similarityVector: number[];
}
export interface PlayHistory { trackId: string; playedAt: string; playDurationMs: number | null }
export interface RankedTrack { track: IndexedTrack; score: number; reason: string; seedTrackId?: string }
export interface TaxonomyTag { id: string; label: string; category: 'mood' | 'theme' | 'style'; description: string }
export interface TagMatch extends TaxonomyTag { score: number }

export class IntelligenceError extends Error {
  constructor(message: string, public readonly statusCode: number) {
    super(message);
    this.name = 'IntelligenceError';
  }
}
