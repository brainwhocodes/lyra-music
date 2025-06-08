// This file will contain all Drizzle schema definitions (tables, relations, etc.)
// Refer to Phase 1 for the planned schema.
import { sqliteTable, text, integer, primaryKey, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql, relations, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
// Phase 1: Define Tables

export const users = sqliteTable('users', {
  userId: text('user_id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  verified: integer('verified').default(0).notNull(),
  passwordHash: text('password_hash').notNull(),
  loginAttempts: integer('login_attempts').default(0).notNull(),
  lastLoginAt: text('last_login_at'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const artists = sqliteTable('artists', {
  artistId: text('artist_id').primaryKey().$defaultFn(() => uuidv7()),
  artistImage: text('artist_image'),
  name: text('name').notNull(),
  musicbrainzArtistId: text('musicbrainz_artist_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Junction table for many-to-many relationship between artists and users
export const artistUsers = sqliteTable('artist_users', {
  artistUserId: text('artist_user_id').primaryKey().$defaultFn(() => uuidv7()),
  artistId: text('artist_id')
    .notNull()
    .references(() => artists.artistId, { onDelete: 'cascade' }),
  userId: text('user_id')
    .notNull()
    .references(() => users.userId, { onDelete: 'cascade' }),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const albums = sqliteTable('albums', {
  albumId: text('album_id').primaryKey().$defaultFn(() => uuidv7()),
  title: text('title').notNull(),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  year: integer('year'),
  coverPath: text('cover_path'),
  musicbrainzReleaseId: text('musicbrainz_release_id'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Junction table for many-to-many relationship between albums and artists
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

export const radioChannels = sqliteTable('radio_channels', {
  channelId: text('channel_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  seedArtistId: text('seed_artist_id').references(() => artists.artistId, { onDelete: 'set null' }),
  seedGenreId: text('seed_genre_id').references(() => genres.genreId, { onDelete: 'set null' }),
  dynamic: integer('dynamic').default(1).notNull(), // 1 = auto-update, 0 = static
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const radioChannelTracks = sqliteTable('radio_channel_tracks', {
  radioTrackId: text('radio_track_id').primaryKey().$defaultFn(() => uuidv7()),
  channelId: text('channel_id').references(() => radioChannels.channelId, { onDelete: 'cascade' }).notNull(),
  trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
  addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

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

export const artistsTracks = sqliteTable('artists_tracks', {
  artistsTracksId: text('artists_tracks_id').primaryKey().$defaultFn(() => uuidv7()),
  artistId: text('artist_id').references(() => artists.artistId, { onDelete: 'cascade' }).notNull(),
  trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
  role: text('role'), // e.g., "main", "featured", "remixer"
  isPrimaryArtist: integer('is_primary_artist').default(0).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playlists = sqliteTable('playlists', {
  playlistId: text('playlist_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playlistTracks = sqliteTable('playlist_tracks', {
    playlistTrackId: text('playlist_tracks_id').primaryKey().$defaultFn(() => uuidv7()),
    playlistId: text('playlist_id').references(() => playlists.playlistId, { onDelete: 'cascade' }).notNull(),
    trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
    order: integer('order'),
    addedAt: text('added_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const mediaFolders = sqliteTable('media_folders', {
  mediaFolderId: text('media_folders_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  path: text('path').notNull(),
  label: text('label'),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const genres = sqliteTable('genres', {
  genreId: text('genre_id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull().unique(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const albumGenres = sqliteTable('album_genres', {
  albumGenreId: text('album_genre_id').primaryKey().$defaultFn(() => uuidv7()),
  albumId: text('album_id').references(() => albums.albumId, { onDelete: 'cascade' }).notNull(),
  genreId: text('genre_id').references(() => genres.genreId, { onDelete: 'cascade' }).notNull(),
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// Add new table definition before relations
export const lyrics = sqliteTable('lyrics', {
  lyricsId: text('lyrics_id').primaryKey().$defaultFn(() => uuidv7()),
  trackId: text('track_id').notNull().references(() => tracks.trackId, { onDelete: 'cascade' }),
  lyricsJson: text('lyrics_json', { mode: 'json' }).$type<Array<{ time: string; text: string }>>(), // Store as JSON
  source: text('source'), // e.g., 'generated_llm', 'manual_upload', 'synced_lrc', 'user_edited'
  llmModelUsed: text('llm_model_used'), // e.g., 'gemini-2.5-flash'
  rawLlmOutput: text('raw_llm_output'), // Raw output from LLM for debugging
  createdAt: text('created_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: text('updated_at').default(sql`CURRENT_TIMESTAMP`).notNull(),
}, (table) => {
  return {
    trackIdx: uniqueIndex('lyrics_track_idx').on(table.trackId), // Enforce one-to-one by unique index on trackId
  };
});

// === Relations ===

export const artistRelations = relations(artists, ({ many }) => ({
  albumArtists: many(albumArtists),
  artistUsers: many(artistUsers),
  artistsTracks: many(artistsTracks),
}));

export const albumRelations = relations(albums, ({ many, one }) => ({
  albumArtists: many(albumArtists),
  user: one(users, {
    fields: [albums.userId],
    references: [users.userId],
  }),
}));

export const albumArtistRelations = relations(albumArtists, ({ one }) => ({
  album: one(albums, {
    fields: [albumArtists.albumId],
    references: [albums.albumId],
  }),
  artist: one(artists, {
    fields: [albumArtists.artistId],
    references: [artists.artistId],
  }),
}));

export const tracksRelations = relations(tracks, ({ one, many }) => ({
  album: one(albums, {
    fields: [tracks.albumId],
    references: [albums.albumId],
  }),
  playlistTracks: many(playlistTracks),
  radioChannelTracks: many(radioChannelTracks),
  artistsTracks: many(artistsTracks),
  lyrics: one(lyrics, {
    fields: [tracks.trackId], // This refers to the PK on tracks
    references: [lyrics.trackId], // This refers to the FK on lyrics that points to tracks.trackId
  }),
}));

export const lyricsRelations = relations(lyrics, ({ one }) => ({
  track: one(tracks, {
    fields: [lyrics.trackId],
    references: [tracks.trackId],
  }),
}));

export const artistsTracksRelations = relations(artistsTracks, ({ one }) => ({
  artist: one(artists, {
    fields: [artistsTracks.artistId],
    references: [artists.artistId],
  }),
  track: one(tracks, {
    fields: [artistsTracks.trackId],
    references: [tracks.trackId],
  }),
}));

export const userRelations = relations(users, ({ many }) => ({
  albums: many(albums),
  artistUsers: many(artistUsers),
  playlists: many(playlists),
  mediaFolders: many(mediaFolders),
  radioChannels: many(radioChannels),
}));

// Also adding relations for artistUsers for completeness, though not directly causing the current error
export const artistUserRelations = relations(artistUsers, ({ one }) => ({
  artist: one(artists, {
    fields: [artistUsers.artistId],
    references: [artists.artistId],
  }),
  user: one(users, {
    fields: [artistUsers.userId],
    references: [users.userId],
  }),
}));

// Relations for tracks, playlists, etc. can be added here as needed for other queries.

export const playlistRelations = relations(playlists, ({ one, many }) => ({
  user: one(users, {
    fields: [playlists.userId],
    references: [users.userId],
  }),
  playlistTracks: many(playlistTracks),
}));

export const playlistTrackRelations = relations(playlistTracks, ({ one }) => ({
  playlist: one(playlists, {
    fields: [playlistTracks.playlistId],
    references: [playlists.playlistId],
  }),
  track: one(tracks, {
    fields: [playlistTracks.trackId],
    references: [tracks.trackId],
  }),
}));


// === Inferred Types ===
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Artist = InferSelectModel<typeof artists>;
export type NewArtist = InferInsertModel<typeof artists>;

export type Album = InferSelectModel<typeof albums>;
export type NewAlbum = InferInsertModel<typeof albums>;

export type Track = InferSelectModel<typeof tracks>;
export type NewTrack = InferInsertModel<typeof tracks>;
export type ArtistsTracks = InferSelectModel<typeof artistsTracks>;
export type NewArtistsTracks = InferInsertModel<typeof artistsTracks>;

export type MediaFolder = InferSelectModel<typeof mediaFolders>;
export type NewMediaFolder = InferInsertModel<typeof mediaFolders>;

export type Genre = InferSelectModel<typeof genres>;
export type NewGenre = InferInsertModel<typeof genres>;

export type AlbumGenre = InferSelectModel<typeof albumGenres>;
export type NewAlbumGenre = InferInsertModel<typeof albumGenres>;
export type RadioChannel = InferSelectModel<typeof radioChannels>;
export type NewRadioChannel = InferInsertModel<typeof radioChannels>;

export type RadioChannelTrack = InferSelectModel<typeof radioChannelTracks>;
export type NewRadioChannelTrack = InferInsertModel<typeof radioChannelTracks>;

// Inferred types for lyrics
export type Lyrics = InferSelectModel<typeof lyrics>;
export type NewLyrics = InferInsertModel<typeof lyrics>;


