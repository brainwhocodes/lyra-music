import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { and, eq } from 'drizzle-orm';
import { db } from '~/server/db';
import { playlists, playlistTracks } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { getPlaylistDetail } from '~/server/utils/playlist-detail';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  const body = await readBody<{ playlistTrackIds?: unknown }>(event);
  if (!Array.isArray(body?.playlistTrackIds) || body.playlistTrackIds.some(id => typeof id !== 'string')) {
    throw createError({ statusCode: 400, statusMessage: 'Playlist track IDs must be an array of strings' });
  }
  const playlistTrackIds = body.playlistTrackIds as string[];
  // better-sqlite3 transactions are synchronous. Validate the complete permutation before any write.
  db.transaction(tx => {
    const playlist = tx.select().from(playlists).where(and(eq(playlists.playlistId, playlistId), eq(playlists.userId, user.userId))).get();
    if (!playlist) throw createError({ statusCode: 404, statusMessage: 'Playlist not found' });
    const existing = tx.select({ id: playlistTracks.playlistTrackId }).from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId)).all();
    const supplied = new Set(playlistTrackIds);
    if (supplied.size !== playlistTrackIds.length || existing.length !== playlistTrackIds.length || existing.some(entry => !supplied.has(entry.id))) {
      throw createError({ statusCode: 400, statusMessage: 'Provide every playlist track exactly once' });
    }
    const updatedAt = new Date().toISOString();
    playlistTrackIds.forEach((id, order) => tx.update(playlistTracks).set({ order, updatedAt }).where(eq(playlistTracks.playlistTrackId, id)).run());
    tx.update(playlists).set({ updatedAt }).where(eq(playlists.playlistId, playlistId)).run();
  });
  return getPlaylistDetail(playlistId, user.userId);
});
