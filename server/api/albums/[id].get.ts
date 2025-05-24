import { H3Event, defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks } from '~/server/db/schema';
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
        artistId: artists.artistId,
        artistName: artists.name,
        trackId: tracks.trackId,
        trackTitle: tracks.title,
        trackNumber: tracks.trackNumber,
        trackDuration: tracks.duration,
        trackFilePath: tracks.filePath,
      })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.artistId))
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
          artistName: row.artistName ?? 'Unknown Artist',
          albumTitle: base.albumTitle,
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
