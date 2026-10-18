import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';

const recordPath = 'docs/design/lyra-radio/genres-v1/generation-records.json';
const manifest = JSON.parse(await readFile(recordPath, 'utf8'));
const referencePath = 'docs/design/lyra-radio/genres-v1/reference.png';
try { await readFile(referencePath); }
catch { await copyFile(manifest.records[0].reference, referencePath); }
const referenceBytes = await readFile(referencePath);
const referenceMetadata = await sharp(referenceBytes).metadata();
manifest.referenceEvidence = { path: referencePath, role: 'Art treatment and color reference; subjects varied', width: referenceMetadata.width, height: referenceMetadata.height, sha256: createHash('sha256').update(referenceBytes).digest('hex') };
for (const record of manifest.records) {
  await mkdir(path.dirname(record.output), { recursive: true });
  // Originals in the repository make exports reproducible on another machine.
  try { await readFile(record.output); }
  catch { await copyFile(record.rawOutput, record.output); }
  await mkdir(path.dirname(record.production), { recursive: true });
  await sharp(record.output).resize(768, 768, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 82 }).toFile(record.production);
  for (const [key, file] of [['sourceEvidence', record.output], ['productionEvidence', record.production]]) {
    const data = await readFile(file);
    const metadata = await sharp(data).metadata();
    record[key] = { path: file, width: metadata.width, height: metadata.height, bytes: data.length, sha256: createHash('sha256').update(data).digest('hex') };
  }
}
await writeFile(recordPath, JSON.stringify(manifest, null, 2) + '\n');
console.log(manifest.records.map(({id, productionEvidence}) => ({ id, ...productionEvidence })));
