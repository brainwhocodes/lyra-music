import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

// Generate once at development time. No image service or runtime model is needed.
const root = process.cwd();
const inputs = [
  ['rooftop-dj', 'public/images/lyra-radio/rooftop-dj.png'],
  ...['night-transmission', 'platform-session', 'record-room'].map(name =>
    [name, `docs/design/lyra-radio/artwork-v2/originals/${name}.png`]),
  ...['electronic', 'rock', 'jazz', 'pop', 'hip-hop', 'ambient', 'default'].map(name =>
    [`genre-${name}`, `docs/design/lyra-radio/genres-v1/originals/${name}.png`]),
];
try {
  const extra = JSON.parse(await readFile(path.join(root, 'docs/design/lyra-radio/landing-v2/artwork-inputs.json'), 'utf8'));
  for (const entry of extra) {
    if (!/^[a-z0-9-]+$/.test(entry.name) || !entry.source.startsWith('docs/design/lyra-radio/landing-v2/')) throw new Error('Unexpected marketing artwork input');
    inputs.push([entry.name, entry.source]);
  }
} catch (error) { if (error.code !== 'ENOENT') throw error; }
const output = path.join(root, 'public/images/responsive');
await mkdir(output, { recursive: true });
const manifest = {};
const evidence = [];
for (const [name, relative] of inputs) {
  const input = await readFile(path.join(root, relative));
  const metadata = await sharp(input).metadata();
  const widths = [...new Set([96, 160, 320, 480, 768, 1024, 1536].filter(w => w <= metadata.width).concat(metadata.width))].sort((a,b) => a-b);
  const variants = [];
  for (const width of widths) {
    for (const format of ['avif', 'webp']) {
      const filename = `${name}-${width}.${format}`;
      const pipeline = sharp(input).resize({ width, withoutEnlargement: true });
      const buffer = await (format === 'avif'
        ? pipeline.avif({ quality: 54, effort: 4, chromaSubsampling: '4:4:4' })
        : pipeline.webp({ quality: 82, effort: 5 })).toBuffer();
      await writeFile(path.join(output, filename), buffer);
      variants.push({ width, format, bytes: buffer.length, sha256: createHash('sha256').update(buffer).digest('hex') });
    }
  }
  manifest[name] = { width: metadata.width, height: metadata.height, widths };
  evidence.push({ name, source: relative, sourceBytes: input.length, sourceSha256: createHash('sha256').update(input).digest('hex'), variants });
  console.log(`${name}: ${widths.length} sizes in AVIF and WebP`);
}
await writeFile(path.join(root, 'utils/artwork-manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
await writeFile(path.join(root, 'docs/design/lyra-radio/artwork-v2/responsive-assets.json'), JSON.stringify({ generatedAt: new Date().toISOString(), upscaled: false, assets: evidence }, null, 2) + '\n');
