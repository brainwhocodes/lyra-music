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
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  }

  const albumId = getRouterParam(event, 'id');
  if (!albumId) {
    throw createError({ statusCode: 400, statusMessage: 'Album ID is required' });
  }

  const multipartFormData = await readMultipartFormData(event);
  if (!multipartFormData) {
    throw createError({ statusCode: 400, statusMessage: 'Request body is missing.' });
  }

  let title: string | undefined;
  let artistNameString: string | undefined;
  let year: number | null | undefined = undefined;
  let coverImageFile: Buffer | undefined;
  let coverImageExtension: string | undefined;

  for (const part of multipartFormData) {
    if (part.name === 'title') title = part.data.toString().trim();
    if (part.name === 'artistName') artistNameString = part.data.toString().trim();
    if (part.name === 'year') {
      const yearStr = part.data.toString().trim();
      year = yearStr ? parseInt(yearStr, 10) : null;
      if (yearStr && isNaN(year as number)) year = null;
    }
    if (part.name === 'coverImage' && part.filename && part.data.length > 0) {
      coverImageFile = part.data;
      coverImageExtension = path.extname(part.filename);
    }
  }

  if (title === undefined && artistNameString === undefined && year === undefined && coverImageFile === undefined) {
    throw createError({ statusCode: 400, statusMessage: 'No updateable fields provided.' });
  }

  return await db.transaction(async (tx) => {
    const existingAlbum = await tx.query.albums.findFirst({
      where: and(eq(albums.albumId, albumId), eq(albums.userId, user.userId)),
    });

    if (!existingAlbum) {
      throw createError({ statusCode: 404, statusMessage: 'Album not found or permission denied.' });
    }

    const albumUpdateData: Partial<typeof albums.$inferInsert> = {};
    let hasAlbumRecordChanges = false;

    if (title !== undefined) {
      albumUpdateData.title = title;
      hasAlbumRecordChanges = true;
    }
    if (year !== undefined) {
      albumUpdateData.year = year;
      hasAlbumRecordChanges = true;
    }

    if (coverImageFile && coverImageExtension) {
      const uploadsDir = path.join(process.cwd(), 'public', 'images', 'covers');
      await mkdir(uploadsDir, { recursive: true });
      const uniqueFilename = `${uuidv4()}${coverImageExtension}`;
      const filePath = path.join(uploadsDir, uniqueFilename);
      await writeFile(filePath, coverImageFile);
      albumUpdateData.coverPath = `/images/covers/${uniqueFilename}`;
      hasAlbumRecordChanges = true;
    }

    if (hasAlbumRecordChanges) {
      albumUpdateData.updatedAt = new Date().toISOString();
      await tx.update(albums).set(albumUpdateData).where(eq(albums.albumId, albumId));
    }

    if (artistNameString !== undefined) {
      const parsedArtistNames = splitArtistString(artistNameString);
      if (parsedArtistNames.length === 0) {
        throw createError({ statusCode: 400, statusMessage: 'Artist name cannot be empty.' });
      }

      const processedArtistLinks: Array<Omit<typeof albumArtists.$inferInsert, 'albumId' | 'albumArtistId'>> = [];
      for (const [index, name] of parsedArtistNames.entries()) {
        let artistRecord = await tx.query.artists.findFirst({ where: eq(artists.name, name) });
        if (!artistRecord) {
          [artistRecord] = await tx.insert(artists).values({ name }).returning();
        }
        if (!artistRecord) {
          throw createError({ statusCode: 500, statusMessage: `Failed to process artist ${name}` });
        }
        processedArtistLinks.push({
          artistId: artistRecord.artistId,
          role: 'performer',
          isPrimaryArtist: index === 0 ? 1 : 0,
        });
      }

      await tx.delete(albumArtists).where(eq(albumArtists.albumId, albumId));
      if (processedArtistLinks.length > 0) {
        const albumArtistValues = processedArtistLinks.map(link => ({ albumId, ...link }));
        await tx.insert(albumArtists).values(albumArtistValues);
      }
    }

    const finalAlbumData = await tx.query.albums.findFirst({
      where: eq(albums.albumId, albumId),
    });

    if (!finalAlbumData) {
      throw createError({ statusCode: 404, statusMessage: 'Updated album not found.' });
    }

    const finalAlbumArtistsRaw = await tx.query.albumArtists.findMany({
      where: eq(albumArtists.albumId, albumId),
      with: { artist: { columns: { artistId: true, name: true } } },
    });

    const finalAlbumArtistDetails: AlbumArtistDetail[] = finalAlbumArtistsRaw.map(link => ({
      artistId: link.artist.artistId,
      name: link.artist.name,
      role: link.role ?? undefined,
      isPrimaryArtist: link.isPrimaryArtist === 1,
    }));

    return {
      ...finalAlbumData,
      coverPath: finalAlbumData.coverPath ? useCoverArt().getCoverArtUrl(finalAlbumData.coverPath) : undefined,
      artists: finalAlbumArtistDetails,
    };
  });
});
