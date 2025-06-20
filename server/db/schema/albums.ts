// c:\Users\mille\Documents\otogami\server\db\schema\albums.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users'; // For foreign key reference

export const albums = sqliteTable('albums', {
  albumId: text('album_id').primaryKey().$defaultFn(() => uuidv7()),
  title: text('title').notNull(),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  year: integer('year'),
  coverPath: text('cover_path'),
  processedStatus: integer('processed_status').default(-1).notNull(),
  folderPath: text('folder_path'),
  musicbrainzReleaseId: text('musicbrainz_release_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type Album = InferSelectModel<typeof albums>;
export type NewAlbum = InferInsertModel<typeof albums>;
