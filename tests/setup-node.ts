import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

mkdirSync(join(process.cwd(), 'server', 'tests', 'integration', 'scanner'), { recursive: true });
process.env.NODE_ENV = 'test';
