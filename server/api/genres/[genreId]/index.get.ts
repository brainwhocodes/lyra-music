// server/api/genres/[genreId]/index.get.ts
import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, albumGenres, genres as genresTable, albumArtists } from '~/server/db/schema';
import { eq, inArray } from 'drizzle-orm';

export default defineEventHandler(async (event) => {
  const genreId = event.context.params?.genreId;

  if (!genreId) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Genre ID is required',
    });
  }

  try {
    // 1. Fetch genre details
    const genreDetailsResult = await db
      .select({
        id: genresTable.genreId,
        name: genresTable.name,
      })
      .from(genresTable)
      .where(eq(genresTable.genreId, genreId))
      .limit(1);

    if (genreDetailsResult.length === 0) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Genre not found',
      });
    }
    const genreDetails = genreDetailsResult[0];

    // 2. Fetch albums for the genre
    const genreAlbums = await db
      .select({
        albumId: albums.albumId,
        title: albums.title,
        year: albums.year,
        coverPath: albums.coverPath,
      })
      .from(albums)
      .innerJoin(albumGenres, eq(albums.albumId, albumGenres.albumId))
      .where(eq(albumGenres.genreId, genreId))
      .orderBy(albums.title);

    if (genreAlbums.length === 0) {
      return {
        genre: genreDetails,
        albums: [],
      };
    }

    const albumIds = genreAlbums.map(a => a.albumId);

    // 3. Fetch all artists for these albums
    const artistsForAlbums = await db
      .select({
        albumId: albumArtists.albumId,
        artistId: artists.artistId,
        name: artists.name,
        isPrimary: albumArtists.isPrimaryArtist,
        role: albumArtists.role,
      })
      .from(albumArtists)
      .innerJoin(artists, eq(albumArtists.artistId, artists.artistId))
      .where(inArray(albumArtists.albumId, albumIds));

    // 4. Group artists by album
    const artistsByAlbumId = artistsForAlbums.reduce((acc, artist) => {
      const albumId = artist.albumId;
      if (!acc[albumId]) {
        acc[albumId] = [];
      }
      acc[albumId].push({
        id: artist.artistId,
        name: artist.name,
        isPrimary: !!artist.isPrimary,
        role: artist.role,
      });
      return acc;
    }, {} as Record<string, { id: string; name: string; isPrimary: boolean; role: string | null }[]>);

    // 5. Combine albums with their artists
    const albumsWithArtists = genreAlbums.map(album => ({
      id: album.albumId,
      title: album.title,
      year: album.year,
      coverPath: album.coverPath,
      artists: artistsByAlbumId[album.albumId]?.sort((a, b) => (a.isPrimary ? -1 : b.isPrimary ? 1 : 0)) || [],
    }));

    return {
      genre: genreDetails,
      albums: albumsWithArtists,
    };

  } catch (error: any) {
    console.error(`Error fetching data for genre ${genreId}:`, error);
    throw createError({
      statusCode: 500,
      statusMessage: 'Failed to fetch data for the genre page',
      message: error.message,
    });
  }
});
