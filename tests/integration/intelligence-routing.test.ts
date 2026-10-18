import { describe, expect, it } from 'vitest';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Use the same installed Nitro that Nuxt builds with. A hand-mounted H3 router
// cannot catch filename conventions that change a production endpoint's URL.
const require = createRequire(import.meta.url);
const nuxtRequire = createRequire(require.resolve('nuxt/package.json'));

describe('intelligence production route discovery', () => {
  it('registers every documented endpoint at the URL used by Explore', async () => {
    const packageUrl = pathToFileURL(nuxtRequire.resolve('nitropack/package.json'));
    const manifest = JSON.parse(await readFile(packageUrl, 'utf8'));
    // Nitro's public core export is import-only, so require.resolve cannot use it.
    const { scanServerRoutes } = await import(new URL(manifest.exports['./core'].import, packageUrl).href);
    const handlers = await scanServerRoutes({ options: {
      scanDirs: [fileURLToPath(new URL('../../server/', import.meta.url))], ignore: [],
    } }, 'api', '/api');
    const intelligence = handlers.filter((handler: { route: string }) => handler.route.startsWith('/api/intelligence'));
    expect(intelligence.map((handler: { method: string; route: string }) => `${handler.method.toUpperCase()} ${handler.route}`).sort()).toEqual([
      'GET /api/intelligence/recommendations',
      'GET /api/intelligence/search',
      'GET /api/intelligence/status',
      'GET /api/intelligence/tags',
      'POST /api/intelligence/index',
    ]);
  });
});
