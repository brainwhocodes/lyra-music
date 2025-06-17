import { type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { schema } from '~/server/db'; // Assuming schema is available from here
import { generateNewDiscoveriesPlaylist } from '~/server/services/playlist-builder/new-discoveries';
import { eq, and } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DateTime } from 'luxon';

export interface PlaylistUpdateResult {
  success: boolean;
  message: string;
  discoveryPlaylistId?: string;
  trackCount?: number;
  error?: string;
}

/**
 * Generates (or updates) the "New Discoveries" playlist for a specific user using Drizzle ORM.
 * This includes generating track IDs, and then saving the playlist and its tracks to the database.
 *
 * @param db Drizzle ORM database instance for BetterSQLite3.
 * @param userId The ID of the user.
 * @returns A promise resolving to the outcome of the operation.
 */
export async function updateUserNewDiscoveriesPlaylist(
  db: BetterSQLite3Database<typeof schema>,
  userId: string
): Promise<PlaylistUpdateResult> {
  try {
    // generateNewDiscoveriesPlaylist now also expects a Drizzle db instance
    const trackIds = await generateNewDiscoveriesPlaylist(db, userId);

    if (!trackIds || trackIds.length === 0) {
      return {
        success: true,
        message: 'No new discoveries found at this time or playlist could not be generated.',
        discoveryPlaylistId: undefined,
        trackCount: 0,
      };
    }

    const playlistTitle = 'New Discoveries';
    const playlistType = 'new_discoveries';
    const currentTimestamp = DateTime.now().toISO();
    if (!currentTimestamp) {
        console.error('Failed to get current timestamp for playlist update.');
        return {
            success: false,
            message: 'Failed to get current timestamp.',
        };
    }

    // Upsert logic for discoveryPlaylists
    const upsertResult = await db.insert(schema.discoveryPlaylists)
      .values({
        discoveryPlaylistId: uuidv7(), // Provide a new ID for potential insert
        userId: userId,
        title: playlistTitle,
        type: playlistType,
        lastGeneratedAt: currentTimestamp,
        createdAt: currentTimestamp, // Set on insert
        updatedAt: currentTimestamp, // Set on insert and update
      })
      .onConflictDoUpdate({
        target: [schema.discoveryPlaylists.userId, schema.discoveryPlaylists.type, schema.discoveryPlaylists.title],
        set: {
          lastGeneratedAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
      })
      .returning({ discoveryPlaylistId: schema.discoveryPlaylists.discoveryPlaylistId });

    let discoveryPlaylistId: string | undefined;
    if (upsertResult && upsertResult.length > 0 && upsertResult[0].discoveryPlaylistId) {
      discoveryPlaylistId = upsertResult[0].discoveryPlaylistId;
    } else {
      // If RETURNING didn't give an ID (e.g., on conflict update without returning the existing ID in some older Drizzle/SQLite versions),
      // or if it was an update and we need the existing ID, we select it.
      const existingPlaylist = await db.select({ discoveryPlaylistId: schema.discoveryPlaylists.discoveryPlaylistId })
        .from(schema.discoveryPlaylists)
        .where(and(
          eq(schema.discoveryPlaylists.userId, userId),
          eq(schema.discoveryPlaylists.type, playlistType),
          eq(schema.discoveryPlaylists.title, playlistTitle)
        ))
        .limit(1);
      if (existingPlaylist.length > 0) {
        discoveryPlaylistId = existingPlaylist[0].discoveryPlaylistId;
      }
    }

    if (!discoveryPlaylistId) {
      return {
        success: false,
        message: 'Failed to create or update discovery playlist entry. Could not retrieve playlist ID.',
        error: 'No discoveryPlaylistId found after upsert operation.',
      };
    }

    // Use a transaction for deleting old tracks and inserting new ones
    await db.transaction(async (tx) => {
      // Delete old tracks for this playlist
      await tx.delete(schema.discoveryPlaylistTracks)
        .where(eq(schema.discoveryPlaylistTracks.discoveryPlaylistId, discoveryPlaylistId!));

      if (trackIds.length > 0) {
        const playlistTracksData = trackIds.map((trackId, index) => ({
          discoveryPlaylistTrackId: uuidv7(),
          discoveryPlaylistId: discoveryPlaylistId!,
          trackId: trackId,
          order: index,
          addedAt: currentTimestamp,
        }));
        await tx.insert(schema.discoveryPlaylistTracks).values(playlistTracksData);
      }
    });

    return {
      success: true,
      message: 'New Discoveries playlist generated/updated successfully.',
      discoveryPlaylistId: discoveryPlaylistId,
      trackCount: trackIds.length,
    };

  } catch (error: any) {
    console.error(`Error updating New Discoveries playlist for user ${userId}:`, error);
    return {
      success: false,
      message: 'Internal server error during playlist update.',
      error: error.message,
    };
  }
}
