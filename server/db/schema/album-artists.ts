// c:\Users\mille\Documents\otogami\server\db\schema\album-artists.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { albums } from './albums';
import { artists } from './artists';

export const albumArtists = sqliteTable('album_artists', {
  albumArtistId: text('album_artist_id').primaryKey().$defaultFn(() => uuidv7()),
  albumId: text('album_id')
    .notNull()
    .references(() => albums.albumId, { onDelete: 'cascade' }),
  artistId: text('artist_id')
    .notNull()
    .references(() => artists.artistId, { onDelete: 'cascade' }),
  isPrimaryArtist: integer('is_primary_artist').default(0),
  role: text('role').default('performer'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type AlbumArtist = InferSelectModel<typeof albumArtists>;
export type NewAlbumArtist = InferInsertModel<typeof albumArtists>;
