import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users';
import { tracks } from './tracks';

export const userTrackPlays = sqliteTable('user_track_plays', {
  userTrackPlayId: text('user_track_play_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
  playedAt: text('played_at').$defaultFn(() => new Date().toISOString()).notNull(), // Records when the play occurred (e.g., play completion or significant point)
  playDurationMs: integer('play_duration_ms'), // Optional: How much of the track was played
  source: text('source'), // Optional: Where the play originated (e.g., 'library', 'album_view', 'playlist_xyz', 'search')
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export type UserTrackPlay = InferSelectModel<typeof userTrackPlays>;
export type NewUserTrackPlay = InferInsertModel<typeof userTrackPlays>;
