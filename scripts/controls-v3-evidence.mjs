import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import sharp from 'sharp';

const root = resolve('docs/design/lyra-radio/controls-v3');
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

// Explicit capture paths are supplied only after actual completed browser runs.
if (process.argv[2]) {
  const captures = JSON.parse(await readFile(process.argv[2], 'utf8'));
  await mkdir(resolve(root, 'after'), { recursive: true });
  const records = [];
  for (const { id, source, reference } of captures) {
    const actual = await readFile(source);
    const output = resolve(root, 'after', id + '.png');
    await writeFile(output, actual);
    const record = { id, source: await fingerprint(source), after: await fingerprint(output) };
    if (reference) {
      const left = await sharp(reference).resize({ width: 720 }).flatten({ background: '#f3f4f6' }).toBuffer();
      const right = await sharp(actual).resize({ width: 720 }).flatten({ background: '#f3f4f6' }).toBuffer();
      const a = await sharp(left).metadata(), b = await sharp(right).metadata();
      await sharp({ create: { width: 1440, height: Math.max(a.height, b.height), channels: 3, background: '#f3f4f6' } })
        .composite([{ input: left, left: 0, top: 0 }, { input: right, left: 720, top: 0 }])
        .webp().toFile(resolve(root, 'after', id + '-comparison.webp'));
      record.reference = await fingerprint(reference);
    }
    records.push(record);
  }
  await writeFile(resolve(root, 'verification.json'), JSON.stringify({
    method: 'Manual image review with uniform-width comparisons; aspect ratios preserved. Generated boards contain multiple specimens, so no pixel similarity score or full-board overlay is claimed.',
    records,
  }, null, 2) + '\n');
}
console.log('Controls-v3 evidence records updated.');
