import { createError, defineEventHandler, getRouterParam } from 'h3';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { discoveryPlaylists, discoveryPlaylistTracks } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { collectionTrackRelations, formatCollectionTrack } from '~/server/utils/playlist-detail';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  const playlist = await db.query.discoveryPlaylists.findFirst({
    where: and(eq(discoveryPlaylists.discoveryPlaylistId, playlistId), eq(discoveryPlaylists.userId, user.userId)),
    with: {
      discoveryPlaylistTracks: {
        orderBy: [asc(discoveryPlaylistTracks.order)],
        with: { track: { with: collectionTrackRelations } },
      },
    },
  });
  if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Discovery playlist not found' });
  const { discoveryPlaylistTracks: entries, ...details } = playlist;
  return { ...details, trackCount: entries.length, tracks: entries.map(entry => ({ ...entry, track: formatCollectionTrack(entry.track) })) };
});
