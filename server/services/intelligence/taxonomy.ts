import type { TaxonomyTag } from './types';

export const TAXONOMY_VERSION = 'music-text-v1';
// Heuristic cosine floor, not a calibrated probability or music classifier accuracy claim.
export const TAG_SIMILARITY_THRESHOLD = 0.7;
// These are text descriptions, not acoustic measurements or authoritative genres.
export const TAG_TAXONOMY: readonly TaxonomyTag[] = [
  { id: 'calm', label: 'Calm', category: 'mood', description: 'Peaceful, gentle, quiet music for relaxation and restful contemplation.' },
  { id: 'energetic', label: 'Energetic', category: 'mood', description: 'High energy, exciting, lively music about movement, action and celebration.' },
  { id: 'melancholy', label: 'Melancholy', category: 'mood', description: 'Sad, sorrowful, wistful music about loneliness, loss and longing.' },
  { id: 'hopeful', label: 'Hopeful', category: 'mood', description: 'Optimistic, uplifting music about hope, courage and a brighter future.' },
  { id: 'romantic', label: 'Romantic', category: 'theme', description: 'A love song about romance, affection, intimacy and being together.' },
  { id: 'nature', label: 'Nature', category: 'theme', description: 'Music evoking forests, oceans, rain, mountains, birds and the natural world.' },
  { id: 'journey', label: 'Journey', category: 'theme', description: 'Music about travelling, adventures, roads, exploration and leaving home.' },
  { id: 'reflection', label: 'Reflection', category: 'theme', description: 'Introspective music about memories, change, identity and the passage of time.' },
  { id: 'instrumental', label: 'Instrumental', category: 'style', description: 'Instrumental music without sung lyrics or a lead vocalist.' },
  { id: 'orchestral', label: 'Orchestral', category: 'style', description: 'Classical orchestral and cinematic soundtrack music with strings and symphonic arrangements.' },
  { id: 'electronic', label: 'Electronic', category: 'style', description: 'Electronic music, synthesizers, ambient soundscapes and digitally produced dance beats.' },
  { id: 'acoustic', label: 'Acoustic', category: 'style', description: 'Acoustic folk music, singer songwriter songs, guitar and intimate organic arrangements.' },
];
