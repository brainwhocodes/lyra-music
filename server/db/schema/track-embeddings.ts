import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { tracks } from './tracks';

export const trackEmbeddings = sqliteTable('track_embeddings', {
  trackId: text('track_id').primaryKey().references(() => tracks.trackId, { onDelete: 'cascade' }),
  contentHash: text('content_hash').notNull(),
  model: text('model').notNull(),
  revision: text('revision').notNull(),
  dimensions: integer('dimensions').notNull(),
  retrievalVector: text('retrieval_vector', { mode: 'json' }).$type<number[]>().notNull(),
  classificationVector: text('classification_vector', { mode: 'json' }).$type<number[]>().notNull(),
  similarityVector: text('similarity_vector', { mode: 'json' }).$type<number[]>().notNull(),
  indexedAt: text('indexed_at').notNull(),
});
