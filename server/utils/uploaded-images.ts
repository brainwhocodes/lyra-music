import path from 'node:path';

/** Only generated raster filenames, never user-provided paths or arbitrary uploads. */
export function uploadedImagePath(stored: string): string | undefined {
  if (!/^\/uploads\/(?:images\/(?:covers|artists)\/(?:[a-f0-9]{64}|[a-f0-9-]{36})|radio\/(?:logos|backgrounds)\/[a-f0-9-]{36})\.(?:png|jpe?g|webp|gif)$/i.test(stored)) return;
  return path.join(process.cwd(), stored);
}
