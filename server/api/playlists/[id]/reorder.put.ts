import { defineEventHandler, readBody, getRouterParam } from 'h3';
import { eq, inArray, and, asc } from 'drizzle-orm';
import { db } from '~/server/db'; // Assuming db instance is here
import { playlists, playlistTracks, tracks, users, artists, albums } from '~/server/db/schema';
import type { Playlist } from '~/types/playlist'; // Assuming a global Playlist type

interface ReorderPlaylistTracksBody {
  playlistTrackIds: string[];
}

export default defineEventHandler(async (event): Promise<Playlist> => {
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Playlist ID is required',
    });
  }

  const { playlistTrackIds } = await readBody<ReorderPlaylistTracksBody>(event);

  if (!Array.isArray(playlistTrackIds) || playlistTrackIds.length === 0 || playlistTrackIds.some(id => typeof id !== 'string')) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Invalid playlistTrackIds: Must be a non-empty array of strings.',
    });
  }

  try {
    await db.transaction(async (tx) => {
      // 1. Verify that the playlist exists
      const existingPlaylist = await tx.select({ id: playlists.playlistId })
        .from(playlists)
        .where(eq(playlists.playlistId, playlistId))
        .get(); // .get() for SQLite to expect a single row or null

      if (!existingPlaylist) {
        throw createError({
          statusCode: 404,
          statusMessage: 'Playlist not found',
        });
      }

      // 2. Verify all playlist tracks belong to the specified playlist
      const tracksInDb = await tx.select({ playlistTrackId: playlistTracks.playlistTrackId })
        .from(playlistTracks)
        .where(and(
          eq(playlistTracks.playlistId, playlistId),
          inArray(playlistTracks.playlistTrackId, playlistTrackIds)
        ))
        .all(); // .all() for SQLite to get all matching rows

      if (tracksInDb.length !== playlistTrackIds.length) {
        // This means some provided IDs don't exist in the playlist or don't belong to it.
        const foundIds = new Set(tracksInDb.map(t => t.playlistTrackId));
        const missingOrUnmatchedIds = playlistTrackIds.filter(id => !foundIds.has(id));
        throw createError({
          statusCode: 400,
          statusMessage: `One or more tracks do not belong to this playlist or do not exist. Problematic IDs: ${missingOrUnmatchedIds.join(', ')}`,
        });
      }

      // 3. Update the order for each track
      const updatePromises = playlistTrackIds.map((id, index) =>
        tx.update(playlistTracks)
          .set({ order: index })
          .where(eq(playlistTracks.playlistTrackId, id))
          .run() // .run() for SQLite update/insert/delete without returning data
      );
      await Promise.all(updatePromises);
    }); // End of transaction

    // 4. Return the updated playlist with tracks in the new order
    // This query needs to be carefully constructed to match the frontend's Playlist type.
    // It requires joining playlistTracks with tracks, and tracks with artists/albums.
    const updatedPlaylistData = await db.query.playlists.findFirst({
      where: eq(playlists.playlistId, playlistId),
      with: {
        user: {
          columns: {
            userId: true,
            name: true,
          }
        },
        playlistTracks: {
          columns: {
            playlistTrackId: true,
            addedAt: true,
            order: true
          },
          orderBy: [asc(playlistTracks.order)],
          with: {
            track: {
              columns: {
                trackId: true,
                title: true,
                duration: true,
                filePath: true,
                genre: true,      // Added
                year: true,       // Added
                trackNumber: true,// Added
                diskNumber: true, // Added
                explicit: true,   // Added
                createdAt: true,  // Added
                updatedAt: true,  // Added
                // albumId and artistId are implicitly handled by relations if needed directly on track, but usually accessed via track.album.albumId etc.
              },
              with: {
                artist: { // Assuming 'artist' relation on 'tracks' table for primary artist
                  columns: {
                    artistId: true,
                    name: true,
                  }
                },
                album: { // Assuming 'album' relation on 'tracks' table
                  columns: {
                    albumId: true,
                    title: true,
                    coverPath: true, // coverPath is on albums table
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!updatedPlaylistData) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to retrieve updated playlist after reorder.',
      });
    }

    // Map to the frontend Playlist structure if necessary.
    // The Drizzle result structure might be slightly different.
    // For now, let's assume it's compatible or can be cast.
    // The frontend expects PlaylistTrack.track to be the full Track object.
    // Drizzle's relational queries usually nest things correctly.
    
    const result: Playlist = {
      playlistId: updatedPlaylistData.playlistId,
      name: updatedPlaylistData.name,
      userId: updatedPlaylistData.userId,
      createdAt: updatedPlaylistData.createdAt ? new Date(updatedPlaylistData.createdAt).toISOString() : '',
      updatedAt: updatedPlaylistData.updatedAt ? new Date(updatedPlaylistData.updatedAt).toISOString() : '',
      user: updatedPlaylistData.user ? {
        userId: updatedPlaylistData.user.userId,
        name: updatedPlaylistData.user.name,
        // Add other user fields if present in global User type and needed
      } : undefined,
      tracks: updatedPlaylistData.playlistTracks.map(pt => ({
        playlistTrackId: pt.playlistTrackId,
        playlistId: updatedPlaylistData.playlistId, // Add playlistId here
        trackId: pt.track.trackId,
        order: pt.order ?? 0, // Ensure order is a number
        addedAt: pt.addedAt ? new Date(pt.addedAt).toISOString() : '',
        track: {
          trackId: pt.track.trackId,
          title: pt.track.title,
          artistName: pt.track.artist?.name ?? 'Unknown Artist',
          albumId: pt.track.album?.albumId ?? null,
          albumTitle: pt.track.album?.title ?? 'Unknown Album',
          duration: pt.track.duration ?? 0,
          filePath: pt.track.filePath ?? '',
          coverPath: pt.track.album?.coverPath ?? null, // from album
          // Fill in other Track fields as per global Track type
          trackNumber: pt.track.trackNumber ?? null,
          artistId: pt.track.artist?.artistId ?? null,
          genre: pt.track.genre ?? null,
          year: pt.track.year ?? null,
          diskNumber: pt.track.diskNumber ?? null,
          explicit: pt.track.explicit ?? false,
          createdAt: pt.track.createdAt ? new Date(pt.track.createdAt).toISOString() : '',
          updatedAt: pt.track.updatedAt ? new Date(pt.track.updatedAt).toISOString() : '',
        }
      })),
    };

    return result;

  } catch (error: any) {
    // console.error('Error reordering playlist tracks:', error); // Per user preference, remove console.logs
    if (error.statusCode && error.statusMessage) { // Re-throw errors created with createError
        throw error;
    }
    throw createError({
      statusCode: 500,
      statusMessage: error.message || 'An unexpected error occurred while reordering tracks.',
    });
  }
});
