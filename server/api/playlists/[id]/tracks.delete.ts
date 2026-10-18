import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '~/server/db';
import { playlists, playlistTracks } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { getPlaylistDetail } from '~/server/utils/playlist-detail';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  const body = await readBody<{ trackIds?: unknown }>(event);
  if (!Array.isArray(body?.trackIds) || !body.trackIds.length || body.trackIds.some(id => typeof id !== 'string' || !id)) {
    throw createError({ statusCode: 400, statusMessage: 'At least one valid track ID is required' });
  }
  const trackIds = body.trackIds as string[];
  db.transaction(tx => {
    const playlist = tx.select().from(playlists).where(and(eq(playlists.playlistId, playlistId), eq(playlists.userId, user.userId))).get();
    if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist not found' });
    tx.delete(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), inArray(playlistTracks.trackId, trackIds))).run();
    const remaining = tx.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId)).orderBy(asc(playlistTracks.order)).all();
    const updatedAt = new Date().toISOString();
    remaining.forEach((entry, order) => tx.update(playlistTracks).set({ order, updatedAt }).where(eq(playlistTracks.playlistTrackId, entry.playlistTrackId)).run());
    tx.update(playlists).set({ updatedAt }).where(eq(playlists.playlistId, playlistId)).run();
  });
  return getPlaylistDetail(playlistId, user.userId);
});
