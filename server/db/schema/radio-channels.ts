// c:\Users\mille\Documents\otogami\server\db\schema\radio-channels.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users';
import { artists } from './artists';
import { genres } from './genres';

export const radioChannels = sqliteTable('radio_channels', {
  channelId: text('channel_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  seedArtistId: text('seed_artist_id').references(() => artists.artistId, { onDelete: 'set null' }),
  seedGenreId: text('seed_genre_id').references(() => genres.genreId, { onDelete: 'set null' }),
  dynamic: integer('dynamic').default(1).notNull(), // 1 = auto-update, 0 = static
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export type RadioChannel = InferSelectModel<typeof radioChannels>;
export type NewRadioChannel = InferInsertModel<typeof radioChannels>;
