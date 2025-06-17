// c:\Users\mille\Documents\otogami\server\db\schema\artist-users.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { artists } from './artists';
import { users } from './users';

export const artistUsers = sqliteTable('artist_users', {
  artistUserId: text('artist_user_id').primaryKey().$defaultFn(() => uuidv7()),
  artistId: text('artist_id')
    .notNull()
    .references(() => artists.artistId, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ArtistUser = InferSelectModel<typeof artistUsers>;
export type NewArtistUser = InferInsertModel<typeof artistUsers>;
