import { createError, defineEventHandler, getRouterParam, readBody } from 'h3';
import { and, eq } from 'drizzle-orm';
import { writeFile, mkdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { v7 as uuidv7 } from 'uuid';
import sharp from 'sharp';
import { radioChannels } from '~/server/db/schema';
import { db } from '~/server/db';
import { getUserFromEvent } from '~/server/utils/auth';
import { stationImagePath } from '~/server/utils/radio-station';

export default defineEventHandler(async event => {
  const user = await getUserFromEvent(event);
  if (!user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const id = getRouterParam(event, 'id');
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Channel ID is required' });
  const owned = and(eq(radioChannels.channelId, id), eq(radioChannels.userId, user.userId));
  if (!db.select().from(radioChannels).where(owned).get()) throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
  const body = await readBody(event);
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw createError({ statusCode: 400, statusMessage: 'Expected image data.' });
  const prepared: { field: 'logoImagePath' | 'backgroundImagePath'; stored: string; file: string; bytes: Buffer }[] = [];
  const removed: ('logoImagePath' | 'backgroundImagePath')[] = [];
  for (const kind of ['logo', 'background'] as const) {
    const base64 = body[`${kind}ImageBase64`];
    const extension = body[`${kind}ImageExtension`];
    const remove = body[kind === 'logo' ? 'removeLogo' : 'removeBackground'];
    if (remove !== undefined && typeof remove !== 'boolean') throw createError({ statusCode: 400, statusMessage: 'Invalid image removal flag.' });
    if (remove === true) {
      if (base64 !== undefined || extension !== undefined) throw createError({ statusCode: 400, statusMessage: 'Cannot upload and remove the same image.' });
      removed.push(`${kind}ImagePath`);
      continue;
    }
    if (base64 === undefined && extension === undefined) continue;
    if (typeof base64 !== 'string' || typeof extension !== 'string' || !/^\.(png|jpe?g|webp|gif)$/i.test(extension) ||
        !base64.length || base64.length > 7_000_000 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64)) {
      throw createError({ statusCode: 400, statusMessage: 'Provide a PNG, JPEG, WebP or GIF image under 5 MB.' });
    }
    const bytes = Buffer.from(base64, 'base64');
    if (bytes.length > 5 * 1024 * 1024) throw createError({ statusCode: 413, statusMessage: 'Image exceeds 5 MB.' });
    let format: string | undefined;
    try {
      const metadata = await sharp(bytes, { limitInputPixels: 20_000_000 }).metadata();
      format = metadata.format;
      if (!metadata.width || !metadata.height || !['png', 'jpeg', 'webp', 'gif'].includes(format || '')) throw new Error();
    } catch { throw createError({ statusCode: 400, statusMessage: 'Invalid or oversized image.' }); }
    const stored = `/uploads/radio/${kind === 'logo' ? 'logos' : 'backgrounds'}/${uuidv7()}.${format}`;
    prepared.push({ field: `${kind}ImagePath`, stored, file: stationImagePath(stored)!, bytes });
  }
  const written: string[] = [];
  const superseded: string[] = [];
  let result: typeof radioChannels.$inferSelect | undefined;
  try {
    for (const image of prepared) {
      await mkdir(path.dirname(image.file), { recursive: true });
      await writeFile(image.file, image.bytes, { flag: 'wx' });
      written.push(image.file);
    }
    result = db.transaction(tx => {
      const previous = tx.select().from(radioChannels).where(owned).get();
      if (!previous) throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
      if (!prepared.length && !removed.length) return previous;
      for (const field of [...prepared.map(image => image.field), ...removed]) {
        const oldPath = stationImagePath(previous[field]);
        if (oldPath) superseded.push(oldPath);
      }
      const fields = Object.fromEntries([...prepared.map(image => [image.field, image.stored]), ...removed.map(field => [field, null])]);
      return tx.update(radioChannels).set({ ...fields, updatedAt: new Date().toISOString() }).where(owned).returning().get();
    });
  } catch (error) {
    await Promise.all(written.map(file => unlink(file).catch(() => {})));
    throw error;
  }
  // Only remove replaced, allowlisted images after the new paths have committed.
  await Promise.all(superseded.map(file => unlink(file).catch(() => {})));
  return result;
});
