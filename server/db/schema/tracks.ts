// c:\Users\mille\Documents\otogami\server\db\schema\tracks.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { albums } from './albums'; // For foreign key reference

export const tracks = sqliteTable('tracks', {
  trackId: text('track_id').primaryKey().$defaultFn(() => uuidv7()),
  title: text('title').notNull(),
  albumId: text('album_id').references(() => albums.albumId, { onDelete: 'cascade' }), 
  genre: text('genre'),
  year: integer('year'), 
  trackNumber: integer('track_number'),
  diskNumber: integer('disk_number'),
  duration: integer('duration'), 
  explicit: integer('explicit', { mode: 'boolean' }).default(false).notNull(),
  filePath: text('file_path').notNull().unique(), 
  musicbrainzTrackId: text('musicbrainz_track_id').unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Track = InferSelectModel<typeof tracks>;
export type NewTrack = InferInsertModel<typeof tracks>;
