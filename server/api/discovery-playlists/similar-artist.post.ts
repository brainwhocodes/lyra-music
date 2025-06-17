import { defineEventHandler, readBody } from 'h3';
import { db } from '~/server/db';
import * as schema from '~/server/db/schema';
import { generateSimilarArtistPlaylist } from '~/server/services/playlist-builder/similar-artist';
import { eq, and } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { DateTime } from 'luxon';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = body.userId as string; // TODO: Get userId from authenticated session
  const seedArtistId = body.seedArtistId as string;

  if (!userId || !seedArtistId) {
    event.node.res.statusCode = 400;
    return { error: 'User ID and Seed Artist ID are required.' };
  }

  try {
    // Fetch seed artist's name for the playlist title
    const seedArtist = await db.query.artists.findFirst({
      where: eq(schema.artists.artistId, seedArtistId),
      columns: { name: true },
    });

    if (!seedArtist) {
      event.node.res.statusCode = 404;
      return { error: 'Seed artist not found.' };
    }

    const trackIds = await generateSimilarArtistPlaylist(db, userId, seedArtistId);

    if (!trackIds || trackIds.length === 0) {
      return { message: 'No similar tracks found at this time or playlist could not be generated.', playlistId: null };
    }

    const playlistTitle = `Similar to ${seedArtist.name}`;
    const playlistType = 'similar_to_artist';
    const currentTimestamp = DateTime.now().toISO(); // Use luxon

    // Upsert the playlist entry
    // Unique index is on (userId, type, seedArtistId) for this type
    const upsertedPlaylist = await db.insert(schema.discoveryPlaylists)
      .values({
        discoveryPlaylistId: uuidv7(),
        userId: userId,
        title: playlistTitle,
        type: playlistType,
        seedArtistId: seedArtistId, // Store the seed artist ID
        lastGeneratedAt: currentTimestamp,
        createdAt: currentTimestamp,
        updatedAt: currentTimestamp,
      })
      .onConflictDoUpdate({
        target: [schema.discoveryPlaylists.userId, schema.discoveryPlaylists.type, schema.discoveryPlaylists.seedArtistId],
        set: {
          title: playlistTitle, // Title might change if artist name changes, though unlikely
          lastGeneratedAt: currentTimestamp,
          updatedAt: currentTimestamp,
        },
      })
      .returning({ discoveryPlaylistId: schema.discoveryPlaylists.discoveryPlaylistId });

    const discoveryPlaylistId = upsertedPlaylist[0]?.discoveryPlaylistId;

    if (!discoveryPlaylistId) {
      event.node.res.statusCode = 500;
      return { error: 'Failed to create or update discovery playlist entry.' };
    }

    // Clear existing tracks for this playlist
    await db.delete(schema.discoveryPlaylistTracks)
      .where(eq(schema.discoveryPlaylistTracks.discoveryPlaylistId, discoveryPlaylistId));

    // Insert new tracks
    if (trackIds.length > 0) {
      const playlistTracksData = trackIds.map((trackId, index) => ({
        discoveryPlaylistTrackId: uuidv7(),
        discoveryPlaylistId: discoveryPlaylistId,
        trackId: trackId,
        order: index,
        addedAt: currentTimestamp,
      }));
      await db.insert(schema.discoveryPlaylistTracks).values(playlistTracksData);
    }

    event.node.res.statusCode = 200;
    return {
      message: `Playlist 'Similar to ${seedArtist.name}' generated successfully.`,
      discoveryPlaylistId: discoveryPlaylistId,
      trackCount: trackIds.length,
    };

  } catch (error: any) {
    console.error(`Error generating Similar Artist playlist for seed ${seedArtistId}:`, error);
    event.node.res.statusCode = 500;
    return { error: 'Internal server error.', details: error.message };
  }
});
