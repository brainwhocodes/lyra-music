// c:\Users\mille\Documents\otogami\server\db\schema\discovery-playlist-tracks.ts
import { sqliteTable, text, integer} from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { discoveryPlaylists } from './discovery-playlists';
import { tracks } from './tracks';

export const discoveryPlaylistTracks = sqliteTable('discovery_playlist_tracks', {
  discoveryPlaylistTrackId: text('discovery_playlist_track_id').primaryKey().$defaultFn(() => uuidv7()),
  discoveryPlaylistId: text('discovery_playlist_id').references(() => discoveryPlaylists.discoveryPlaylistId, { onDelete: 'cascade' }).notNull(),
  trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
  order: integer('order').notNull(), // Order of the track in the playlist
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  // Optional: reason for inclusion, e.g., 'similar_genre', 'new_release_from_artist'
  reason: text('reason'), 
  // Optional: score or relevance if applicable from the generation logic
  relevanceScore: integer('relevance_score'),
});
// Removed composite primary key as discoveryPlaylistTrackId is already a PK.
// If a composite unique constraint is needed on (discoveryPlaylistId, trackId) or (discoveryPlaylistId, order), 
// it can be added in the table definition's third argument (extraConfig).
// Example for unique (discoveryPlaylistId, trackId):
// }, (table) => {
//   return {
//     playlistTrackUniqueIdx: uniqueIndex('dp_playlist_track_unique_idx').on(table.discoveryPlaylistId, table.trackId),
//   };
// });

export type DiscoveryPlaylistTrack = InferSelectModel<typeof discoveryPlaylistTracks>;
export type NewDiscoveryPlaylistTrack = InferInsertModel<typeof discoveryPlaylistTracks>;
