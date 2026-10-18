import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const directory = path.resolve('public/images/lyra-radio');
const assets = [];
for (const [name, width] of [['rooftop-dj', 1536], ['wordmark', 720], ['mark', 256]]) {
  const input = path.join(directory, `${name}.png`);
  const output = path.join(directory, `${name}.webp`);
  await sharp(input).resize({ width, withoutEnlargement: true }).webp({ quality: 90, alphaQuality: 100 }).toFile(output);
  const metadata = await sharp(output).metadata();
  assets.push({ source: path.relative(process.cwd(), input), output: path.relative(process.cwd(), output), width: metadata.width, height: metadata.height, sha256: crypto.createHash('sha256').update(await fs.readFile(output)).digest('hex'), operation: 'Proportional resize and WebP encoding only; no crop or artwork editing' });
}
await sharp(path.join(directory, 'mark.png')).resize(64, 64, { fit: 'inside' }).png().toFile(path.join(directory, 'favicon.png'));
await fs.writeFile('docs/design/lyra-radio/asset-exports.json', JSON.stringify(assets, null, 2) + '\n');
console.log('Exported proportional WebP assets and 64px favicon; PNG masters preserved.');
