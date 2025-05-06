// server/api/albums/index.get.ts
import { defineEventHandler, createError, getQuery } from 'h3'
import { db } from '~/server/db'
import { albums, artists, tracks } from '~/server/db/schema'
import { eq, asc, sql, like, SQL, and } from 'drizzle-orm'

export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const titleFilter = query.title as string | undefined;
  const genreFilter = query.genre as string | undefined;

  try {
    let dbQuery = db.selectDistinct({
      id: albums.id,
      title: albums.title,
      artPath: albums.artPath,
      createdAt: albums.createdAt,
      artistId: artists.id,
      artistName: artists.name
    })
      .from(albums)
      .leftJoin(artists, eq(albums.artistId, artists.id))
      .leftJoin(tracks, eq(albums.id, tracks.albumId));

    const conditions: SQL[] = [];
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

    console.log(filteredAlbums); 
    return filteredAlbums;
  } catch (error) {
    console.error('Error fetching albums:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch albums'
    });
  }
});
