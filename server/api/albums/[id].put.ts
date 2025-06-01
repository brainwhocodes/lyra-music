import { H3Event, readMultipartFormData, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, users, albumArtists } from '~/server/db/schema';
import type { AlbumArtistDetail } from '~/types/album';
import { writeFile, mkdir, access } from 'node:fs/promises'; // For promise-based file system operations
import path from 'path';   // For path manipulation
import { useCoverArt } from '~/composables/use-cover-art';
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

// Utility function to split artist strings (copied from scanner utils, ideally shared)
function splitArtistString(artistString: string): string[] {
  if (!artistString || typeof artistString !== 'string') return [];
  const trimmedArtist = artistString.trim();
  if (!trimmedArtist) return [];
  const separators = [', ', '; ', ' feat. ', ' featuring ', ' ft. ', ' with ', ' & ', ' and ', ' x '];
  for (const separator of separators) {
    if (trimmedArtist.includes(separator)) {
      return trimmedArtist.split(separator).map(part => part.trim()).filter(part => part.length > 0);
    }
  }
  return [trimmedArtist];
}

// Define the expected request body type
// Request body will be FormData, so we'll parse fields individually

export default defineEventHandler(async (event: H3Event) => {
  const user = await getUserFromEvent(event);
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

    const multipartFormData = await readMultipartFormData(event);

  let title: string | undefined;
  let artistsJsonString: string | undefined;
  let artistNameString: string | undefined; // For single string artist name
  let year: number | null | undefined = undefined;
  let coverImageFile: Buffer | undefined;
  let coverImageExtension: string | undefined;

  if (multipartFormData) {
    for (const part of multipartFormData) {
      if (part.name === 'title') title = part.data.toString().trim();
      if (part.name === 'artistsJson') artistsJsonString = part.data.toString();
      if (part.name === 'artistName') artistNameString = part.data.toString().trim(); // Read artistName
      if (part.name === 'year') {
        const yearStr = part.data.toString().trim();
        year = yearStr ? parseInt(yearStr, 10) : null;
        if (yearStr && isNaN(year as number)) year = null; // Ensure valid number or null
      }
      if (part.name === 'coverImage' && part.filename && part.data.length > 0) {
        coverImageFile = part.data;
        coverImageExtension = path.extname(part.filename);
      }
    }
  }

  // Validate parsed fields
  if (!title) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Album title is required',
    });
  }
  let artistsToUpdate: AlbumArtistDetail[] = [];
  if (artistsJsonString) {
    try {
      artistsToUpdate = JSON.parse(artistsJsonString);
      if (!Array.isArray(artistsToUpdate)) {
        throw new Error('Parsed artistsJson is not an array.');
      }
      if (artistsToUpdate.length === 0 && artistsJsonString.trim() !== '[]') { 
        // Allow empty array if explicitly sent as '[]', otherwise error if non-empty string parses to empty array (should not happen with valid JSON)
        throw new Error('Artists array from artistsJson must not be empty unless explicitly an empty array string.');
      }
      for (const art of artistsToUpdate) {
        if (!art.name && !art.artistId) {
          throw new Error('Each artist in artistsJson must have a name or an artistId.');
        }
      }
    } catch (e: any) {
      throw createError({ statusCode: 400, statusMessage: `Invalid artists JSON format: ${e.message}` });
    }
  } else if (artistNameString) {
    const parsedArtistNames = splitArtistString(artistNameString);
    if (parsedArtistNames.length > 0) {
      artistsToUpdate = parsedArtistNames.map((name, index) => ({
        name: name,
        // artistId is not known here, will be resolved by findOrCreateArtist logic using the name
        role: 'performer', // Default role
        isPrimaryArtist: index === 0, // First artist is primary
      } as AlbumArtistDetail)); // Cast to satisfy type, downstream logic handles missing artistId by using name
    }
  }

  // After attempting to populate from artistsJson or artistNameString, check if we have artists if title is present
  // (An album must have at least one artist if it has a title)
  if (title && artistsToUpdate.length === 0) {
     throw createError({ statusCode: 400, statusMessage: 'Artist information is required (provide artistsJson or artistName).' });
  }

  // Start a transaction
  return await db.transaction(async (tx) => {
    // 1. Process artists: find or create each, and collect their IDs and details for albumArtists table
    const processedArtistLinks: Array<Omit<typeof albumArtists.$inferInsert, 'albumId' | 'albumArtistId'>> = [];

    for (const inputArtist of artistsToUpdate) {
      let artistIdToLink: string;

      if (inputArtist.artistId) {
        // If artistId is provided, try to find the artist
        const existingArtist = await tx.query.artists.findFirst({
          where: eq(artists.artistId, inputArtist.artistId),
        });
        if (!existingArtist) {
          throw createError({
            statusCode: 404,
            statusMessage: `Artist with ID ${inputArtist.artistId} not found.`,
          });
        }
        artistIdToLink = existingArtist.artistId;
      } else if (inputArtist.name) {
        // If name is provided, find or create by name
        let artistRecord = await tx.query.artists.findFirst({
          where: eq(artists.name, inputArtist.name),
        });
        if (!artistRecord) {
          const [newArtist] = await tx
            .insert(artists)
            .values({ name: inputArtist.name })
            .returning();
          if (!newArtist) {
            throw createError({ statusCode: 500, statusMessage: `Failed to create artist ${inputArtist.name}` });
          }
          artistRecord = newArtist;
        }
        artistIdToLink = artistRecord.artistId;
      } else {
        // Should be caught by earlier validation, but as a safeguard:
        throw createError({ statusCode: 400, statusMessage: 'Artist data is incomplete.' });
      }

      processedArtistLinks.push({
        artistId: artistIdToLink,
        role: inputArtist.role || 'performer', // Default role if not provided
        isPrimaryArtist: inputArtist.isPrimaryArtist ? 1 : 0,
      });
    }

    // Ensure at least one primary artist if artists are provided
    if (processedArtistLinks.length > 0 && !processedArtistLinks.some(link => link.isPrimaryArtist === 1)) {
        // Default the first artist to primary if none are marked and artists exist
        // Or throw an error: throw createError({ statusCode: 400, statusMessage: 'At least one artist must be marked as primary.' });
        // For now, let's default the first one if applicable
        processedArtistLinks[0].isPrimaryArtist = 1;
    }

    // Handle file upload if a new cover image is provided
    let newCoverPath: string | undefined = undefined;
    if (coverImageFile && coverImageExtension) {
      const uploadsDir = path.join(process.cwd(), 'public', 'images', 'covers');
      // Ensure directory exists
      try {
        await access(uploadsDir);
      } catch (error) {
        // Directory doesn't exist, create it recursively
        await mkdir(uploadsDir, { recursive: true });
      }
      const uniqueFilename = `${uuidv4()}${coverImageExtension}`;
      const filePath = path.join(uploadsDir, uniqueFilename);
      await writeFile(filePath, coverImageFile);
      newCoverPath = `/images/covers/${uniqueFilename}`; // Path to be stored in DB
    }

    // 2. Update the album
    const albumUpdateData: Partial<typeof albums.$inferInsert> = {
      title: title,
      year: year,
      updatedAt: new Date().toISOString(),
    };

    if (newCoverPath) {
      albumUpdateData.coverPath = newCoverPath;
    }

    const [updatedAlbumRecord] = await tx
      .update(albums)
      .set(albumUpdateData)
      .where(
        and(
          eq(albums.albumId, albumId),
          eq(albums.userId, user.userId)
        )
      )
      .returning();

    if (!updatedAlbumRecord) {
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to update album record.',
      });
    }

    // 2. Update albumArtists junction table
    // First, remove all existing artist links for this album
    await tx.delete(albumArtists).where(eq(albumArtists.albumId, albumId as string));

    // Then, insert the new artist links
    if (processedArtistLinks.length > 0) {
      const albumArtistValues = processedArtistLinks.map(link => ({
        albumId: albumId as string,
        artistId: link.artistId,
        role: link.role,
        isPrimaryArtist: link.isPrimaryArtist,
      }));
      await tx.insert(albumArtists).values(albumArtistValues);
    }

    // 3. Fetch the updated album with artist details to return (similar to GET /api/albums/[id])
    const finalAlbumData = await tx.query.albums.findFirst({
      where: eq(albums.albumId, albumId as string),
      // No 'with' clause here, artist details fetched separately
    });

    if (!finalAlbumData) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Updated album not found.',
      });
    }

    const finalAlbumArtistsRaw = await tx.query.albumArtists.findMany({
      where: eq(albumArtists.albumId, albumId as string),
      with: {
        artist: {
          columns: {
            artistId: true,
            name: true,
          },
        },
      },
    });

    const finalAlbumArtistDetails: AlbumArtistDetail[] = finalAlbumArtistsRaw.map(link => ({
      artistId: link.artist.artistId,
      name: link.artist.name,
      role: link.role === null ? undefined : link.role,
      isPrimaryArtist: link.isPrimaryArtist === 1,
    }));

    return {
      ...finalAlbumData,
      coverPath: finalAlbumData.coverPath ? useCoverArt().getCoverArtUrl(finalAlbumData.coverPath) : undefined,
      artists: finalAlbumArtistDetails,
    };
  });
});
