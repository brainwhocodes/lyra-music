import { realpath, lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve, relative, isAbsolute } from 'node:path';

const samePath = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
async function canonicalDirectory(path) {
  const actual = await realpath(path);
  if (!samePath(actual, resolve(path)) || (await lstat(path)).isSymbolicLink()) throw new Error('Private directory or ancestor was redirected');
  return actual;
}
export async function validatePrivateRun(repository, run, fresh = false) {
  const workspace = await realpath(repository);
  const root = await canonicalDirectory(join(workspace, '.test-data/private-albums/runs'));
  const directory = await canonicalDirectory(run);
  const child = relative(root, directory);
  if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Private run must remain below the allocated runs root');
  if (fresh) {
    for (const name of ['library.sqlite', 'library.sqlite-wal', 'library.sqlite-shm', 'import-report.json']) {
      const exists = await lstat(join(directory, name)).then(() => true, error => { if (error.code !== 'ENOENT') throw error; return false; });
      if (exists) throw new Error('Refusing to import into a nonempty existing private database run');
    }
  }
  return directory;
}
export async function validatePrivateManifest(repository, manifest) {
  const workspace = await realpath(repository);
  const directory = await canonicalDirectory(join(workspace, '.test-data/private-albums/extracted'));
  if (!Array.isArray(manifest.files) || !manifest.files.length) throw new Error('Missing private file manifest');
  const seen = new Set();
  const audio = [];
  for (const entry of manifest.files) {
    const name = entry.relativePath;
    if (typeof name !== 'string' || isAbsolute(name) || name.includes(':') || name.split(/[\\/]/).some(part => !part || part === '.' || part === '..')) throw new Error('Unsafe private manifest path');
    const file = resolve(directory, name);
    const child = relative(directory, file);
    if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Private manifest path escaped extraction');
    if (!samePath(await realpath(file), file) || (await lstat(file)).isSymbolicLink()) throw new Error('Private file or ancestor was redirected');
    const key = file.toLowerCase();
    if (seen.has(key)) throw new Error('Private manifest contains duplicate paths');
    seen.add(key);
    const details = await lstat(file);
    if (!details.isFile() || details.size !== entry.bytes || !/^[a-f0-9]{64}$/.test(entry.sha256)) throw new Error('Private file size or checksum metadata mismatch');
    const hash = createHash('sha256');
    for await (const block of createReadStream(file)) hash.update(block);
    if (hash.digest('hex') !== entry.sha256) throw new Error('Private file checksum mismatch');
    if (entry.audio === true) audio.push(file);
  }
  return audio;
}
