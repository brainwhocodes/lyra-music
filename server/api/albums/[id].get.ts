import { H3Event, defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks, albumArtists } from '~/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { useCoverArt } from '~/composables/use-cover-art';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event: H3Event) => {
  const albumIdParam = event.context.params?.id;

  if (!albumIdParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Album ID is required',
    });
  }

  const user = getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const albumId = albumIdParam;

  try {
    const data = await db
      .select({
        albumId: albums.albumId,
        albumTitle: albums.title,
        albumYear: albums.year,
        coverPath: albums.coverPath,
        artistId: artists.artistId, // Primary album artist
        artistName: artists.name,   // Primary album artist name
        trackId: tracks.trackId,
        trackTitle: tracks.title,
        trackNumber: tracks.trackNumber,
        trackDuration: tracks.duration,
        trackFilePath: tracks.filePath,
        trackGenre: tracks.genre,                 // Added
        trackSpecificYear: tracks.year,           // Added (track's own year)
        trackDiskNumber: tracks.diskNumber,       // Added
        trackCreatedAt: tracks.createdAt,         // Added
        trackUpdatedAt: tracks.updatedAt,         // Added
        trackArtistId: tracks.artistId,           // Added (track's own artistId)
      })
      .from(albums)
      .leftJoin(albumArtists, and(eq(albums.albumId, albumArtists.albumId), eq(albumArtists.isPrimaryArtist, 1)))
      .leftJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .leftJoin(tracks, eq(albums.albumId, tracks.albumId))
      .where(and(eq(albums.albumId, albumId), eq(albums.userId, user.userId)))
      .orderBy(asc(tracks.trackNumber))
      .all();

    if (data.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Album not found or not authorized',
      });
    }

    const { getCoverArtUrl } = useCoverArt();

    const base = data[0];
    const result = {
      albumId: base.albumId,
      title: base.albumTitle,
      year: base.albumYear,
      coverPath: getCoverArtUrl(base.coverPath),
      artistId: base.artistId,
      artistName: base.artistName ?? 'Unknown Artist',
      tracks: data
        .filter(row => row.trackId !== null)
        .map(row => ({
          trackId: row.trackId!,
          title: row.trackTitle!,
          trackNumber: row.trackNumber!,
          duration: row.trackDuration!,
          filePath: row.trackFilePath!,
          // Use album's primary artist as a fallback if track specific artist info isn't fully joined/needed yet
          // For now, the Track type on frontend expects artistName, so we provide the album's primary artist name.
          // The trackArtistId is available if more specific linking is needed later.
          artistName: row.artistName ?? 'Unknown Artist', 
          albumTitle: base.albumTitle,
          genre: row.trackGenre,                   // Added
          year: row.trackSpecificYear ?? base.albumYear, // Prefer track year, fallback to album year
          diskNumber: row.trackDiskNumber,         // Added
          createdAt: row.trackCreatedAt,           // Added
          updatedAt: row.trackUpdatedAt,           // Added
          // Add trackArtistId to the returned track object, frontend can use it if needed
          artistId: row.trackArtistId ?? base.artistId, // Prefer track's artistId, fallback to album's primary artistId
        })),
    };

    return result;
  } catch (error: any) {
    if (error.statusCode) throw error;

    console.error('Error processing album request:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing request',
    });
  }
});
