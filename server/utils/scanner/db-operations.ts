import { eq, and, sql, inArray } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { artists, albums, tracks, artistUsers, genres, albumGenres, albumArtists, type Album, type Artist } from '~/server/db/schema';
import { searchArtistByName, getArtistWithImages, extractArtistImageUrls } from '~/server/utils/musicbrainz';
import { albumArtUtils } from './album-art-utils';

interface FindOrCreateArtistParams {
  artistName: string;
  userId: string;
  skipRemoteImageFetch?: boolean;
}

interface GetOrCreateArtistMinimalParams {
  artistName: string;
}

interface FindOrCreateAlbumParams {
  albumTitle: string;
  artistIds: string[];
  primaryArtistId?: string | null;
  userId: string;
  year?: number;
  coverPath?: string | null;
  musicbrainzReleaseId?: string | null;
}

interface FindOrCreateTrackParams {
  title: string;
  filePath: string;
  albumId: string | null;
  artistId: string | null;
  metadata: any;
}

/**
 * Finds or creates an artist and links them to a user.
 * Also fetches and saves artist images from MusicBrainz if available.
 */
export async function findOrCreateArtist({
  artistName,
  userId,
  skipRemoteImageFetch = false,
}: FindOrCreateArtistParams): Promise<Artist | null> {
  if (!artistName) return null;

  try {
    // Check if artist exists
    let existingArtistRecord = await db
      .select()
      .from(artists)
      .where(eq(artists.name, artistName))
      .limit(1);

    let artistRecord: Artist;
    let shouldFetchArtistImage = false;
    
    if (existingArtistRecord.length > 0) {
      artistRecord = existingArtistRecord[0];
      console.log(`  Found existing artist: ${artistName} (ID: ${artistRecord.artistId}, MBID: ${artistRecord.musicbrainzArtistId})`);
      
      if (!artistRecord.artistImage) {
        shouldFetchArtistImage = true;
      }
    } else {
      // Create a new artist
      const newArtistResult = await db
        .insert(artists)
        .values({
          artistId: uuidv7(),
          name: artistName 
          // musicbrainzArtistId will be updated later if found
        })
        .returning();

      if (!newArtistResult || newArtistResult.length === 0) {
        console.error(`  Failed to create artist: ${artistName}`);
        return null;
      }
      
      artistRecord = newArtistResult[0];
      console.log(`  Created new artist: ${artistName} (ID: ${artistRecord.artistId})`);
      shouldFetchArtistImage = true;
    }

    // Fetch artist image from MusicBrainz if needed and not skipped
    if (shouldFetchArtistImage && !skipRemoteImageFetch) {
      try {
        let mbid: string | null = artistRecord.musicbrainzArtistId || null;

        if (!mbid) { // Only search by name if we don't have an MBID
          console.log(`  Searching MusicBrainz ID for: ${artistName}`);
          mbid = await searchArtistByName(artistName);
        }
        
        if (mbid) {
          // If mbid was found and not already stored, or if it's different (though unlikely to change often)
          // Or if the artist was just created and mbid was found
          if (!artistRecord.musicbrainzArtistId || artistRecord.musicbrainzArtistId !== mbid) {
            const updatedArtistWithMbid = await db.update(artists).set({
              musicbrainzArtistId: mbid,
              updatedAt: sql`CURRENT_TIMESTAMP`
            }).where(eq(artists.artistId, artistRecord.artistId)).returning();
            if (updatedArtistWithMbid.length > 0) artistRecord = updatedArtistWithMbid[0];
            console.log(`  Updated artist ${artistName} with MBID: ${mbid}`);
          }

          console.log(`  Fetching artist image for: ${artistName} using MBID: ${mbid}`);
          const artistDetails = await getArtistWithImages(mbid);
          if (artistDetails) {
            const imageUrls = extractArtistImageUrls(artistDetails);
            if (imageUrls.length > 0) {
              const imagePath = await albumArtUtils.downloadArtistImage(imageUrls[0]);
              if (imagePath) {
                const updatedArtistsWithImage = await db
                  .update(artists)
                  .set({ 
                    artistImage: imagePath,
                    updatedAt: sql`CURRENT_TIMESTAMP` 
                  })
                  .where(eq(artists.artistId, artistRecord.artistId))
                  .returning();
                if (updatedArtistsWithImage.length > 0) artistRecord = updatedArtistsWithImage[0]; // Update local record
                console.log(`  Updated artist ${artistName} with image: ${imagePath}`);
              }
            }
          }
        } else {
          console.log(`  No MBID found for artist: ${artistName}`);
        }
      } catch (imageError: any) {
        console.error(`  Error fetching artist image for ${artistName}: ${imageError.message}`);
      }
    }

    if (userId) {
      await linkUserToArtist(userId, artistRecord.artistId, artistName);
    }

    return artistRecord; // Return the full artist object or relevant fields
  } catch (error: any) {
    console.error(`  Database error with artist ${artistName}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates an artist record by name, returning the basic artist object.
 * This function does NOT handle image fetching or user linking.
 */
export async function getOrCreateArtistMinimal({
  artistName,
}: GetOrCreateArtistMinimalParams): Promise<Artist | null> {
  if (!artistName) return null;

  try {
    // Check if artist exists
    let existingArtistRecord = await db
      .select()
      .from(artists)
      .where(eq(artists.name, artistName))
      .limit(1);

    if (existingArtistRecord.length > 0) {
      return existingArtistRecord[0];
    } else {
      // Create a new artist
      const newArtistResult = await db
        .insert(artists)
        .values({
          artistId: uuidv7(),
          name: artistName,
        })
        .returning();

      if (!newArtistResult || newArtistResult.length === 0) {
        return null;
      }
      return newArtistResult[0];
    }
  } catch (error: any) {
    // console.error(`  [Minimal] Database error creating/finding artist ${artistName}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates an album and updates its art if needed.
 * Also creates many-to-many relationships with artists.
 */
export async function findOrCreateAlbum({
  albumTitle,
  artistIds,
  primaryArtistId,
  userId,
  year,
  coverPath,
  musicbrainzReleaseId,
}: FindOrCreateAlbumParams): Promise<Album | null> {
  if (!albumTitle) return null;
  if (artistIds.length === 0) return null;

  try {
    // Check if album exists by title and user
    let existingAlbumResult = await db
      .select()
      .from(albums)
      .where(
        and(
          eq(albums.title, albumTitle),
          eq(albums.userId, userId)
        )
      )
      .limit(1);

    let albumRecord: Album;
    let isNewAlbum = false;

    if (existingAlbumResult.length > 0) {
      albumRecord = existingAlbumResult[0];
      console.log(`  Found existing album: ${albumTitle} (ID: ${albumRecord.albumId})`);

      // Check if we need to update existing album with new info
      const updates: Partial<typeof albums.$inferInsert> = {};
      if (musicbrainzReleaseId && !albumRecord.musicbrainzReleaseId) {
        updates.musicbrainzReleaseId = musicbrainzReleaseId;
      }
      if (coverPath && !albumRecord.coverPath) {
        updates.coverPath = coverPath;
      }
      if (year !== undefined && year !== null && albumRecord.year === null) { // Check if existing year is null
        updates.year = year;
      }

      if (Object.keys(updates).length > 0) {
        updates.updatedAt = new Date().toISOString(); // Use ISO string for text date column
        const updatedAlbums = await db
          .update(albums)
          .set(updates)
          .where(eq(albums.albumId, albumRecord.albumId))
          .returning();
        if (updatedAlbums.length > 0) albumRecord = updatedAlbums[0]; // Update local record
        console.log(`  Updated existing album ${albumTitle} with new details.`);
      }
    } else {
      // Create new album
      isNewAlbum = true;
      const newAlbumResult = await db
        .insert(albums)
        .values({
          albumId: uuidv7(),
          title: albumTitle,
          userId,
          year,
          coverPath,
          musicbrainzReleaseId,
        })
        .returning();
      
      if (!newAlbumResult || newAlbumResult.length === 0) {
        console.error(`  Failed to create album: ${albumTitle}`);
        return null;
      }
      albumRecord = newAlbumResult[0];
      console.log(`  Created new album: ${albumTitle} (ID: ${albumRecord.albumId})`);
    }

    // Manage album-artist relationships
    // First, get existing relationships for this album
    const existingRelations = await db
      .select({ artistId: albumArtists.artistId })
      .from(albumArtists)
      .where(eq(albumArtists.albumId, albumRecord.albumId));
    const existingArtistIds = new Set(existingRelations.map(r => r.artistId));

    // Determine new artists to link
    const artistsToLink = artistIds.filter(id => !existingArtistIds.has(id));

    if (artistsToLink.length > 0) {
      await db.insert(albumArtists).values(
        artistsToLink.map(artistId => ({
          albumArtistId: uuidv7(),
          albumId: albumRecord.albumId,
          artistId: artistId,
          isPrimaryArtist: artistId === primaryArtistId ? 1 : 0,
        }))
      );
      console.log(`  Linked ${artistsToLink.length} new artists to album ${albumTitle}.`);
    }

    // If it's a new album or if the primary artist needs to be set/updated
    // This logic ensures the primary artist is correctly marked.
    if (primaryArtistId) {
      const primaryArtistLink = await db.select().from(albumArtists)
        .where(and(eq(albumArtists.albumId, albumRecord.albumId), eq(albumArtists.artistId, primaryArtistId))).limit(1);

      if (primaryArtistLink.length === 0 && artistIds.includes(primaryArtistId)) {
        // Link if not existing and part of current artistIds
        await db.insert(albumArtists).values({
          albumArtistId: uuidv7(),
          albumId: albumRecord.albumId,
          artistId: primaryArtistId,
          isPrimaryArtist: 1,
        });
      } else if (primaryArtistLink.length > 0 && primaryArtistLink[0].isPrimaryArtist !== 1) {
        // Update if existing but not marked as primary
        await db.update(albumArtists)
          .set({ isPrimaryArtist: 1 })
          .where(eq(albumArtists.albumArtistId, primaryArtistLink[0].albumArtistId));
      }
      // Ensure other artists are not primary if this one is explicitly set
      await db.update(albumArtists)
        .set({ isPrimaryArtist: 0 })
        .where(and(eq(albumArtists.albumId, albumRecord.albumId), sql`${albumArtists.artistId} != ${primaryArtistId}`));
    }

    return albumRecord; // Return the full album object or relevant fields
  } catch (error: any) {
    console.error(`  Database error with album ${albumTitle}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates a track in the database.
 */
export async function findOrCreateTrack({
  title,
  filePath,
  albumId,
  artistId,
  metadata,
}: FindOrCreateTrackParams): Promise<string | null> {
  const common = metadata.common || {};

  try {
    const [existingTrack] = await db
      .select({ trackId: tracks.trackId, filePath: tracks.filePath })
      .from(tracks)
      .where(eq(tracks.filePath, filePath))
      .limit(1);

    // Common data payload for insert/update, excluding fields with DB defaults or not in schema
    const trackDataPayload = {
      title,
      albumId,
      artistId,
      genre: common.genre?.join(', '),
      year: common.year,
      trackNumber: common.track?.no,
      diskNumber: common.disk?.no,
      duration: metadata.format.duration,
      filePath,
    };

    if (existingTrack) {
      // Update existing track
      // Consider adding logic here to check if an update is truly necessary by comparing fields
      await db
        .update(tracks)
        .set({
          ...trackDataPayload,
          updatedAt: sql`CURRENT_TIMESTAMP`, // Explicitly set updatedAt for updates
        })
        .where(eq(tracks.trackId, existingTrack.trackId));
      
      console.log(`  Updated track: ${title} (ID: ${existingTrack.trackId})`);
      return existingTrack.trackId;
    }

    // Insert new track
    const [newTrack] = await db
      .insert(tracks)
      .values({
        ...trackDataPayload,
        // trackId, createdAt, and updatedAt will use schema defaults
      })
      .returning({ trackId: tracks.trackId });

    if (!newTrack) {
      console.error(`  Failed to create track: ${title}`);
      return null;
    }

    console.log(`  Created new track: ${title} (ID: ${newTrack.trackId})`);
    return newTrack.trackId;
  } catch (error: any) {
    console.error(`  Database error with track ${title}: ${error.message}`);
    return null;
  }
}

/**
 * Finds or creates a genre in the database.
 * @param genreName The name of the genre.
 * @returns The ID of the found or created genre, or null if an error occurs or name is empty.
 */
export async function findOrCreateGenre(genreName: string): Promise<string | null> {
  if (!genreName || genreName.trim() === '') {
    console.warn('  Attempted to find or create an empty genre name.');
    return null;
  }

  const trimmedGenreName = genreName.trim();

  try {
    const [existingGenre] = await db
      .select({ genreId: genres.genreId })
      .from(genres)
      .where(eq(genres.name, trimmedGenreName))
      .limit(1);

    if (existingGenre) {
      console.log(`  Found existing genre: ${trimmedGenreName} (ID: ${existingGenre.genreId})`);
      return existingGenre.genreId;
    }

    const [newGenre] = await db
      .insert(genres)
      .values({
        genreId: uuidv7(),
        name: trimmedGenreName,
      })
      .returning({ genreId: genres.genreId });

    if (!newGenre) {
      console.error(`  Failed to create genre: ${trimmedGenreName}`);
      return null;
    }

    console.log(`  Created new genre: ${trimmedGenreName} (ID: ${newGenre.genreId})`);
    return newGenre.genreId;
  } catch (error: any) {
    console.error(`  Database error with genre ${trimmedGenreName}: ${error.message}`);
    return null;
  }
}

/**
 * Links an album to a genre in the database if the link does not already exist.
 * @param albumId The ID of the album.
 * @param genreId The ID of the genre.
 */
export async function linkAlbumToGenre(albumId: string, genreId: string): Promise<void> {
  if (!albumId || !genreId) {
    console.warn('  Attempted to link album to genre with missing IDs.');
    return;
  }

  try {
    const [existingLink] = await db
      .select()
      .from(albumGenres)
      .where(and(eq(albumGenres.albumId, albumId), eq(albumGenres.genreId, genreId)))
      .limit(1);

    if (existingLink) {
      // console.log(`  Album ${albumId} already linked to genre ${genreId}`);
      return; // Link already exists
    }

    await db.insert(albumGenres).values({
      albumGenreId: uuidv7(),
      albumId,
      genreId,
    });
    console.log(`  Linked album ${albumId} to genre ${genreId}`);
  } catch (error: any) {
    console.error(`  Error linking album ${albumId} to genre ${genreId}: ${error.message}`);
  }
}

/**
 * Checks if an album has any genres linked in the database.
 * @param albumId The ID of the album.
 * @returns True if the album has one or more genres, false otherwise.
 */
export async function hasAlbumGenres(albumId: string): Promise<boolean> {
  if (!albumId) {
    console.warn('  hasAlbumGenres called with no albumId.');
    return false;
  }
  try {
    const result = await db
      .select({ count: sql<number>`count(*)` })
      .from(albumGenres)
      .where(eq(albumGenres.albumId, albumId))
      .limit(1);

    return result.length > 0 && result[0].count > 0;
  } catch (error: any) {
    console.error(`  Error checking genres for album ${albumId}: ${error.message}`);
    return false; // Return false on error to prevent unintended blocking of MB calls
  }
}

/**
 * Links a user to an artist if not already linked.
 */
async function linkUserToArtist(
  userId: string, 
  artistId: string, 
  artistName: string
): Promise<void> {
  try {
    const [existingLink] = await db
      .select()
      .from(artistUsers)
      .where(
        and(
          eq(artistUsers.userId, userId), 
          eq(artistUsers.artistId, artistId)
        )
      )
      .limit(1);

    if (!existingLink) {
      // Create new link
      await db.insert(artistUsers).values({
        artistUserId: uuidv7(),
        userId,
        artistId,
      });
      console.log(`  Linked user ${userId} to artist ${artistName} (${artistId})`);
    }
  } catch (error: any) {
    console.error(`  Error linking user ${userId} to artist ${artistId}: ${error.message}`);
  }
}

export const dbOperations = {
  findOrCreateArtist,
  getOrCreateArtistMinimal,
  findOrCreateAlbum,
  findOrCreateTrack,
  findOrCreateGenre,
  linkAlbumToGenre,
  linkUserToArtist,
  hasAlbumGenres,
} as const;
