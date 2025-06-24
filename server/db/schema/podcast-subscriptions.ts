import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users';
import { podcasts } from './podcasts';

export const podcastSubscriptions = sqliteTable('podcast_subscriptions', {
  subscriptionId: text('subscription_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  podcastId: text('podcast_id')
    .notNull()
    .references(() => podcasts.podcastId, { onDelete: 'cascade' }),
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export type PodcastSubscription = InferSelectModel<typeof podcastSubscriptions>;
export type NewPodcastSubscription = InferInsertModel<typeof podcastSubscriptions>;
