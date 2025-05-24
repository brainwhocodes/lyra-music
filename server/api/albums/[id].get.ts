// server/api/albums/[id].get.ts

import { H3Event, defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks } from '~/server/db/schema';
import { eq, asc } from 'drizzle-orm';
import { useCoverArt } from '~/composables/use-cover-art';

export default defineEventHandler(async (event: H3Event) => {
  const albumIdParam = event.context.params?.id;
  
  if (!albumIdParam) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid Album ID is required',
    });
  }

  const albumId = albumIdParam;

  try {
    const albumData = await db.select({
      albumId: albums.albumId,
      title: albums.title,
      year: albums.year,
      coverPath: albums.coverPath,
      artistId: albums.artistId,
      artistName: artists.name
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.artistId))
    .where(eq(albums.albumId, albumId))
    .get();

    // Check if album was found
    if (!albumData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Album not found',
      });
    }

    const tracksData = await db.select({
      trackId: tracks.trackId,
      title: tracks.title,
      track_number: tracks.trackNumber,
      duration: tracks.duration,
      file_path: tracks.filePath,
    })
    .from(tracks)
    .where(eq(tracks.albumId, albumId))
    .orderBy(asc(tracks.trackNumber))
    .all();

    const { getCoverArtUrl } = useCoverArt();

    // Format the final result object
    const result = {
      albumId: albumData.albumId,
      title: albumData.title,
      year: albumData.year,
      coverPath: getCoverArtUrl(albumData.coverPath),
      artistId: albumData.artistId,
      artistName: albumData.artistName ?? 'Unknown Artist',
      tracks: tracksData?.map(track => ({
        trackId: track.trackId,
        title: track.title,
        trackNumber: track.track_number,
        duration: track.duration,
        artistName: albumData.artistName ?? 'Unknown Artist',
        albumTitle: albumData.title ?? 'Unknown Album',
        filePath: track.file_path,
      })) ?? []
    };

    return result;

  } catch (error: any) {
    // Handle potential errors
    if (error.statusCode) {
      throw error;
    }
    console.error("Error processing album request:", error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing request',
    });
  }
});
