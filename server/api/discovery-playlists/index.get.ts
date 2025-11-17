import { defineEventHandler } from 'h3';
import { db } from '~/server/db';
import { discoveryPlaylists, discoveryPlaylistTracks } from '~/server/db/schema';
import { eq, count } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);

  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  try {
    const playlists = await db
      .select({
        discoveryPlaylistId: discoveryPlaylists.discoveryPlaylistId,
        title: discoveryPlaylists.title,
        type: discoveryPlaylists.type,
        seedArtistId: discoveryPlaylists.seedArtistId,
        trackCount: count(discoveryPlaylistTracks.trackId),
        lastGeneratedAt: discoveryPlaylists.lastGeneratedAt,
        createdAt: discoveryPlaylists.createdAt,
        updatedAt: discoveryPlaylists.updatedAt,
      })
      .from(discoveryPlaylists)
      .leftJoin(
        discoveryPlaylistTracks,
        eq(
          discoveryPlaylists.discoveryPlaylistId,
          discoveryPlaylistTracks.discoveryPlaylistId
        )
      )
      .where(eq(discoveryPlaylists.userId, user.userId))
      .groupBy(
        discoveryPlaylists.discoveryPlaylistId,
        discoveryPlaylists.title,
        discoveryPlaylists.type,
        discoveryPlaylists.seedArtistId,
        discoveryPlaylists.lastGeneratedAt,
        discoveryPlaylists.createdAt,
        discoveryPlaylists.updatedAt
      )
      .orderBy(discoveryPlaylists.updatedAt);

    return playlists;
  } catch (error) {
    console.error('Error fetching discovery playlists:', error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch discovery playlists',
    });
  }
});
