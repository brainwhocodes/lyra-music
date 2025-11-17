import { join } from 'node:path';
import { existsSync, createReadStream } from 'node:fs';
import { sendStream, defineEventHandler } from 'h3';

export default defineEventHandler(event => {
  // requested path after /images/covers/
  const rel = event.context.params!.slug as string | string[];
  const file = Array.isArray(rel) ? rel.join('/') : rel;
  // dev → ./public ; prod → .output/public
  const projectRoot = process.cwd();
  const base = process.env.NODE_ENV === 'production'
    ? join(projectRoot, 'uploads', 'images', 'covers')
    : join(projectRoot, 'uploads', 'images', 'covers');

  const abs = join(base, file);

  if (!existsSync(abs)) return;            // fall through to 404
  return sendStream(event, createReadStream(abs));
});