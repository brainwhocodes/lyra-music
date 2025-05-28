import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { artists, albums } from '~/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = getUserFromEvent(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    })
  }

  try {
    const results = await db
      .select({
        artistId: artists.artistId,
        artistName: artists.name,
        artistImage: artists.artistImage,
      })
      .from(artists)
      .leftJoin(albums, eq(artists.artistId, albums.artistId))
      .where(eq(albums.userId, user.userId))
      .orderBy(asc(artists.name))
      .all();

    return results;
  } catch (error) {
    console.error('Error fetching artists and albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artists',
    });
  }
});
