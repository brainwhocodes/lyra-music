import { defineEventHandler, createError } from 'h3';
import { db } from '~/server/db';
import { artists, albums, albumArtists, tracks, artistsTracks } from '~/server/db/schema';
import { eq, and } from 'drizzle-orm';
import { alias } from 'drizzle-orm/sqlite-core';
import { getUserFromEvent } from '~/server/utils/auth';

export default defineEventHandler(async (event) => {
  const user = await getUserFromEvent(event);

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

    // Alias for artists table to get the album's own primary artist details
    const albumPrimaryArtistDetails = alias(artists, 'albumPrimaryArtistDetails');
    // Alias for albumArtists table to link album to its own primary artist
    const albumPrimaryArtistLink = alias(albumArtists, 'albumPrimaryArtistLink');

    let artistAlbums = await db
      .select({
        id: albums.albumId,
        title: albums.title,
        year: albums.year,
        cover_path: albums.coverPath,
        albumArtistId: albumPrimaryArtistDetails.artistId, // Selected from aliased artists table
        albumArtistName: albumPrimaryArtistDetails.name    // Selected from aliased artists table
      })
      .from(albums)
      // This join is to filter albums associated with the *viewed artist* (artistId from route params)
      .innerJoin(albumArtists, eq(albumArtists.albumId, albums.albumId))
      // These joins are to find the *actual primary artist* of each album found
      .leftJoin(albumPrimaryArtistLink, and(
        eq(albumPrimaryArtistLink.albumId, albums.albumId),
        eq(albumPrimaryArtistLink.isPrimaryArtist, 1) // 1 for true, as per schema
      ))
      .leftJoin(albumPrimaryArtistDetails, eq(albumPrimaryArtistDetails.artistId, albumPrimaryArtistLink.artistId))
      .where(and(eq(albumArtists.artistId, artistId), eq(albums.userId, user.userId)))
      .orderBy(albums.year, albums.title) // Added sorting for consistency
      .all();

    // If no primary albums are found, try to find albums the artist appears on via tracks
    if (artistAlbums.length === 0) {
      const trackAlbums = await db
        .selectDistinct({
          id: albums.albumId,
          title: albums.title,
          year: albums.year,
          cover_path: albums.coverPath,
          albumArtistId: albumPrimaryArtistDetails.artistId, // Selected from aliased artists table
          albumArtistName: albumPrimaryArtistDetails.name    // Selected from aliased artists table
        })
        .from(albums)
        .innerJoin(tracks, eq(tracks.albumId, albums.albumId))
        .innerJoin(artistsTracks, eq(artistsTracks.trackId, tracks.trackId))
        // Joins to find the *actual primary artist* of each album found via tracks
        .leftJoin(albumPrimaryArtistLink, and(
          eq(albumPrimaryArtistLink.albumId, albums.albumId),
          eq(albumPrimaryArtistLink.isPrimaryArtist, 1) // 1 for true
        ))
        .leftJoin(albumPrimaryArtistDetails, eq(albumPrimaryArtistDetails.artistId, albumPrimaryArtistLink.artistId))
        .where(and(eq(artistsTracks.artistId, artistId), eq(albums.userId, user.userId)))
        .orderBy(albums.year, albums.title)
        .all();
      
      if (trackAlbums.length > 0) {
        artistAlbums = trackAlbums.map(album => ({
          id: album.id,
          title: album.title,
          year: album.year,
          cover_path: album.cover_path,
          albumArtistId: album.albumArtistId,
          albumArtistName: album.albumArtistName
        }));
      }
    }

    // Ensure the final albums array has a consistent structure
    const finalAlbums = artistAlbums.map(album => ({
      id: album.id,
      title: album.title,
      year: album.year,
      cover_path: album.cover_path,
      // Ensure these fields are present even if the left join didn't find a primary artist (e.g. for compilations with no primary artist marked)
      albumArtistId: album.albumArtistId || null, 
      albumArtistName: album.albumArtistName || 'Various Artists' // Default for albums without a specific primary artist
    }));

    return {
      ...artistDetails,
      albums: finalAlbums
    };
  } catch (error) {
    console.error('Error fetching artist details:', error);
    throw createError({
      statusCode: 500,
      message: 'Failed to fetch artist details'
    });
  }
});
