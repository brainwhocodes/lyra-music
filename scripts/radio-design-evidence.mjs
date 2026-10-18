import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from 'sharp';

const run = process.argv[2];
if (!run) throw new Error('Pass the archived production browser evidence directory.');
const output = 'docs/design/lyra-radio/verification';
await fs.mkdir(output, { recursive: true });
const files = (await fs.readdir(run, { recursive: true })).map(file => path.join(run, file));
const digest = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
async function identity(file) {
  const bytes = await fs.readFile(file);
  const meta = await sharp(bytes).metadata();
  return { path: file.replaceAll('\\', '/'), sha256: digest(bytes), width: meta.width, height: meta.height };
}
const records = [];
for (const [id, filename] of [['home', 'route-landing.png'], ['radio-index', 'route-radio.png'], ['radio-detail', 'route-radio-quiet-hours.png']]) {
  const reference = `docs/design/lyra-radio/mockups/${id}.png`;
  const record = { id, reference: await identity(reference), captures: {} };
  for (const viewport of ['desktop', 'tablet', 'mobile']) {
    const capture = files.find(file => path.basename(file) === filename && file.includes(`-${viewport}`));
    if (!capture) throw new Error(`Missing ${viewport} ${filename}`);
    record.captures[viewport] = await identity(capture);
  }
  const left = await sharp(reference).resize({ width: 720 }).png().toBuffer();
  const right = await sharp(record.captures.desktop.path).resize({ width: 720 }).png().toBuffer();
  const lm = await sharp(left).metadata(), rm = await sharp(right).metadata();
  const height = Math.max(lm.height, rm.height);
  const comparison = `${output}/${id}-comparison.webp`;
  await sharp({ create: { width: 1440, height, channels: 4, background: '#96998c' } }).composite([{ input: left, left: 0, top: 0 }, { input: right, left: 720, top: 0 }]).webp({ quality: 90 }).toFile(comparison);
  const opaqueRight = await sharp(right).removeAlpha().png().toBuffer();
  const ghost = await sharp(opaqueRight).ensureAlpha(0.5).png().toBuffer();
  const overlay = `${output}/${id}-overlay.webp`;
  await sharp({ create: { width: 720, height, channels: 4, background: '#96998c' } }).composite([{ input: left, top: 0, left: 0 }, { input: ghost, top: 0, left: 0 }]).webp({ quality: 90 }).toFile(overlay);
  records.push({ ...record, comparison, overlay });
}
await fs.writeFile(`${output}/manifest.json`, JSON.stringify({ run, method: 'Sharp side-by-side and 50% overlay; uniform 720px width; full aspect ratios preserved. ODiff unavailable on this host. No numerical fidelity claim.', records }, null, 2) + '\n');
console.log('Saved three references with desktop, tablet and mobile evidence, comparisons and overlays.');
