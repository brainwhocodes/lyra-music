// c:\Users\mille\Documents\otogami\server\db\schema\radio-channels.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users';

export const radioChannels = sqliteTable('radio_channels', {
  channelId: text('channel_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  dynamic: integer('dynamic').default(1).notNull(), // 1 = auto-update, 0 = static
  createdAt: text('created_at').$defaultFn(() => new Date().toISOString()).notNull(),
  updatedAt: text('updated_at').$defaultFn(() => new Date().toISOString()).notNull(),
});

export type RadioChannel = InferSelectModel<typeof radioChannels>;
export type NewRadioChannel = InferInsertModel<typeof radioChannels>;
