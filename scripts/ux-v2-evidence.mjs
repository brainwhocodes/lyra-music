import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve('docs/design/lyra-radio/ux-v2');
const fingerprint = async path => {
  const bytes = await readFile(path);
  const { width, height } = await sharp(bytes).metadata();
  return { path, width, height, sha256: createHash('sha256').update(bytes).digest('hex') };
};
const generation = JSON.parse(await readFile(resolve(root, 'generation-records.json'), 'utf8'));
for (const record of generation.records) {
  record.outputEvidence = await fingerprint(record.output);
  record.referenceEvidence = await Promise.all(record.references.map(fingerprint));
}
await writeFile(resolve(root, 'generation-records.json'), JSON.stringify(generation, null, 2) + '\n');

const archive = process.argv[2];
if (archive) {
  const capture = (directory, file) => resolve(archive, directory, file);
  const mappings = [
    ['radio', 'radio-a-desktop', capture('responsive-routes-every-ro-7d068-rols-and-responsive-layouts-desktop', 'route-radio.png')],
    ['library', 'library-desktop', capture('responsive-routes-every-ro-7d068-rols-and-responsive-layouts-desktop', 'route-library.png')],
    ['player', 'player-desktop', capture('audio-analysis-audio-analy-d2732-ut-changing-paused-playback-desktop', 'audio-analysis-success.png')],
  ];
  // A source manifest may override discovered test-directory hashes without
  // modifying the frozen references or inferring unseen screenshot filenames.
  let overrides = {};
  try { overrides = JSON.parse(await readFile(resolve(root, 'capture-paths.json'), 'utf8')); } catch {}
  await mkdir(resolve(root, 'after'), { recursive: true });
  const records = [];
  for (const [id, concept, defaultPath] of mappings) {
    const path = overrides[id] || defaultPath;
    const reference = resolve(root, 'concepts', concept + '.png');
    const beforePath = resolve(root, 'before', id === 'player' ? 'player-tablet.png' : id + '-desktop.png');
    const after = await fingerprint(path);
    const actual = await readFile(path);
    await writeFile(resolve(root, 'after', id + '-desktop.png'), actual);
    const left = await sharp(reference).resize({ width: 720 }).removeAlpha().toBuffer();
    const right = await sharp(actual).resize({ width: 720 }).removeAlpha().toBuffer();
    const leftSize = await sharp(left).metadata(), rightSize = await sharp(right).metadata();
    const height = Math.max(leftSize.height, rightSize.height);
    await sharp({ create: { width: 1440, height, channels: 3, background: '#deded6' } })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 720, top: 0 }])
      .webp().toFile(resolve(root, 'after', id + '-comparison.webp'));
    const overlay = await sharp(right).ensureAlpha(0.5).toBuffer();
    await sharp({ create: { width: 720, height, channels: 3, background: '#deded6' } })
      .composite([{ input: left, left: 0, top: 0 }, { input: overlay, left: 0, top: 0 }])
      .webp().toFile(resolve(root, 'after', id + '-overlay.webp'));
    const responsive = {};
    for (const viewport of ['tablet', 'mobile']) {
      const responsivePath = id === 'player'
        ? capture(`audio-analysis-audio-analy-d2732-ut-changing-paused-playback-${viewport}`, 'audio-analysis-success.png')
        : capture(`responsive-routes-every-ro-7d068-rols-and-responsive-layouts-${viewport}`, `route-${id}.png`);
      responsive[viewport] = await fingerprint(responsivePath);
      await writeFile(resolve(root, 'after', `${id}-${viewport}.png`), await readFile(responsivePath));
    }
    records.push({ id, before: await fingerprint(beforePath), reference: await fingerprint(reference), after, responsive });
  }
  for (const [id, concept, path] of [
    ['radio', 'radio-mobile', capture('responsive-routes-every-ro-7d068-rols-and-responsive-layouts-mobile', 'route-radio.png')],
    ['player', 'player-mobile', capture('local-library-search-finds-21994--decodes-its-licensed-audio-mobile', 'full-screen-player.png')],
    ['player-analysis', 'player-mobile', capture('audio-analysis-audio-analy-d2732-ut-changing-paused-playback-mobile', 'audio-analysis-idle.png')],
  ]) {
    const reference = resolve(root, 'concepts', `${concept}.png`);
    if (id === 'player') await writeFile(resolve(root, 'after', 'player-mobile-top.png'), await readFile(path));
    if (id === 'player-analysis') await writeFile(resolve(root, 'after', 'player-mobile-idle-analysis.png'), await readFile(path));
    const left = await sharp(reference).resize({ width: 390 }).removeAlpha().toBuffer();
    const right = await sharp(path).resize({ width: 390 }).removeAlpha().toBuffer();
    const a = await sharp(left).metadata(), b = await sharp(right).metadata();
    await sharp({ create: { width: 780, height: Math.max(a.height, b.height), channels: 3, background: '#deded6' } })
      .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 390, top: 0 }])
      .webp().toFile(resolve(root, 'after', `${id}-mobile-comparison.webp`));
    records.push({ id: `${id}-mobile-reference`, reference: await fingerprint(reference), after: await fingerprint(path) });
  }
  await writeFile(resolve(root, 'verification.json'), JSON.stringify({ archive, method: 'Manual Sharp side-by-side and 50% overlays; uniform 720px desktop /390px mobile width; aspect ratios preserved; no numerical fidelity claim.', records }, null, 2) + '\n');
}
console.log('UX generation/evidence records updated.');
