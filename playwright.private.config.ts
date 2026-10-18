import { defineConfig, devices } from '@playwright/test';
import { resolve, relative, isAbsolute } from 'node:path';
import { realpathSync } from 'node:fs';

const run = process.env.LYRA_PRIVATE_RUN;
if (!run) throw new Error('Use node scripts/private-albums.mjs; private artifacts require an isolated run');
const root = realpathSync(resolve('.test-data/private-albums/runs'));
if (relative(realpathSync('.'), root).replaceAll('\\', '/') !== '.test-data/private-albums/runs') throw new Error('Private root was redirected');
const child = relative(root, realpathSync(run));
if (!child || child.startsWith('..') || isAbsolute(child)) throw new Error('Browser output must remain inside the private workspace');
export default defineConfig({
  testDir: './tests/private', testMatch: 'library.spec.ts',
  outputDir: resolve(run, 'browser-results'),
  fullyParallel: false, workers: 1, retries: 0,
  timeout: 180_000, expect: { timeout: 15_000 },
  reporter: process.argv.includes('--list') ? [['list']] : [['list'], ['json', { outputFile: resolve(run, 'browser-results.json') }]],
  use: { baseURL: 'http://127.0.0.1:3200', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'private-desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } },
    { name: 'private-mobile', use: { ...devices['iPhone 13'], defaultBrowserType: 'chromium' } },
    { name: 'private-codecs', testMatch: 'fallback.spec.ts', use: { ...devices['Desktop Chrome'] } },
    ...(process.env.LYRA_PRIVATE_MODELS === '1' ? [{ name: 'private-models', testMatch: 'models.spec.ts', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } } }] : []),
  ],
  webServer: { command: 'node scripts/private-albums-server.mjs', url: 'http://127.0.0.1:3200/login', reuseExistingServer: false, timeout: 60_000 },
});
