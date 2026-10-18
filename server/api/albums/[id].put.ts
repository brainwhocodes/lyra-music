import { createError, defineEventHandler, getRouterParam, readMultipartFormData } from 'h3';
import { and, eq } from 'drizzle-orm';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { db } from '~/server/db';
import { albumArtists, albums, artists } from '~/server/db/schema';
import { getUserFromEvent } from '~/server/utils/auth';
import { splitArtistString } from '~/server/utils/artist-utils';
import { uploadedImagePath } from '~/server/utils/uploaded-images';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const albumId = getRouterParam(event, 'id');
  if (!albumId) throw createError({ statusCode: 400, statusMessage: 'Album ID is required' });
  const owned = and(eq(albums.albumId, albumId), eq(albums.userId, user.userId));
  if (!db.select().from(albums).where(owned).get()) throw createError({ statusCode: 404, statusMessage: 'Album not found' });
  const parts = await readMultipartFormData(event);
  if (!parts?.length) throw createError({ statusCode: 400, statusMessage: 'No updateable fields provided.' });

  const update: Partial<typeof albums.$inferInsert> = {};
  let artistNames: string[] | undefined;
  let image: Buffer | undefined;
  const seen = new Set<string>();
  for (const part of parts) {
    if (!part.name || !['title', 'artistName', 'year', 'coverImage'].includes(part.name)) continue;
    if (seen.has(part.name)) throw createError({ statusCode: 400, statusMessage: 'Duplicate form fields are not allowed.' });
    seen.add(part.name);
    if (part.name === 'coverImage') {
      if (!part.filename || !part.data.length) throw createError({ statusCode: 400, statusMessage: 'Choose a cover image.' });
      if (part.data.length > 5 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Image exceeds 5 MB.' });
      try {
        const decoder = sharp(part.data, { limitInputPixels: 20_000_000 });
        const metadata = await decoder.metadata();
        if (!metadata.width || !metadata.height || !['png', 'jpeg', 'webp', 'gif'].includes(metadata.format || '')) throw new Error();
        image = await decoder.webp({ quality: 85 }).toBuffer();
      } catch { throw createError({ statusCode: 400, statusMessage: 'Choose a valid PNG, JPEG, WebP or GIF image.' }); }
      continue;
    }
    if (part.data.length > 4_000) throw createError({ statusCode: 400, statusMessage: 'Form field is too long.' });
    const value = part.data.toString('utf8').trim();
    if (part.name === 'title') {
      if (!value || value.length > 300) throw createError({ statusCode: 400, statusMessage: 'Title must contain 1 to 300 characters.' });
      update.title = value;
    } else if (part.name === 'year') {
      if (value && (!/^\d{1,4}$/.test(value) || Number(value) < 1)) throw createError({ statusCode: 400, statusMessage: 'Year must be between 1 and 9999, or blank.' });
      update.year = value ? Number(value) : null;
    } else {
      artistNames = [...new Set(splitArtistString(value))];
      if (!artistNames.length || artistNames.length > 50 || artistNames.some(name => name.length > 200)) throw createError({ statusCode: 400, statusMessage: 'Provide 1 to 50 artist names, each under 200 characters.' });
    }
  }
  if (!seen.size) throw createError({ statusCode: 400, statusMessage: 'No updateable fields provided.' });
  let written: string | undefined;
  let superseded: string | undefined;
  try {
    if (image) {
      update.coverPath = `/uploads/images/covers/${randomUUID()}.webp`;
      written = uploadedImagePath(update.coverPath)!;
      await mkdir(path.dirname(written), { recursive: true });
      await writeFile(written, image, { flag: 'wx' });
    }
    const result = db.transaction(tx => {
      const previous = tx.select().from(albums).where(owned).get();
      if (!previous) throw createError({ statusCode: 404, statusMessage: 'Album not found' });
      // Only our per-upload UUID covers are safe to remove; scanner hashes can be shared.
      if (written && /^\/uploads\/images\/covers\/[a-f0-9-]{36}\.webp$/i.test(previous.coverPath || '')) superseded = uploadedImagePath(previous.coverPath!);
      tx.update(albums).set({ ...update, updatedAt: new Date().toISOString() }).where(owned).run();
      if (artistNames) {
        const links = artistNames.map((name, index) => {
          const artist = tx.select().from(artists).where(eq(artists.name, name)).get() || tx.insert(artists).values({ name }).returning().get();
          return { albumId, artistId: artist.artistId, role: 'performer', isPrimaryArtist: index === 0 ? 1 : 0 };
        });
        tx.delete(albumArtists).where(eq(albumArtists.albumId, albumId)).run();
        tx.insert(albumArtists).values(links).run();
      }
      const record = tx.select().from(albums).where(owned).get()!;
      const credits = tx.select({ artistId: artists.artistId, name: artists.name, role: albumArtists.role, isPrimaryArtist: albumArtists.isPrimaryArtist })
        .from(albumArtists).innerJoin(artists, eq(albumArtists.artistId, artists.artistId)).where(eq(albumArtists.albumId, albumId)).all();
      return { ...record, artists: credits.map(credit => ({ ...credit, isPrimaryArtist: credit.isPrimaryArtist === 1 })) };
    });
    if (superseded) await unlink(superseded).catch(() => {});
    return result;
  } catch (error) {
    if (written) await unlink(written).catch(() => {});
    throw error;
  }
});
