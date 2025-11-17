import { H3Event, defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks, albumArtists } from '~/server/db/schema';
import { eq, asc, and, inArray } from 'drizzle-orm';
import { useCoverArt } from '~/composables/use-cover-art';
import { getUserFromEvent } from '~/server/utils/auth';

import type { AlbumArtistDetail, Album as ApiAlbumResponse } from '~/types/album';
import type { TrackArtistDetail, Track as ApiTrack } from '~/types/track';
import { artistsTracks } from '~/server/db/schema';

export default defineEventHandler(async (event: H3Event) => {
  const albumId = event.context.params?.id;
  if (!albumId) {
    throw createError({ statusCode: 400, statusMessage: 'Album ID is required' });
  }

  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    // 1) Fetch basic album details
    const albumData = await db
      .select({
        albumId:   albums.albumId,
        title:     albums.title,
        year:      albums.year,
        coverPath: albums.coverPath,
      })
      .from(albums)
      .where(and(eq(albums.albumId, albumId), eq(albums.userId, user.userId))) // Ensure user owns the album
      .get();

    if (!albumData) {
      throw createError({ statusCode: 404, statusMessage: 'Album not found or not authorized' });
    }

    // 2) Fetch all artists for the album
    const rawAlbumArtists = await db
      .select({
        artistId: artists.artistId,
        name: artists.name,
        role: albumArtists.role,
        isPrimaryArtistDb: albumArtists.isPrimaryArtist,
      })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .where(eq(albumArtists.albumId, albumId))
      .all();

    const albumArtistDetails: AlbumArtistDetail[] = rawAlbumArtists.map(a => ({
      artistId: a.artistId,
      name: a.name,
      role: a.role ?? undefined, // Use nullish coalescing
      isPrimaryArtist: a.isPrimaryArtistDb === 1,
    }));

    // 3) Fetch all tracks for that album, and for each track, its artists
    const trackRows = await db
      .select({
        trackId:     tracks.trackId,
        title:       tracks.title,
        trackNumber: tracks.trackNumber,
        duration:    tracks.duration,
        filePath:    tracks.filePath,
        genre:       tracks.genre,
        year:        tracks.year,
        diskNumber:  tracks.diskNumber,
        explicit:    tracks.explicit,
        musicbrainzTrackId: tracks.musicbrainzTrackId,
        createdAt:   tracks.createdAt,
        updatedAt:   tracks.updatedAt,
      })
      .from(tracks)
      .where(eq(tracks.albumId, albumId))
      .orderBy(asc(tracks.trackNumber))
      .all();

    const tracksWithArtists: ApiTrack[] = [];
    if (trackRows.length > 0) {
      const trackIds = trackRows.map(t => t.trackId!);

      const allTrackArtistLinks = await db
        .select({
          trackId: artistsTracks.trackId,
          artistId: artists.artistId,
          name: artists.name,
          roleDb: artistsTracks.role,
          isPrimaryArtistDb: artistsTracks.isPrimaryArtist,
        })
        .from(artistsTracks)
        .innerJoin(artists, eq(artistsTracks.artistId, artists.artistId))
        .where(inArray(artistsTracks.trackId, trackIds))
        .all();

      const trackArtistsMap = new Map<string, TrackArtistDetail[]>();
      for (const link of allTrackArtistLinks) {
        const currentTrackId = link.trackId!;
        if (!trackArtistsMap.has(currentTrackId)) {
          trackArtistsMap.set(currentTrackId, []);
        }
        trackArtistsMap.get(currentTrackId)!.push({
          artistId: link.artistId,
          name: link.name,
          role: link.roleDb ?? undefined, // Use nullish coalescing
          isPrimaryArtist: link.isPrimaryArtistDb === 1,
        });
      }

      for (const t of trackRows) {
        const artistDetails = trackArtistsMap.get(t.trackId!) || [];
        tracksWithArtists.push({
          trackId:     t.trackId!,
          title:       t.title!,
          albumId:     albumData.albumId,
          artists:     artistDetails,
          trackNumber: t.trackNumber,
          duration:    t.duration,
          filePath:    t.filePath,
          genre:       t.genre,
          year:        t.year,
          diskNumber:  t.diskNumber,
          explicit:    t.explicit,
          coverPath:   undefined,
          musicbrainzTrackId: t.musicbrainzTrackId ?? undefined, // Use nullish coalescing
          createdAt:   t.createdAt,
          updatedAt:   t.updatedAt,
        });
      }
    }

    // 4) Build the response
    const { getCoverArtUrl } = useCoverArt();
    const response: ApiAlbumResponse = {
      albumId:   albumData.albumId,
      title:     albumData.title,
      year:      albumData.year,
      coverPath: getCoverArtUrl(albumData.coverPath),
      artists:   albumArtistDetails,
      tracks:    tracksWithArtists,
    };
    return response;
  } catch (error) {
    // Log more detailed error information
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`Error processing album request for ID ${albumId}: ${errorMessage}`, { originalError: error });
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing request', // Keep user-facing message generic
    });
  }
});