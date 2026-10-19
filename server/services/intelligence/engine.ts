import { embedTexts, embeddingConfig, embeddingRuntimeState } from './embedding-service';
import { classifyTags, rankTracks, recommendTracks } from './math';
import { readHistory, readLibrary, saveEmbeddings, trackContent, trackContentHash } from './repository';
import { TAG_TAXONOMY, TAXONOMY_VERSION } from './taxonomy';
import { IntelligenceError, type EmbeddingOptions, type RankedTrack } from './types';
import { invalidateRecommendationSnapshot } from './recommendations';

const validateLimit = (limit: number, max = 50) => {
  if (!Number.isInteger(limit) || limit < 1 || limit > max) throw new IntelligenceError(`Limit must be an integer from 1 to ${max}.`, 400);
};
const counts = (library: ReturnType<typeof readLibrary>) => ({ totalTracks: library.totalTracks, indexedTracks: library.indexed.length, pendingTracks: library.pending.length });
const publicTrack = ({ track, score, reason, seedTrackId }: RankedTrack) => ({
  trackId: track.trackId, title: track.title, albumId: track.albumId, albumTitle: track.albumTitle,
  artists: track.artists, coverPath: track.coverPath, duration: track.duration, genre: track.genre,
  score, reason, ...(seedTrackId ? { seedTrackId } : {}),
});

export function intelligenceStatus(userId: string, options: EmbeddingOptions = {}) {
  const config = embeddingConfig(options);
  const library = readLibrary(userId, config);
  return { model: config.model, revision: config.revision, dimensions: config.dimensions, ...counts(library),
    ready: library.indexed.length > 0, runtime: embeddingRuntimeState(), input: 'metadata-and-lyrics' as const };
}

let indexing = false;
export async function indexLibrary(userId: string, limit = 16, options: EmbeddingOptions = {}) {
  validateLimit(limit, 16);
  if (indexing) throw new IntelligenceError('Library indexing is already running. Retry shortly.', 429);
  indexing = true;
  try {
    const config = embeddingConfig(options);
    const library = readLibrary(userId, config);
    const batch = library.pending.slice(0, limit);
    if (!batch.length) return { ...counts(library), indexedThisBatch: 0 };
    const vectors = await embedTexts(batch.flatMap(track => [
      { text: `title: ${track.title.slice(0, 200)} | text: ${trackContent(track)}`, task: 'document' as const },
      { text: trackContent(track), task: 'classification' as const },
      { text: trackContent(track), task: 'similarity' as const },
    ]), options);
    const indexedThisBatch = saveEmbeddings(userId, config, batch.map((track, i) => ({
      trackId: track.trackId, contentHash: trackContentHash(track), model: config.model, revision: config.revision, dimensions: config.dimensions,
      retrievalVector: vectors[i * 3]!, classificationVector: vectors[i * 3 + 1]!, similarityVector: vectors[i * 3 + 2]!, indexedAt: new Date().toISOString(),
    })));
    if (indexedThisBatch) invalidateRecommendationSnapshot(userId);
    return { ...counts(readLibrary(userId, config)), indexedThisBatch };
  } finally { indexing = false; }
}

export async function searchLibrary(userId: string, query: string, limit = 20, options: EmbeddingOptions = {}) {
  validateLimit(limit);
  if (typeof query !== 'string' || !query.trim() || query.length > 1000) throw new IntelligenceError('Enter a search query of 1–1000 characters.', 400);
  const config = embeddingConfig(options);
  let library = readLibrary(userId, config);
  if (!library.indexed.length) return { tracks: [], ...counts(library) };
  const [queryVector] = await embedTexts([{ text: query.trim(), task: 'query' }], options);
  // A track may have been deleted, edited or moved while the model ran.
  library = readLibrary(userId, config);
  return { tracks: rankTracks(queryVector!, library.indexed, limit, query).map(publicTrack), ...counts(library) };
}

export function recommendLibrary(userId: string, limit = 20, options: EmbeddingOptions = {}) {
  validateLimit(limit);
  const library = readLibrary(userId, embeddingConfig(options));
  const result = recommendTracks(library.indexed, readHistory(userId), { limit });
  return { basis: result.basis, tracks: result.tracks.map(publicTrack), ...counts(library) };
}

let taxonomyCache: { key: string; vectors: number[][] } | undefined;
export async function tagTrack(userId: string, trackId: string, options: EmbeddingOptions = {}) {
  const config = embeddingConfig(options);
  let library = readLibrary(userId, config);
  let track = library.indexed.find(item => item.trackId === trackId);
  if (!track) {
    if (library.pending.some(item => item.trackId === trackId)) throw new IntelligenceError('Index this track before requesting suggested tags.', 409);
    throw new IntelligenceError('Track not found.', 404);
  }
  const key = JSON.stringify([config.model, config.revision, config.dimensions, TAXONOMY_VERSION]);
  if (taxonomyCache?.key !== key) {
    const vectors = await embedTexts(TAG_TAXONOMY.map(tag => ({ text: tag.description, task: 'classification' })), options);
    taxonomyCache = { key, vectors };
  }
  library = readLibrary(userId, config);
  track = library.indexed.find(item => item.trackId === trackId);
  if (!track) throw new IntelligenceError('Track changed while generating tags. Refresh the index and retry.', 409);
  const tags = classifyTags(track.classificationVector, TAG_TAXONOMY.map((tag, i) => ({ tag, vector: taxonomyCache!.vectors[i]! })));
  return { trackId, tags: tags.map(({ id, label, category, score }) => ({ id, label, category, score,
    source: 'embeddinggemma-taxonomy' as const, model: config.model, revision: config.revision, taxonomyVersion: TAXONOMY_VERSION,
    evidence: track.lyrics ? ['metadata', 'lyrics'] : ['metadata'],
  })), input: 'metadata-and-lyrics' as const, scoreMeaning: 'cosine-similarity-not-probability' as const, ...counts(library) };
}
