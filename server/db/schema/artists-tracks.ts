// c:\Users\mille\Documents\otogami\server\db\schema\artists-tracks.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { artists } from './artists';
import { tracks } from './tracks';

export const artistsTracks = sqliteTable('artists_tracks', {
  artistsTracksId: text('artists_tracks_id').primaryKey().$defaultFn(() => uuidv7()),
  artistId: text('artist_id').references(() => artists.artistId, { onDelete: 'cascade' }).notNull(),
  trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
  role: text('role'), // e.g., "main", "featured", "remixer"
  isPrimaryArtist: integer('is_primary_artist').default(0).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type ArtistsTracks = InferSelectModel<typeof artistsTracks>;
export type NewArtistsTracks = InferInsertModel<typeof artistsTracks>;
