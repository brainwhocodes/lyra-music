import { H3Event, readMultipartFormData, createError } from 'h3';
import { db } from '~/server/db';
import { albums, artists, users, albumArtists } from '~/server/db/schema';
import { writeFile, mkdir, access } from 'node:fs/promises'; // For promise-based file system operations
import path from 'path';   // For path manipulation
import { v4 as uuidv4 } from 'uuid'; // For generating unique filenames
import { eq, and } from 'drizzle-orm';
import { getUserFromEvent } from '~/server/utils/auth';

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
  let artistName: string | undefined;
  let year: number | null | undefined = undefined;
  let coverImageFile: Buffer | undefined;
  let coverImageExtension: string | undefined;

  if (multipartFormData) {
    for (const part of multipartFormData) {
      if (part.name === 'title') title = part.data.toString().trim();
      if (part.name === 'artistName') artistName = part.data.toString().trim();
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
  if (!artistName) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Artist name is required',
    });
  }

  // Start a transaction
  return await db.transaction(async (tx) => {
    // 1. Find or create the artist
    let artist = await tx.query.artists.findFirst({
      where: (artistsTable, { eq }) => eq(artistsTable.name, artistName as string),
    });

    if (!artist) {
      // Create new artist if not found
      const [newArtist] = await tx
        .insert(artists)
        .values({
          name: artistName as string,
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

    // Handle file upload if a new cover image is provided
    let newCoverPath: string | undefined = undefined;
    if (coverImageFile && coverImageExtension) {
      const uploadsDir = path.join(process.cwd(), 'public', 'uploads', 'album-covers');
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
      newCoverPath = `/uploads/album-covers/${uniqueFilename}`; // Path to be stored in DB
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

    // Manage albumArtists junction table
    if (artist && artist.artistId) {
      // Remove existing primary artist entries for this album
      await tx.delete(albumArtists)
        .where(and(
          eq(albumArtists.albumId, albumId as string),
          eq(albumArtists.isPrimaryArtist, 1)
        ));

      // Add new primary artist entry
      await tx.insert(albumArtists).values({
        albumId: albumId as string,
        artistId: artist.artistId,
        isPrimaryArtist: 1, // Mark as primary artist
      });
    }

    // Fetch the updated album with artist details to return
    const finalUpdatedAlbum = await tx.query.albums.findFirst({
      where: eq(albums.albumId, albumId as string),
    });

    if (!finalUpdatedAlbum) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Updated album not found after linking artist.',
      });
    }

    // To include artistName in the response, you'd fetch it:
    let artistNameForResponse = artistName; // from input
    if (artist && artist.artistId) {
      const primaryArtistLink = await tx.query.albumArtists.findFirst({
        where: and(eq(albumArtists.albumId, finalUpdatedAlbum.albumId), eq(albumArtists.isPrimaryArtist, 1)),
        with: { artist: true }
      });
      if (primaryArtistLink && primaryArtistLink.artist && typeof (primaryArtistLink.artist as any).name === 'string') {
        artistNameForResponse = (primaryArtistLink.artist as any).name;
      }
    }

    return {
      ...finalUpdatedAlbum,
      artistName: artistNameForResponse, // Add artistName for client convenience
    };
  });
});
