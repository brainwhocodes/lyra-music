import { mkdir, mkdtemp, readFile, writeFile, access, realpath, lstat, rename } from 'node:fs/promises';
import { spawn, execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { resolve, join, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = await realpath(fileURLToPath(new URL('..', import.meta.url)));
const comparable = value => process.platform === 'win32' ? value.toLowerCase() : value;
async function ensureDirectory(parent, name) {
  const candidate = join(parent, name);
  const existing = await lstat(candidate).catch(error => { if (error.code !== 'ENOENT') throw error; });
  if (existing?.isSymbolicLink()) throw new Error('Private directories cannot be links or junctions');
  if (!existing) await mkdir(candidate);
  if (comparable(await realpath(candidate)) !== comparable(candidate)) throw new Error('Private directory was redirected');
  return candidate;
}
const privateRoot = await ensureDirectory(await ensureDirectory(repository, '.test-data'), 'private-albums');
const phase = process.argv[2] || 'all';
if (!['all', 'prepare', 'browser'].includes(phase)) throw new Error('Usage: node scripts/private-albums.mjs [all|prepare|browser]');
function run(command, args, options = {}) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd: repository, stdio: 'inherit', ...options });
    child.on('error', reject);
    child.on('close', code => code === 0 ? accept() : reject(new Error(`Private ${command} phase failed (${code})`)));
  });
}
let descriptor;
if (phase !== 'browser') {
  const manifest = join(privateRoot, 'extracted/manifest.json');
  const exists = await access(manifest).then(() => true, () => false);
  const extraction = await promisify(execFile)(process.env.PYTHON || 'python', [resolve(repository, 'scripts/private-albums-extract.py'), ...(exists ? ['--verify'] : []),
    ...(process.env.LYRA_PRIVATE_MUSIC_DIR ? ['--music-dir', process.env.LYRA_PRIVATE_MUSIC_DIR] : [])], { cwd: repository, encoding: 'utf8' });
  const status = JSON.parse(extraction.stdout.trim());
  console.log(JSON.stringify(status));
  if (status.status === 'skipped') {
    console.log('SKIP: private archives are absent. No private tests ran.');
    process.exit(0);
  }
  const runs = await ensureDirectory(privateRoot, 'runs');
  const directory = await mkdtemp(join(runs, 'run-'));
  const log = await import('node:fs').then(fs => fs.openSync(join(directory, 'import.log'), 'w'));
  try {
    await run(process.execPath, ['node_modules/vitest/vitest.mjs', 'run', '--config', 'vitest.private.config.ts'], {
      env: { ...process.env, LYRA_PRIVATE_RUN: directory }, stdio: ['ignore', log, log],
    });
  } finally { (await import('node:fs')).closeSync(log); }
  descriptor = { run: directory, port: 3200, createdAt: new Date().toISOString() };
  await writeFile(join(privateRoot, 'current-run.json'), JSON.stringify(descriptor, null, 2));
  const report = JSON.parse(await readFile(join(directory, 'import-report.json'), 'utf8'));
  console.log(JSON.stringify({ phase: 'import', status: 'passed', ...report.aggregate }));
} else descriptor = JSON.parse(await readFile(join(privateRoot, 'current-run.json'), 'utf8'));
if (phase !== 'prepare') {
  const runs = await ensureDirectory(privateRoot, 'runs');
  descriptor.run = await realpath(descriptor.run);
  const child = relative(runs, descriptor.run);
  if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Invalid private run descriptor');
  // Every rerun preserves the previous private trace instead of replacing it.
  const previous = join(descriptor.run, 'browser-results');
  if (await access(previous).then(() => true, () => false)) {
    const archive = await mkdtemp(join(descriptor.run, 'browser-attempt-'));
    await rename(previous, join(archive, 'browser-results'));
    for (const file of ['browser-results.json', 'ui-coverage.json', 'aggregate-verification.json', 'build-identity.json']) {
      if (await access(join(descriptor.run, file)).then(() => true, () => false)) await rename(join(descriptor.run, file), join(archive, file));
    }
  }
  const env = { ...process.env, LYRA_PRIVATE_RUN: descriptor.run };
  await run(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '--config', 'playwright.private.config.ts'], { env });
  await run(process.execPath, ['scripts/private-albums-report.mjs'], { env });
}
