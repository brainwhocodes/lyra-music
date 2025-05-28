import { H3Event } from 'h3';
import { db } from '~/server/db';
import { albums, artists } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

// Define the expected request body type
type UpdateAlbumBody = {
  title: string;
  artistName: string;
  year: number | null;
};

export default defineEventHandler(async (event: H3Event) => {
  const user = getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  const albumId = getRouterParam(event, 'id');
  if (!albumId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Album ID is required',
    });
  }

  const body = await readBody<UpdateAlbumBody>(event);
  
  // Validate request body
  if (!body.title?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Album title is required',
    });
  }

  if (!body.artistName?.trim()) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Artist name is required',
    });
  }

  // Start a transaction
  return await db.transaction(async (tx) => {
    // 1. Find or create the artist
    let artist = await tx.query.artists.findFirst({
      where: (artists, { eq }) => eq(artists.name, body.artistName.trim()),
    });

    if (!artist) {
      // Create new artist if not found
      const [newArtist] = await tx
        .insert(artists)
        .values({
          name: body.artistName.trim(),
          userId: user.userId,
        })
        .returning();
      
      if (!newArtist) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to create artist',
        });
      }
      artist = newArtist;
    }

    // 2. Update the album
    const [updatedAlbum] = await tx
      .update(albums)
      .set({
        title: body.title.trim(),
        artistId: artist.artistId,
        year: body.year,
        updatedAt: new Date().toISOString(),
      })
      .where(
        and(
          eq(albums.albumId, albumId),
          eq(albums.userId, user.userId)
        )
      )
      .returning();

    if (!updatedAlbum) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Album not found or not authorized',
      });
    }

    // 3. Return the updated album with artist name
    return {
      ...updatedAlbum,
      artistId: artist.artistId,
      artistName: artist.name,
    };
  });
});
