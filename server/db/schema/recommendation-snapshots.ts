import { integer, sqliteTable, text, index } from 'drizzle-orm/sqlite-core';
import { users } from './users';

export interface RecommendationItem {
  trackId: string;
  contentHash: string;
  score: number;
  seedTrackId?: string;
}

export interface RecommendationMetrics {
  windowDays: number;
  qualifiedPlays: number;
  distinctTracks: number;
  signals: string[];
}

/** A durable snapshot and the single active refresh pointer for each account. */
export const recommendationSnapshots = sqliteTable('recommendation_snapshots', {
  userId: text('user_id').primaryKey().references(() => users.userId, { onDelete: 'cascade' }),
  items: text('items', { mode: 'json' }).$type<RecommendationItem[]>().notNull().default([]),
  basis: text('basis', { enum: ['history', 'cold-start'] }).notNull().default('cold-start'),
  metrics: text('metrics', { mode: 'json' }).$type<RecommendationMetrics>(),
  modelKey: text('model_key'),
  generatedAt: text('generated_at'),
  nextRefreshAt: integer('next_refresh_at'),
  refreshJobId: text('refresh_job_id'),
  retryAfter: integer('retry_after'),
}, table => ({ dueIndex: index('recommendation_snapshots_due_idx').on(table.nextRefreshAt) }));
