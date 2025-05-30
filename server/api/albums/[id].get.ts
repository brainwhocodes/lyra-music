import { H3Event, defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks, albumArtists } from '~/server/db/schema';
import { eq, asc, and } from 'drizzle-orm';
import { useCoverArt } from '~/composables/use-cover-art';
import { getUserFromEvent } from '~/server/utils/auth';

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
    // 1) Fetch the album with its primary artist
    const album = await db
      .select({
        albumId:    albums.albumId,
        title:      albums.title,
        year:       albums.year,
        coverPath:  albums.coverPath,
        artistId:   artists.artistId,
        artistName: artists.name,
      })
      .from(albums)
      .leftJoin(
        albumArtists,
        and(eq(albums.albumId, albumArtists.albumId), eq(albumArtists.isPrimaryArtist, 1))
      )
      .leftJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .where(
        and(
          eq(albums.albumId, albumId),
          eq(albums.userId, user.userId)
        )
      )
      .get(); // single-row fetch

    if (!album) {
      throw createError({ statusCode: 404, statusMessage: 'Album not found or not authorized' });
    }

    // 2) Fetch all tracks for that album
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
        createdAt:   tracks.createdAt,
        updatedAt:   tracks.updatedAt,
        artistId:    tracks.artistId,
      })
      .from(tracks)
      .where(eq(tracks.albumId, albumId))
      .orderBy(asc(tracks.trackNumber))
      .all();

    // 3) Build the response
    const { getCoverArtUrl } = useCoverArt();
    return {
      albumId:   album.albumId,
      title:     album.title,
      year:      album.year,
      coverPath: getCoverArtUrl(album.coverPath),
      artistId:  album.artistId,
      artistName: album.artistName ?? 'Unknown Artist',
      tracks: trackRows.map(t => ({
        trackId:     t.trackId!,
        title:       t.title!,
        trackNumber: t.trackNumber!,
        duration:    t.duration!,
        filePath:    t.filePath!,
        artistId:    t.artistId ?? album.artistId,
        artistName:  album.artistName ?? 'Unknown Artist',
        albumTitle:  album.title,
        genre:       t.genre,
        year:        t.year ?? album.year,
        diskNumber:  t.diskNumber,
        createdAt:   t.createdAt,
        updatedAt:   t.updatedAt,
      })),
    };
  } catch (err: any) {
    console.error('Error processing album request:', err);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing request',
    });
  }
});