import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { artists, albums, albumArtists } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = getUserFromEvent(event);

  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized: Authentication required.'
    });
  }

  const artistId = event.context.params?.id;
  
  if (!artistId) {
    throw createError({
      statusCode: 400,
      message: 'Artist ID is required'
    });
  }

  try {
    // First, fetch the artist details
    const artistDetails = await db
      .select({
        id: artists.artistId,
        name: artists.name,
        artistImage: artists.artistImage
      })
      .from(artists)
      .where(eq(artists.artistId, artistId))
      .get();

    if (!artistDetails) {
      throw createError({
        statusCode: 404,
        message: 'Artist not found'
      });
    }

    // Then, fetch all albums for this artist that belong to the user
    const artistAlbums = await db
      .select({
        id: albums.albumId,
        title: albums.title,
        year: albums.year,
        cover_path: albums.coverPath,
      })
      .from(albums)
      .innerJoin(albumArtists, eq(albums.albumId, albumArtists.albumId))
      .where(and(eq(albumArtists.artistId, artistId), eq(albums.userId, user.userId)))
      .all();

    // Return combined artist details with albums
    return {
      ...artistDetails,
      albums: artistAlbums
    };
  } catch (error) {
    console.error('Error fetching artist details:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artist details'
    });
  }
});
