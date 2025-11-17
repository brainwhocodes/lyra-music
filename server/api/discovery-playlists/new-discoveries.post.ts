import { defineEventHandler, readBody } from 'h3';
import { db } from '~/server/db';
import * as schema from '~/server/db/schema';
import { updateUserNewDiscoveriesPlaylist } from '~/server/services/playlist-manager/new-discoveries-manager';

export default defineEventHandler(async (event) => {
  const body = await readBody(event);
  const userId = body.userId as string; // TODO: Get userId from authenticated session

  if (!userId) {
    event.node.res.statusCode = 400;
    return { error: 'User ID is required.' };
  }

  try {
    const result = await updateUserNewDiscoveriesPlaylist(db, userId);

    if (!result.success) {
      event.node.res.statusCode = 500;
      return { error: result.message, details: result.error };
    }
    
    // If successful but no tracks found, it's not an error, but a specific outcome.
    if (result.trackCount === 0 && result.discoveryPlaylistId === undefined) {
        event.node.res.statusCode = 200;
        return { message: result.message, playlistId: null, trackCount: 0 };
    }

    event.node.res.statusCode = 200;
    return {
      message: result.message,
      discoveryPlaylistId: result.discoveryPlaylistId,
      trackCount: result.trackCount,
    };

  } catch (error: any) { // Catch any unexpected errors from the handler itself
    console.error('Unhandled error in New Discoveries API handler:', error);
    event.node.res.statusCode = 500;
    return { error: 'Internal server error.', details: error.message };
  }
});
