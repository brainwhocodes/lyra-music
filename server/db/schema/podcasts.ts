import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

export const podcasts = sqliteTable('podcasts', {
  podcastId: text('podcast_id').primaryKey().$defaultFn(() => uuidv7()),
  feedUrl: text('feed_url').notNull().unique(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export type Podcast = InferSelectModel<typeof podcasts>;
export type NewPodcast = InferInsertModel<typeof podcasts>;
