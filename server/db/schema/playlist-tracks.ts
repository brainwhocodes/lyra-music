// c:\Users\mille\Documents\otogami\server\db\schema\playlist-tracks.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { playlists } from './playlists';
import { tracks } from './tracks';

export const playlistTracks = sqliteTable('playlist_tracks', {
    playlistTrackId: text('playlist_tracks_id').primaryKey().$defaultFn(() => uuidv7()),
    playlistId: text('playlist_id').references(() => playlists.playlistId, { onDelete: 'cascade' }).notNull(),
    trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
    order: integer('order'),
    addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export type PlaylistTrack = InferSelectModel<typeof playlistTracks>;
export type NewPlaylistTrack = InferInsertModel<typeof playlistTracks>;
