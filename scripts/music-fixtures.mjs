import { createHash } from 'node:crypto';
import { readFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';

const root = fileURLToPath(new URL('../tests/fixtures/music/', import.meta.url));
const manifest = JSON.parse(await readFile(join(root, 'manifest.json'), 'utf8'));
const hash = (bytes) => createHash('sha256').update(bytes).digest('hex');
const args = new Set(process.argv.slice(2));
if ([...args].some((arg) => !['--verify', '--fetch', '--rebuild'].includes(arg))) {
  throw new Error('Usage: node scripts/music-fixtures.mjs [--verify | --fetch | --rebuild]');
}
const check = async (path, expected) => {
  const actual = hash(await readFile(path));
  if (actual !== expected) throw new Error(`Checksum mismatch for ${path}: ${actual} (expected ${expected})`);
};
if (args.has('--fetch') || args.has('--rebuild')) {
  await mkdir(join(root, '.cache'), { recursive: true });
  for (const track of manifest.tracks) {
    const source = join(root, '.cache', `${track.id}.mp3`);
    // curl uses the host certificate/proxy configuration on Windows too. No shell interpolation.
    const download = spawnSync('curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '180', '--output', source, track.downloadUrl], { stdio: 'inherit' });
    if (download.error || download.status !== 0) throw download.error ?? new Error(`Download failed: ${track.downloadUrl}`);
    await check(source, track.sourceSha256);
    if (args.has('--rebuild')) {
      const output = resolve(root, track.file);
      const conversion = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-ss', String(track.excerptStartSeconds), '-i', source, '-t', String(track.excerptDurationSeconds), '-map_metadata', '-1', '-vn', '-c:a', 'libmp3lame', '-b:a', '96k', '-ar', '44100', '-ac', '2', '-metadata', `title=${track.title}`, '-metadata', `artist=${manifest.artist}`, '-metadata', `album=${track.album}`, '-metadata', `date=${track.year}`, '-metadata', `track=${track.trackNumber}`, '-metadata', `copyright=${manifest.artist}; CC BY 4.0; ${manifest.licenseUrl}`, output], { stdio: 'inherit' });
      if (conversion.error || conversion.status !== 0) throw conversion.error ?? new Error(`FFmpeg failed for ${track.id}`);
    }
    console.log(`Verified original: ${track.title}`);
  }
}
for (const fixture of [...manifest.tracks, manifest.speech]) {
  await check(resolve(root, fixture.file), fixture.sha256);
  console.log(`Verified fixture: ${fixture.file}`);
}
