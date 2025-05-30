// server/api/albums/index.get.ts
import { defineEventHandler, createError, getQuery } from 'h3'
import { db } from '~/server/db'
import { albums, artists, tracks, albumArtists } from '~/server/db/schema'
import { eq, asc, like, SQL, and } from 'drizzle-orm'
import { useCoverArt } from '~/composables/use-cover-art';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const titleFilter = query.title as string | undefined;
  const genreFilter = query.genre as string | undefined;

  const user = await getUserFromEvent(event);
  if (!user) {
    throw createError({
      statusCode: 401,
      statusMessage: 'Unauthorized',
    });
  }

  try {
    let dbQuery = db.selectDistinct({
      albumId: albums.albumId,
      title: albums.title,
      coverPath: albums.coverPath,
      createdAt: albums.createdAt,
      artistId: artists.artistId, // This will be the primary artist's ID
      artistName: artists.name,   // This will be the primary artist's name
      year: albums.year
    })
      .from(albums)
      .leftJoin(albumArtists, and(eq(albums.albumId, albumArtists.albumId), eq(albumArtists.isPrimaryArtist, 1)))
      .leftJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .leftJoin(tracks, eq(albums.albumId, tracks.albumId));

    const conditions: SQL[] = [];
    conditions.push(eq(albums.userId, user?.userId));

    if (titleFilter) {
      conditions.push(like(albums.title, `%${titleFilter}%`));
    }
    if (genreFilter) {
      conditions.push(eq(tracks.genre, genreFilter));
    }

    if (conditions.length > 0) {
      dbQuery = dbQuery.where(and(...conditions)) as typeof dbQuery;
    }

    const filteredAlbums = await dbQuery
      .orderBy(asc(artists.name), asc(albums.title))
      .all();

    const { getCoverArtUrl } = useCoverArt();
    const albumsWithFormattedCovers = filteredAlbums.map(album => ({
      ...album,
      coverPath: getCoverArtUrl(album.coverPath)
    }));

    console.log(albumsWithFormattedCovers); 
    return albumsWithFormattedCovers;
  } catch (error) {
    console.error('Error fetching albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums'
    });
  }
});
