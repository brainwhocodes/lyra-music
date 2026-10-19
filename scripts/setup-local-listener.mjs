import { readFile, writeFile, realpath, lstat, mkdir, rename } from 'node:fs/promises';
import { resolve, join, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import Database from 'better-sqlite3';
import dotenv from 'dotenv';
import { chromium, expect } from '@playwright/test';
import { validatePrivateRun, validatePrivateManifest } from './private-albums-paths.mjs';
import { seedLocalListener, localAlbumId } from './local-listener-data.mjs';

const repository = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const env = dotenv.parse(await readFile(join(repository, '.env'), 'utf8'));
const databasePath = resolve(repository, process.env.DATABASE_URL || env.DATABASE_URL || './db.sqlite');
const baseURL = process.env.LYRA_LOCAL_URL || 'http://127.0.0.1:3000';
if (!['127.0.0.1', 'localhost', '[::1]'].includes(new URL(baseURL).hostname)) throw new Error('Local setup requires a loopback server');
const same = (a, b) => process.platform === 'win32' ? a.toLowerCase() === b.toLowerCase() : a === b;
async function canonical(path) {
  if (!same(await realpath(path), path) || (await lstat(path)).isSymbolicLink()) throw new Error('Local setup path was redirected');
  return path;
}
async function directory(parent, name) {
  const path = join(parent, name);
  await mkdir(path).catch(error => { if (error.code !== 'EEXIST') throw error; });
  return canonical(path);
}
async function save(path, value, exclusive = false) {
  if (exclusive) return writeFile(path, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  await canonical(path);
  const temporary = `${path}.${randomBytes(8).toString('hex')}.tmp`;
  await writeFile(temporary, JSON.stringify(value, null, 2), { flag: 'wx', mode: 0o600 });
  await rename(temporary, path);
}
const child = relative(repository, databasePath);
if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Local database must be an existing file inside this checkout');
await canonical(databasePath);
const sourceDescriptor = JSON.parse(await readFile(join(repository, '.test-data/private-albums/current-run.json'), 'utf8'));
const sourceRun = await validatePrivateRun(repository, sourceDescriptor.run);
const sourcePath = await canonical(join(sourceRun, 'library.sqlite'));
if (same(sourcePath, databasePath)) throw new Error('Source and target databases must differ');
const manifest = JSON.parse(await readFile(join(repository, '.test-data/private-albums/extracted/manifest.json'), 'utf8'));
const audioFiles = new Set((await validatePrivateManifest(repository, manifest)).map(path => resolve(path)));
const report = JSON.parse(await readFile(join(sourceRun, 'import-report.json'), 'utf8'));
const source = new Database(sourcePath, { readonly: true, fileMustExist: true });
const sourceUser = source.prepare('SELECT user_id FROM users WHERE email=?').get(report.credentials.email);
if (!sourceUser) throw new Error('Verified source account is missing');
const sourceTracks = source.prepare('SELECT t.file_path FROM tracks t JOIN albums a ON a.album_id=t.album_id WHERE a.user_id=?').all(sourceUser.user_id);
if (sourceTracks.length !== audioFiles.size || sourceTracks.some(row => !audioFiles.has(resolve(row.file_path)))) throw new Error('Source database does not match the verified original audio manifest');
const sourceAlbums = source.prepare('SELECT album_id,cover_path FROM albums WHERE user_id=?').all(sourceUser.user_id);
const coverData = new Map();
for (const album of sourceAlbums) {
  if (!album.cover_path) continue;
  if (!/^\/uploads\/images\/covers\/[a-f0-9-]+\.webp$/.test(album.cover_path)) throw new Error('Unexpected source cover path');
  const path = await canonical(join(sourceRun, album.cover_path));
  const bytes = await readFile(path);
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error('Source cover size is invalid');
  coverData.set(album.album_id, bytes);
}
const inspect = new Database(databasePath, { readonly: true, fileMustExist: true });
const existingUserCount = inspect.prepare('SELECT count(*) n FROM users').get().n;
inspect.close();
if (!process.argv.includes('--apply')) {
  console.log(JSON.stringify({ status: 'plan', databasePath, existingUsers: existingUserCount, sourceTracks: sourceTracks.length,
    sourceAlbums: sourceAlbums.length, sourceCovers: coverData.size, action: 'Use --apply to register a dedicated account through the local UI and add verified metadata. No migrations or existing-user password changes.' }));
  source.close();
  process.exit(0);
}
const privateDirectory = await directory(await directory(repository, '.test-data'), 'local-listener');
const accountPath = join(privateDirectory, 'account.json');
let account;
try { await canonical(accountPath); account = JSON.parse(await readFile(accountPath, 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
const database = new Database(databasePath, { fileMustExist: true });
database.pragma('foreign_keys = ON');
const browser = await chromium.launch();
try {
  const email = account?.email || 'local-listener@lyra.test';
  const existing = database.prepare('SELECT user_id FROM users WHERE email=?').get(email);
  if (existing && (!account || (account.userId && account.userId !== existing.user_id))) throw new Error('This email already exists without matching setup credentials; no account will be reset');
  if (account && !same(account.databasePath, databasePath)) throw new Error('Saved local credentials belong to another database');
  const backupDirectory = await directory(privateDirectory, 'backups');
  const backupPath = join(backupDirectory, `before-setup-${Date.now()}-${randomBytes(4).toString('hex')}.sqlite`);
  await database.backup(backupPath);
  if (!account) {
    account = { email, name: 'Local listener', password: randomBytes(24).toString('base64url'), databasePath, sourceRun,
      createdAt: new Date().toISOString(), status: 'prepared' };
    await save(accountPath, account, true);
  }
  // No trace/video/screenshot is enabled while credential fields are present.
  const page = await browser.newPage({ baseURL });
  if (!existing) {
    const accessCode = process.env.NUXT_SECRET_ACCESS_CODE || env.NUXT_SECRET_ACCESS_CODE || env.SECRET_ACCESS_CODE;
    if (!accessCode) throw new Error('Local registration access code is not configured');
    await page.goto('/register');
    for (const [label, value] of [['Email', account.email], ['Name', account.name], ['Password', account.password], ['Confirm Password', account.password], ['Access Code', accessCode]]) {
      await page.getByLabel(label, { exact: true }).fill(value);
    }
    const registered = page.waitForResponse(response => new URL(response.url()).pathname === '/api/auth/register');
    await page.getByRole('button', { name: 'Register', exact: true }).click();
    if (!(await registered).ok()) throw new Error('Local UI registration failed; inspect the local page without publishing its credential fields');
    await expect(page).toHaveURL(/\/library$/);
  }
  // Always verify the actual saved password through the login UI; never reset it.
  await page.context().clearCookies();
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(account.email);
  await page.getByLabel('Password', { exact: true }).fill(account.password);
  await page.getByRole('button', { name: 'Login', exact: true }).click();
  await expect(page).toHaveURL(/\/library$/);
  const user = database.prepare('SELECT user_id FROM users WHERE email=?').get(account.email);
  if (!user) throw new Error('The local server registered into a different database; refusing to seed');
  account.userId = user.user_id;
  await save(accountPath, account);
  const coverDirectory = await directory(await directory(await directory(repository, 'uploads'), 'images'), 'covers');
  for (const [albumId, bytes] of coverData) {
    const destination = join(coverDirectory, localAlbumId(user.user_id, albumId) + '.webp');
    try { await writeFile(destination, bytes, { flag: 'wx' }); }
    catch (error) {
      if (error.code !== 'EEXIST') throw error;
      await canonical(destination);
      const current = await readFile(destination);
      if (createHash('sha256').update(current).digest('hex') !== createHash('sha256').update(bytes).digest('hex')) throw new Error('An existing cover differs; refusing overwrite');
    }
  }
  const seeded = seedLocalListener(database, source, sourceUser.user_id, user.user_id);
  await page.reload();
  const albums = await page.request.get('/api/albums');
  if (!albums.ok() || (await albums.json()).length !== seeded.albums) throw new Error('Authenticated library does not expose the seeded account albums');
  const status = await page.request.get('/api/intelligence/status');
  if (!status.ok() || (await status.json()).totalTracks !== seeded.tracks) throw new Error('Intelligence owner scope does not match the local library');
  account.status = 'ready'; account.completedAt = new Date().toISOString();
  await save(accountPath, account);
  console.log(JSON.stringify({ status: 'ready', ...seeded, credentialsFile: relative(repository, accountPath).replaceAll('\\', '/'),
    registrationAndLogin: 'actual local UI', backup: relative(repository, backupPath).replaceAll('\\', '/'),
    listeningHistorySeeded: false, lyricsSeeded: false, embeddingsSeeded: false }));
} finally { await browser.close(); source.close(); database.close(); }
