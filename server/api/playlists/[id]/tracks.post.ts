import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { db } from '~/server/db';
import { playlists, playlistTracks, tracks } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  const body = await readBody(event);
  if (!body || !['add', 'remove'].includes(body.action) || !Array.isArray(body.trackIds) ||
      !body.trackIds.length || body.trackIds.length > 500 || body.trackIds.some((id: unknown) => typeof id !== 'string' || !id || id.length > 200)) {
    throw createError({ statusCode: 400, statusMessage: 'Provide add/remove and 1–500 valid track IDs.' });
  }
  const trackIds = [...new Set<string>(body.trackIds)];
  db.transaction(tx => {
    const owned = and(eq(playlists.playlistId, playlistId), eq(playlists.userId, user.userId));
    if (!tx.select().from(playlists).where(owned).get()) throw createError({ statusCode: 404, statusMessage: 'Playlist not found' });
    // Tracks are shared library content; playlist ownership controls mutations.
    const available = tx.select({ id: tracks.trackId }).from(tracks).where(inArray(tracks.trackId, trackIds)).all();
    if (available.length !== trackIds.length) throw createError({ statusCode: 400, statusMessage: 'One or more tracks do not exist.' });
    const entries = tx.select().from(playlistTracks).where(eq(playlistTracks.playlistId, playlistId)).orderBy(asc(playlistTracks.order), asc(playlistTracks.playlistTrackId)).all();
    const updatedAt = new Date().toISOString();
    if (body.action === 'add') {
      const present = new Set(entries.map(entry => entry.trackId));
      const additions = trackIds.filter(id => !present.has(id));
      const offset = entries.length ? Math.max(...entries.map(entry => entry.order ?? 0)) + 1 : 0;
      if (additions.length) tx.insert(playlistTracks).values(additions.map((trackId, index) => ({ playlistId, trackId, order: offset + index, updatedAt }))).run();
    } else {
      tx.delete(playlistTracks).where(and(eq(playlistTracks.playlistId, playlistId), inArray(playlistTracks.trackId, trackIds))).run();
      entries.filter(entry => !trackIds.includes(entry.trackId)).forEach((entry, order) => {
        tx.update(playlistTracks).set({ order, updatedAt }).where(eq(playlistTracks.playlistTrackId, entry.playlistTrackId)).run();
      });
    }
    tx.update(playlists).set({ updatedAt }).where(owned).run();
  });
  return { success: true };
});
