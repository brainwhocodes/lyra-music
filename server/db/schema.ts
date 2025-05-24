// This file will contain all Drizzle schema definitions (tables, relations, etc.)
// Refer to Phase 1 for the planned schema.
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core';
import { sql, type InferSelectModel, type InferInsertModel } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
// Phase 1: Define Tables

export const users = sqliteTable('users', {
  userId: text('user_id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').unique().notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const artists = sqliteTable('artists', {
  artistId: text('artistId').primaryKey(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const albums = sqliteTable('albums', {
  albumId: text('album_id').primaryKey(),
  title: text('title').notNull(),
  artistId: text('artist_id').references(() => artists.artistId, { onDelete: 'set null' }),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  year: integer('year'),
  coverPath: text('cover_path'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const tracks = sqliteTable('tracks', {
  trackId: text('track_id').primaryKey(),
  title: text('title').notNull(),
  artistId: text('artist_id').references(() => artists.artistId, { onDelete: 'set null' }), 
  albumId: text('album_id').references(() => albums.albumId, { onDelete: 'cascade' }), 
  genre: text('genre'),
  year: integer('year'), 
  trackNumber: integer('track_number'),
  diskNumber: integer('disk_number'),
  duration: integer('duration'), 
  filePath: text('file_path').notNull().unique(), 
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playlists = sqliteTable('playlists', {
  playlistId: text('playlist_id').primaryKey(),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const playlistTracks = sqliteTable('playlist_tracks', {
    playlistTrackId: text('playlist_tracks_id').primaryKey(),
    playlistId: text('playlist_id').references(() => playlists.playlistId, { onDelete: 'cascade' }).notNull(),
    trackId: text('track_id').references(() => tracks.trackId, { onDelete: 'cascade' }).notNull(),
    order: integer('order'),
    addedAt: integer('added_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
    updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const mediaFolders = sqliteTable('media_folders', {
  mediaFolderId: text('media_folders_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  path: text('path').notNull(),
  label: text('label'),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const genres = sqliteTable('genres', {
  genreId: text('genre_id').primaryKey().$defaultFn(() => uuidv7()),
  name: text('name').notNull().unique(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const userGenres = sqliteTable('user_genres', {
  userGenreId: text('user_genre_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  genreId: text('genre_id').references(() => genres.genreId, { onDelete: 'cascade' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

export const userArtists = sqliteTable('user_artists', {
  userArtistId: text('user_artist_id').primaryKey().$defaultFn(() => uuidv7()),
  userId: text('user_id').references(() => users.userId, { onDelete: 'cascade' }).notNull(),
  artistId: text('artist_id').references(() => artists.artistId, { onDelete: 'cascade' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).default(sql`CURRENT_TIMESTAMP`).notNull(),
});

// === Inferred Types ===
export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;

export type Artist = InferSelectModel<typeof artists>;
export type NewArtist = InferInsertModel<typeof artists>;

export type Album = InferSelectModel<typeof albums>;
export type NewAlbum = InferInsertModel<typeof albums>;

export type Track = InferSelectModel<typeof tracks>;
export type NewTrack = InferInsertModel<typeof tracks>;

export type MediaFolder = InferSelectModel<typeof mediaFolders>;
export type NewMediaFolder = InferInsertModel<typeof mediaFolders>;

export type Genre = InferSelectModel<typeof genres>;
export type NewGenre = InferInsertModel<typeof genres>;

export type UserGenre = InferSelectModel<typeof userGenres>;
export type NewUserGenre = InferInsertModel<typeof userGenres>;

export type UserArtist = InferSelectModel<typeof userArtists>;
export type NewUserArtist = InferInsertModel<typeof userArtists>;
