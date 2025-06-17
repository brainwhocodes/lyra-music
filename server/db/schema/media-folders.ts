// c:\Users\mille\Documents\otogami\server\db\schema\media-folders.ts
import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users'; // For foreign key reference

export const mediaFolders = sqliteTable('media_folders', {
  mediaFolderId: text('media_folders_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  path: text('path').notNull(),
  label: text('label'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type MediaFolder = InferSelectModel<typeof mediaFolders>;
export type NewMediaFolder = InferInsertModel<typeof mediaFolders>;
