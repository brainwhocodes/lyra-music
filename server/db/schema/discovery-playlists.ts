// c:\Users\mille\Documents\otogami\server\db\schema\discovery-playlists.ts
import { sqliteTable, text, integer, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { users } from './users';
import { artists } from './artists'; // For 'similar_to_artist' type

export const discoveryPlaylists = sqliteTable('discovery_playlists', {
  discoveryPlaylistId: text('discovery_playlist_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  title: text('title').notNull(), // e.g., "New Discoveries", "Similar to Artist X"
  type: text('type').notNull(), // e.g., 'new_discoveries', 'similar_to_artist'
  // Optional: if type is 'similar_to_artist', this could store the seed artistId
  seedArtistId: text('seed_artist_id').references(() => artists.artistId, { onDelete: 'set null' }),
  // Optional: parameters used for generation, stored as JSON
  generationParams: text('generation_params', { mode: 'json' }).$type<Record<string, any>>(),
  lastGeneratedAt: text('last_generated_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => {
  return {
    userTypeTitleIdx: uniqueIndex('dp_user_type_title_idx').on(table.userId, table.type, table.title),
    userTypeSeedArtistIdx: uniqueIndex('dp_user_type_seed_artist_idx').on(table.userId, table.type, table.seedArtistId),
  };
});

export type DiscoveryPlaylist = InferSelectModel<typeof discoveryPlaylists>;
export type NewDiscoveryPlaylist = InferInsertModel<typeof discoveryPlaylists>;
