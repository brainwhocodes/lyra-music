import { createError, defineEventHandler, getRouterParam } from 'h3';
import { getUserFromEvent } from '~/server/utils/auth';
import { getPlaylistDetail } from '~/server/utils/playlist-detail';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const playlistId = getRouterParam(event, 'id');
  if (!playlistId) throw createError({ statusCode: 400, statusMessage: 'Playlist ID is required' });
  return getPlaylistDetail(playlistId, user.userId);
});
