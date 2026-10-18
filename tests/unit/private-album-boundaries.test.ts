import { afterEach, beforeEach, expect, test } from 'vitest';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink, realpath } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, relative, dirname, basename, isAbsolute } from 'node:path';
import { createHash } from 'node:crypto';
import { validatePrivateManifest, validatePrivateRun } from '../../scripts/private-albums-paths.mjs';

let workspace: string;
let extracted: string;
let run: string;
beforeEach(async () => {
  workspace = await mkdtemp(join(tmpdir(), 'lyra-private-boundary-'));
  extracted = join(workspace, '.test-data/private-albums/extracted');
  run = join(workspace, '.test-data/private-albums/runs/run-fresh');
  await mkdir(extracted, { recursive: true });
  await mkdir(run, { recursive: true });
});
async function removeOwned(path: string) {
  const root = await realpath(workspace);
  if (dirname(root) !== await realpath(tmpdir()) || !basename(root).startsWith('lyra-private-boundary-')) throw new Error('Unexpected temporary workspace');
  const child = relative(root, resolve(path));
  if (child.startsWith('..') || isAbsolute(child)) throw new Error('Cleanup escaped its allocated temporary workspace');
  await rm(path, { recursive: true, force: true });
}
afterEach(async () => { await removeOwned(workspace); });
const entry = (name: string, bytes = Buffer.from('original')) => ({ relativePath: name, audio: true, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex') });

test('accepts a fresh isolated run and a checksummed Unicode file', async () => {
  await writeFile(join(extracted, '音楽.ogg'), 'original');
  expect(await validatePrivateRun(workspace, run, true)).toBe(run);
  expect(await validatePrivateManifest(workspace, { files: [entry('音楽.ogg')] })).toEqual([join(extracted, '音楽.ogg')]);
});
test('refuses an existing database before SQLite can open or migrate it', async () => {
  const database = join(run, 'library.sqlite');
  await writeFile(database, 'leave this existing database untouched');
  await expect(validatePrivateRun(workspace, run, true)).rejects.toThrow('existing private database');
  expect(await readFile(database, 'utf8')).toBe('leave this existing database untouched');
});
test('rejects absolute and traversal manifest entries', async () => {
  for (const name of ['../outside.ogg', join(workspace, 'outside.ogg'), 'album/../track.ogg', 'C:outside.ogg']) {
    await expect(validatePrivateManifest(workspace, { files: [entry(name)] })).rejects.toThrow('Unsafe private manifest path');
  }
});
test('rejects a redirected extraction directory even when its target contains matching bytes', async () => {
  const outside = join(workspace, 'outside');
  await mkdir(outside);
  await writeFile(join(outside, 'track.ogg'), 'original');
  await removeOwned(extracted);
  await symlink(outside, extracted, process.platform === 'win32' ? 'junction' : 'dir');
  await expect(validatePrivateManifest(workspace, { files: [entry('track.ogg')] })).rejects.toThrow('redirected');
});
test('rejects changed bytes and duplicate paths in the direct-import manifest', async () => {
  await writeFile(join(extracted, 'track.ogg'), 'tampered');
  await expect(validatePrivateManifest(workspace, { files: [entry('track.ogg')] })).rejects.toThrow('checksum');
  await writeFile(join(extracted, 'track.ogg'), 'original');
  await expect(validatePrivateManifest(workspace, { files: [entry('track.ogg'), entry('track.ogg')] })).rejects.toThrow('duplicate');
});
