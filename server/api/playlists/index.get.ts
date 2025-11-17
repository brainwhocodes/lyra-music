import { defineEventHandler } from 'h3';
import { db } from '~/server/db';
import { playlists, playlistTracks } from '~/server/db/schema';
import { eq, count } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);
  
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }
  
  try {
    const userPlaylists = await db
      .select({
        playlistId: playlists.playlistId,
        name: playlists.name,
        trackCount: count(playlistTracks.trackId),
        createdAt: playlists.createdAt,
        updatedAt: playlists.updatedAt,
      })
      .from(playlists)
      .leftJoin(playlistTracks, eq(playlists.playlistId, playlistTracks.playlistId))
      .where(eq(playlists.userId, user.userId))
      .groupBy(
        playlists.playlistId,
        playlists.name,
        playlists.createdAt,
        playlists.updatedAt
      )
      .orderBy(playlists.updatedAt);

    return userPlaylists;
  } catch (error) {
    console.error('Error fetching playlists:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch playlists',
    });
  }
});
