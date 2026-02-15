import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync(join(process.cwd(), 'server', 'tests', 'integration', 'scanner'), { recursive: true });
process.env.NODE_ENV = 'test';

// Minimal Nuxt runtime shim for server utilities imported in node-only tests.
(globalThis as any).useRuntimeConfig = () => ({
  musicbrainzUserAgent: 'lyra-test/1.0',
});
