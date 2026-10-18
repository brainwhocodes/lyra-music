import { and, asc, desc, eq } from 'drizzle-orm';
import { createError } from 'h3';
import { db } from '~/server/db';
import { artistsTracks, playlists, playlistTracks } from '~/server/db/schema';
import type { Track } from '~/types/track';

// A track may have several credits. Keep one queue entry and expose all artists.
export const collectionTrackRelations = {
  album: true,
  artistsTracks: {
    orderBy: [desc(artistsTracks.isPrimaryArtist), asc(artistsTracks.artistId)],
    with: { artist: true },
  },
} as const;

type CollectionTrack = typeof import('~/server/db/schema').tracks.$inferSelect & {
  album: { title: string; coverPath: string | null } | null;
  artistsTracks: Array<{ role: string | null; isPrimaryArtist: number; artist: { artistId: string; name: string } }>;
};

export function formatCollectionTrack(row: CollectionTrack): Track {
  const { album, artistsTracks: credits, ...track } = row;
  return {
    ...track,
    musicbrainzTrackId: track.musicbrainzTrackId ?? undefined,
    albumTitle: album?.title,
    coverPath: album?.coverPath ?? null,
    artistId: credits[0]?.artist.artistId ?? null,
    artistName: credits[0]?.artist.name,
    artists: credits.map(credit => ({
      artistId: credit.artist.artistId, name: credit.artist.name,
      role: credit.role ?? undefined, isPrimaryArtist: Boolean(credit.isPrimaryArtist),
    })),
  };
}

export async function getPlaylistDetail(playlistId: string, userId: string) {
  const result = await db.query.playlists.findFirst({
    where: and(eq(playlists.playlistId, playlistId), eq(playlists.userId, userId)),
    with: {
      playlistTracks: {
        orderBy: [asc(playlistTracks.order), asc(playlistTracks.playlistTrackId)],
        with: { track: { with: collectionTrackRelations } },
      },
    },
  });
  if (!result) throw createError({ statusCode: 404, statusMessage: 'Playlist not found' });
  const { playlistTracks: entries, ...playlist } = result;
  return {
    ...playlist,
    trackCount: entries.length,
    tracks: entries.map(entry => ({ ...entry, order: entry.order ?? 0, track: formatCollectionTrack(entry.track) })),
  };
}
