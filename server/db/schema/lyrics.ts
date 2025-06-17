// c:\Users\mille\Documents\otogami\server\db\schema\lyrics.ts
import { sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { tracks } from './tracks'; // For foreign key reference

export const lyrics = sqliteTable('lyrics', {
  lyricsId: text('lyrics_id').primaryKey().$defaultFn(() => uuidv7()),
  trackId: text('track_id').notNull().references(() => tracks.trackId, { onDelete: 'cascade' }),
  lyricsJson: text('lyrics_json', { mode: 'json' }).$type<Array<{ time: string; text: string }>>(),
  source: text('source'),
  llmModelUsed: text('llm_model_used'),
  rawLlmOutput: text('raw_llm_output'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => {
  return {
    trackIdx: uniqueIndex('lyrics_track_idx').on(table.trackId),
  };
});

export type Lyrics = InferSelectModel<typeof lyrics>;
export type NewLyrics = InferInsertModel<typeof lyrics>;
