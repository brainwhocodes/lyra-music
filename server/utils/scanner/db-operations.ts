import { eq, and, sql } from 'drizzle-orm';
import { v7 as uuidv7 } from 'uuid';
import { db } from '~/server/db';
import { artists, albums, tracks, userArtists } from '~/server/db/schema';

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
}

interface FindOrCreateTrackParams {
  title: string;
  filePath: string;
  albumId: string | null;
  artistId: string | null;
  genre?: string;
  duration?: number | null;
  trackNumber?: number | null;
  libraryId: string;
}

/**
 * Finds or creates an artist and links them to a user.
 */
export async function findOrCreateArtist({
  artistName,
  userId,
}: FindOrCreateArtistParams): Promise<string | null> {
  if (!artistName) return null;

  try {
    // Check if artist exists
    const [existingArtist] = await db
      .select({ artistId: artists.artistId })
      .from(artists)
      .where(eq(artists.name, artistName))
      .limit(1);

    let artistId: string;
    
    if (existingArtist) {
      artistId = existingArtist.artistId;
      console.log(`  Found existing artist: ${artistName} (ID: ${artistId})`);
    } else {
      // Create new artist
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
      .from(userArtists)
      .where(
        and(
          eq(userArtists.userId, userId), 
          eq(userArtists.artistId, artistId)
        )
      )
      .limit(1);

    if (!existingLink) {
      await db.insert(userArtists).values({
        userArtistId: uuidv7(),
        userId,
        artistId,
        createdAt: new Date()
      });
      console.log(`  Linked user ${userId} to artist ${artistId} (${artistName})`);
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
}: FindOrCreateAlbumParams): Promise<string | null> {
  if (!albumTitle) return null;

  try {
    // Check if album exists
    const [existingAlbum] = await db
      .select({ 
        albumId: albums.albumId, 
        coverPath: albums.coverPath 
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

    // If album exists, update art if needed
    if (existingAlbum) {
      console.log(`  Found existing album: ${albumTitle} (ID: ${existingAlbum.albumId})`);
      
      if (coverPath && coverPath !== existingAlbum.coverPath) {
        console.log(`  Updating album art for ${albumTitle} to ${coverPath}`);
        await db
          .update(albums)
          .set({ 
            coverPath,
            updatedAt: sql`CURRENT_TIMESTAMP` 
          })
          .where(eq(albums.albumId, existingAlbum.albumId));
      }
      
      return existingAlbum.albumId;
    }

    // Create new album
    const [newAlbum] = await db
      .insert(albums)
      .values({
        albumId: uuidv7(),
        title: albumTitle,
        artistId,
        userId,
        year,
        coverPath,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning({ albumId: albums.albumId });

    if (!newAlbum) {
      console.error(`  Failed to create album: ${albumTitle}`);
      return null;
    }

    console.log(`  Created new album: ${albumTitle} (ID: ${newAlbum.albumId})`);
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
  genre,
  duration,
  trackNumber,
  libraryId,
}: FindOrCreateTrackParams): Promise<string | null> {
  try {
    // Check if track with this path already exists
    const [existingTrack] = await db
      .select({ trackId: tracks.trackId })
      .from(tracks)
      .where(eq(tracks.filePath, filePath))
      .limit(1);

    // Prepare track data with required fields
    const trackToUpsert = {
      trackId: uuidv7(),
      title,
      albumId,
      artistId,
      genre,
      duration,
      trackNumber,
      filePath,
      libraryId,
      createdAt: new Date(),
      updatedAt: new Date()
    };

    if (existingTrack) {
      // Update existing track if file has moved or metadata changed
      await db
        .update(tracks)
        .set(trackToUpsert)
        .where(eq(tracks.trackId, existingTrack.trackId));
      
      console.log(`  Updated track: ${title} (ID: ${existingTrack.trackId})`);
      return existingTrack.trackId;
    }

    // Insert new track
    const [newTrack] = await db
      .insert(tracks)
      .values(trackToUpsert)
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

export const dbOperations = {
  findOrCreateArtist,
  findOrCreateAlbum,
  findOrCreateTrack,
} as const;
