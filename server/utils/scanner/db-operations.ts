import { eq, and, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { artists, albums, tracks, artistUsers, genres, albumGenres } from '~/server/db/schema';
import { searchArtistByName, getArtistWithImages, extractArtistImageUrls } from '~/server/utils/musicbrainz';
import { albumArtUtils } from './album-art-utils';

interface FindOrCreateArtistParams {
  artistName: string;
  userId: string;
}

interface FindOrCreateAlbumParams {
  albumTitle: string;
  artistId: string | null;
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
}: FindOrCreateArtistParams): Promise<string | null> {
  if (!artistName) return null;

  try {
    // Check if artist exists
    const [existingArtist] = await db
      .select({ 
        artistId: artists.artistId,
        artistImage: artists.artistImage 
      })
      .from(artists)
      .where(eq(artists.name, artistName))
      .limit(1);

    let artistId: string;
    let shouldFetchArtistImage = false;
    
    if (existingArtist) {
      artistId = existingArtist.artistId;
      console.log(`  Found existing artist: ${artistName} (ID: ${artistId})`);
      
      // Check if we need to fetch artist image
      if (!existingArtist.artistImage) {
        shouldFetchArtistImage = true;
      }
    } else {
      // Create a new artist
      const [newArtist] = await db
        .insert(artists)
        .values({
          artistId: uuidv7(),
          name: artistName 
        })
        .returning({ artistId: artists.artistId });

      if (!newArtist) {
        console.error(`  Failed to create artist: ${artistName}`);
        return null;
      }
      
      artistId = newArtist.artistId;
      console.log(`  Created new artist: ${artistName} (ID: ${artistId})`);
      shouldFetchArtistImage = true;
    }

    // Fetch artist image from MusicBrainz if needed
    if (shouldFetchArtistImage) {
      try {
        console.log(`  Fetching artist image for: ${artistName}`);
        // Search for artist on MusicBrainz
        const mbid = await searchArtistByName(artistName);
        
        if (mbid) {
          // Get artist details with image relations
          const artistDetails = await getArtistWithImages(mbid);
          
          if (artistDetails) {
            // Extract image URLs
            const imageUrls = extractArtistImageUrls(artistDetails);
            
            if (imageUrls.length > 0) {
              // Download the first image
              const imagePath = await albumArtUtils.downloadArtistImage(imageUrls[0]);
              
              if (imagePath) {
                // Update artist with image path
                await db
                  .update(artists)
                  .set({ 
                    artistImage: imagePath,
                    updatedAt: sql`CURRENT_TIMESTAMP` 
                  })
                  .where(eq(artists.artistId, artistId));
                  
                console.log(`  Updated artist ${artistName} with image: ${imagePath}`);
              }
            }
          }
        }
      } catch (imageError: any) {
        // Log error but continue - image is optional
        console.error(`  Error fetching artist image for ${artistName}: ${imageError.message}`);
      }
    }

    // Link artist to user if not already linked
    if (userId) {
      await linkUserToArtist(userId, artistId, artistName);
    }

    return artistId;
  } catch (error: any) {
    console.error(`  Database error with artist ${artistName}: ${error.message}`);
    return null;
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

/**
 * Finds or creates an album and updates its art if needed.
 */
export async function findOrCreateAlbum({
  albumTitle,
  artistId,
  userId,
  year,
  coverPath,
  musicbrainzReleaseId,
}: FindOrCreateAlbumParams): Promise<string | null> {
  if (!albumTitle) return null;

  try {
    // Check if album exists
    const [existingAlbum] = await db
      .select({ 
        albumId: albums.albumId, 
        coverPath: albums.coverPath,
        musicbrainzReleaseId: albums.musicbrainzReleaseId
      })
      .from(albums)
      .where(
        and(
          eq(albums.title, albumTitle),
          artistId ? eq(albums.artistId, artistId) : sql`${albums.artistId} IS NULL`,
          eq(albums.userId, userId)
        )
      )
      .limit(1);

    // If album exists, update art and musicbrainzReleaseId if needed
    if (existingAlbum) {
      const albumId = existingAlbum.albumId;
      
      const updates: Partial<typeof albums.$inferInsert> = {};
      let needsUpdate = false;

      // Update cover path if we have a new one from local sources
      if (coverPath && coverPath !== existingAlbum.coverPath) {
        updates.coverPath = coverPath;
        needsUpdate = true;
      }

      // Update MusicBrainz release ID if we have a new one
      if (musicbrainzReleaseId && musicbrainzReleaseId !== existingAlbum.musicbrainzReleaseId) {
        updates.musicbrainzReleaseId = musicbrainzReleaseId;
        needsUpdate = true;
      }
      
      // If we don't have a cover path but we have a MusicBrainz ID, try to get cover art from MusicBrainz
      if (!existingAlbum.coverPath && !coverPath) {
        const mbId = musicbrainzReleaseId || existingAlbum.musicbrainzReleaseId;
        if (mbId) {
          const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbId);
          if (mbCoverPath) {
            updates.coverPath = mbCoverPath;
            needsUpdate = true;
          }
        }
      }

      if (needsUpdate) {
        await db
          .update(albums)
          .set({
            ...updates,
            updatedAt: sql`CURRENT_TIMESTAMP`
          })
          .where(eq(albums.albumId, albumId));
      }
      
      return albumId;
    }

    // Try to get cover art from MusicBrainz if we don't have one locally but have a MusicBrainz ID
    let finalCoverPath = coverPath;
    if (!coverPath && musicbrainzReleaseId) {
      const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(musicbrainzReleaseId);
      if (mbCoverPath) {
        finalCoverPath = mbCoverPath;
      }
    }
    
    // Create new album
    const [newAlbum] = await db
      .insert(albums)
      .values({
        title: albumTitle,
        artistId,
        userId,
        year,
        coverPath: finalCoverPath,
        musicbrainzReleaseId,
      })
      .returning({ albumId: albums.albumId });

    if (!newAlbum) {
      return null;
    }

    return newAlbum.albumId;
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

export const dbOperations = {
  findOrCreateArtist,
  findOrCreateAlbum,
  findOrCreateTrack,
  findOrCreateGenre,
  linkAlbumToGenre,
} as const;
