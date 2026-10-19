import sharp from 'sharp';
import fs from 'node:fs/promises';
const root = new URL('./after/', import.meta.url);
const output = new URL('details/', root);
await fs.mkdir(output, { recursive: true });
// Deterministic crops of genuine browser screenshots for legible visual review.
// These are evidence only, never production artwork or altered references.
for (const [name, top, height, label] of [
  ['home', 0, 1400, 'hero-and-promise'],
  ['features', 0, 1200, 'hero-and-player'],
  ['features', 3450, 650, 'daily-recommendations'],
  ['self-host', 1000, 600, 'music-flow'],
  ['self-host', 3030, 700, 'optional-models'],
]) {
  await sharp(new URL(`${name}-desktop.png`, root).pathname.replace(/^\/(\w:)/, '$1'))
    .extract({ left: 0, top, width: 1920, height })
    .webp({ quality: 85 })
    .toFile(new URL(`${name}-${label}.webp`, output).pathname.replace(/^\/(\w:)/, '$1'));
}
