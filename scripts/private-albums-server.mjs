import { readFile, realpath, open, writeFile, mkdir } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { join, resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const repository = fileURLToPath(new URL('..', import.meta.url));
const root = await realpath(resolve(repository, '.test-data/private-albums/runs'));
if (relative(await realpath(repository), root).replaceAll('\\', '/') !== '.test-data/private-albums/runs') throw new Error('Private runtime root was redirected');
const run = await realpath(process.env.LYRA_PRIVATE_RUN || '');
const difference = relative(root, run);
if (!difference || difference.startsWith('..') || isAbsolute(difference)) throw new Error('Private runtime must be a previously allocated child of the private runs directory');
const report = JSON.parse(await readFile(join(run, 'import-report.json'), 'utf8'));
if (resolve(report.databasePath) !== resolve(run, 'library.sqlite')) throw new Error('Private database path mismatch');
// FFmpeg/Python intermediates must stay in this ignored private run as well.
const temporary = join(run, 'temporary');
await mkdir(temporary).catch(error => { if (error.code !== 'EEXIST') throw error; });
if (await realpath(temporary) !== temporary) throw new Error('Private temporary directory was redirected');
await writeFile(join(run, 'build-identity.json'), JSON.stringify({ startedAt: new Date().toISOString(),
  nitro: JSON.parse(await readFile(resolve(repository, '.output/nitro.json'), 'utf8')),
  serverEntrySha256: createHash('sha256').update(await readFile(resolve(repository, '.output/server/index.mjs'))).digest('hex'),
}, null, 2));
const output = await open(join(run, 'server.log'), 'a');
const child = spawn(process.execPath, [resolve(repository, '.output/server/index.mjs')], {
  cwd: run,
  stdio: ['ignore', output.fd, output.fd],
  env: {
    ...process.env, NODE_ENV: 'production', DATABASE_URL: report.databasePath,
    TEMP: temporary, TMP: temporary, TMPDIR: temporary,
    HOST: '127.0.0.1', PORT: '3200', NUXT_JWT_SECRET: randomBytes(48).toString('base64url'),
    NUXT_SECRET_ACCESS_CODE: 'private-local-access',
    NUXT_SCANNER_DISABLE_GENIUS: 'true', SCANNER_DISABLE_GENIUS: 'true',
    GEMINI_API_KEY: '', NUXT_GEMINI_API_KEY: '', RESEND_API_KEY: '',
    GENIUS_API_CLIENT_ID: '', GENIUS_API_CLIENT_SECRET: '',
    NUXT_GENIUS_API_CLIENT_ID: '', NUXT_GENIUS_API_CLIENT_SECRET: '',
  },
});
console.log('Private corpus runtime listening only on 127.0.0.1:3200');
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => child.kill(signal));
child.on('error', async error => { console.error(error); await output.close(); process.exitCode = 1; });
child.on('close', async code => { await output.close(); process.exitCode = code ?? 0; });
