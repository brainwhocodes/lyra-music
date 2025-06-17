// c:\Users\mille\Documents\otogami\server\db\schema\artists.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';

export const artists = sqliteTable('artists', {
  artistId: text('artist_id').primaryKey().$defaultFn(() => uuidv7()),
  artistImage: text('artist_image'),
  name: text('name').notNull(),
  musicbrainzArtistId: text('musicbrainz_artist_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Artist = InferSelectModel<typeof artists>;
export type NewArtist = InferInsertModel<typeof artists>;
