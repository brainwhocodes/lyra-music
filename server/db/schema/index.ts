// c:\Users\mille\Documents\otogami\server\db\schema\index.ts
import { relations } from 'drizzle-orm';

// Import all table schemas and their types
export * from './users';
export * from './user-track-plays';
export * from './artists';
export * from './artist-users';
export * from './albums';
export * from './album-artists';
export * from './radio-channels';
export * from './radio-channel-tracks';
export * from './tracks';
export * from './artists-tracks';
export * from './playlists';
export * from './playlist-tracks';
export * from './media-folders';
export * from './genres';
export * from './album-genres';
export * from './lyrics';
export * from './discovery-playlists';
export * from './discovery-playlist-tracks';

// Import table objects specifically for defining relations
import { users } from './users';
import { artists } from './artists';
import { artistUsers } from './artist-users';
import { albums } from './albums';
import { albumArtists } from './album-artists';
import { radioChannels } from './radio-channels';
import { radioChannelTracks } from './radio-channel-tracks';
import { tracks } from './tracks';
import { artistsTracks } from './artists-tracks';
import { playlists } from './playlists';
import { playlistTracks } from './playlist-tracks';
import { mediaFolders } from './media-folders';
import { genres } from './genres';
import { albumGenres } from './album-genres';
import { lyrics } from './lyrics';
import { discoveryPlaylists } from './discovery-playlists';
import { discoveryPlaylistTracks } from './discovery-playlist-tracks';

// === Relations ===

export const artistRelations = relations(artists, ({ many }) => ({
  albumArtists: many(albumArtists),
  artistUsers: many(artistUsers),
  artistsTracks: many(artistsTracks),
  radioChannelsAsSeed: many(radioChannels, { relationName: 'seedArtistForRadioChannels' }),
  discoveryPlaylistsAsSeed: many(discoveryPlaylists, { relationName: 'seedArtistForDiscoveryPlaylists' }),
}));

export const albumRelations = relations(albums, ({ many, one }) => ({
  albumArtists: many(albumArtists),
  user: one(users, {
    fields: [albums.userId],
    references: [users.userId],
  }),
  tracks: many(tracks),
  albumGenres: many(albumGenres),
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
    fields: [tracks.trackId],
    references: [lyrics.trackId],
  }),
  discoveryPlaylistTracks: many(discoveryPlaylistTracks),
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
  discoveryPlaylists: many(discoveryPlaylists),
}));

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

export const genreRelations = relations(genres, ({ many }) => ({
    albumGenres: many(albumGenres),
    radioChannelsAsSeed: many(radioChannels, { relationName: 'seedGenreForRadioChannels' }),
}));

export const albumGenreRelations = relations(albumGenres, ({ one }) => ({
    album: one(albums, {
        fields: [albumGenres.albumId],
        references: [albums.albumId],
    }),
    genre: one(genres, {
        fields: [albumGenres.genreId],
        references: [genres.genreId],
    }),
}));

export const radioChannelRelations = relations(radioChannels, ({ one, many }) => ({
    user: one(users, {
        fields: [radioChannels.userId],
        references: [users.userId],
    }),
    seedArtist: one(artists, {
        fields: [radioChannels.seedArtistId],
        references: [artists.artistId],
        relationName: 'seedArtistForRadioChannels',
    }),
    seedGenre: one(genres, {
        fields: [radioChannels.seedGenreId],
        references: [genres.genreId],
        relationName: 'seedGenreForRadioChannels',
    }),
    radioChannelTracks: many(radioChannelTracks),
}));

export const radioChannelTrackRelations = relations(radioChannelTracks, ({ one }) => ({
    radioChannel: one(radioChannels, {
        fields: [radioChannelTracks.channelId],
        references: [radioChannels.channelId],
    }),
    track: one(tracks, {
        fields: [radioChannelTracks.trackId],
        references: [tracks.trackId],
    }),
}));

export const discoveryPlaylistRelations = relations(discoveryPlaylists, ({ one, many }) => ({
  user: one(users, {
    fields: [discoveryPlaylists.userId],
    references: [users.userId],
  }),
  seedArtist: one(artists, {
    fields: [discoveryPlaylists.seedArtistId],
    references: [artists.artistId],
    relationName: 'seedArtistForDiscoveryPlaylists',
  }),
  discoveryPlaylistTracks: many(discoveryPlaylistTracks),
}));

export const discoveryPlaylistTrackRelations = relations(discoveryPlaylistTracks, ({ one }) => ({
  discoveryPlaylist: one(discoveryPlaylists, {
    fields: [discoveryPlaylistTracks.discoveryPlaylistId],
    references: [discoveryPlaylists.discoveryPlaylistId],
  }),
  track: one(tracks, {
    fields: [discoveryPlaylistTracks.trackId],
    references: [tracks.trackId],
  }),
}));

// Note: MediaFolder relations are primarily through userRelations. 
// If direct relations from mediaFolders to other entities are needed, they can be added here.
// For example:
// export const mediaFolderRelations = relations(mediaFolders, ({ one }) => ({
//   user: one(users, {
//     fields: [mediaFolders.userId],
//     references: [users.userId],
//   }),
// }));
