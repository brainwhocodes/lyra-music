import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { artists, artistUsers } from '~/server/db/schema';
import { asc, eq } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);

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
      .innerJoin(artistUsers, eq(artists.artistId, artistUsers.artistId))
      .where(eq(artistUsers.userId, user.userId)) // user is guaranteed to be non-null here due to the check above
      .groupBy(artists.artistId, artists.name, artists.artistImage) // Ensure distinct artists if a user could have multiple entries for the same artist (though schema implies userArtistId is PK)
      .orderBy(asc(artists.name))
      .all();

    return results;
  } catch (error) {
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artists',
    });
  }
});
