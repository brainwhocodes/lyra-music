// File: c:/Users/mille/Documents/otogami/server/api/albums/[id].get.ts

import { H3Event } from 'h3';
import { db } from '~/server/db';
import { albums, artists, tracks } from '~/server/db/schema';
import { eq, asc } from 'drizzle-orm';

export default defineEventHandler(async (event: H3Event) => {
  const albumIdParam = event.context.params?.id;

  if (!albumIdParam || isNaN(parseInt(albumIdParam))) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Valid Album ID is required',
    });
  }

  const albumId = parseInt(albumIdParam);

  try {
    const albumData = await db.select({
      id: albums.id,
      title: albums.title,
      year: albums.year,
      cover_path: albums.artPath, // Adjust column name if needed
      artist_id: albums.artistId,
      artist_name: artists.name
    })
    .from(albums)
    .leftJoin(artists, eq(albums.artistId, artists.id))
    .where(eq(albums.id, albumId))
    .get()

    const tracksData = await db.select({
      id: tracks.id,
      title: tracks.title,
      track_number: tracks.trackNumber, // Adjust column name
      duration: tracks.duration,
      file_path: tracks.filePath, // Adjust column name
      // Removed potentially non-existent columns. The formatting logic below handles these.
    })
    .from(tracks)
    .where(eq(tracks.albumId, albumId))
    .orderBy(asc(tracks.trackNumber))
    .all() // .all() for multiple results

    // Check if album was found
    if (!albumData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Album not found',
      });
    }

    // Format the final result object
    const result = {
      id: albumData.id,
      title: albumData.title,
      year: albumData.year,
      coverPath: albumData.cover_path,
      artistId: albumData.artist_id,
      artistName: albumData.artist_name ?? 'Unknown Artist',
      tracks: tracksData?.map(track => ({
        id: track.id,
        title: track.title,
        trackNumber: track.track_number,
        duration: track.duration,
        // Use albumData for artist/album name as primary source, tracks might not have it
        artistName: albumData.artist_name ?? 'Unknown Artist',
        albumTitle: albumData.title ?? 'Unknown Album',
        filePath: track.file_path,
      })) ?? []
    };

    console.log("Album details:", result);
    // Validate and return
    return result;

  } catch (error: any) {
    // Handle potential errors from Promise.all or validation
    if (error.statusCode) { // Re-throw H3 errors
        throw error;
    }
    console.error("Error processing album request:", error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error processing request',
    });
  }
});