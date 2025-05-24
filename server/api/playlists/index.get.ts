import { defineEventHandler } from 'h3';
import { db } from '~/server/db';
import { playlists } from '~/server/db/schema';
import { and, eq } from 'drizzle-orm';
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
      .select()
      .from(playlists)
      .where(eq(playlists.userId, user.userId))
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
