import { createError, defineEventHandler, getRequestURL, setHeader } from 'h3';
import { readFile, realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import { getUserFromEvent } from '~/server/utils/auth';
import { uploadedImagePath } from '~/server/utils/uploaded-images';

export default defineEventHandler(async event => {
  if (!await getUserFromEvent(event)) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' });
  const file = uploadedImagePath(getRequestURL(event).pathname);
  if (!file) throw createError({ statusCode: 404, statusMessage: 'Image not found' });
  try {
    const [root, resolved] = await Promise.all([realpath(path.join(process.cwd(), 'uploads')), realpath(file)]);
    const relative = path.relative(root, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('Path outside uploads');
    const details = await stat(resolved);
    if (!details.isFile() || details.size > 20 * 1024 * 1024) throw new Error('Invalid image file');
    const type = path.extname(file).slice(1).toLowerCase();
    setHeader(event, 'Content-Type', `image/${type === 'jpg' ? 'jpeg' : type}`);
    setHeader(event, 'X-Content-Type-Options', 'nosniff');
    setHeader(event, 'Cache-Control', 'private, max-age=3600');
    return await readFile(resolved);
  } catch { throw createError({ statusCode: 404, statusMessage: 'Image not found' }); }
});
