import { describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { walkDirectory } from '~/server/services/scanner/walk';

describe('walkDirectory', () => {
  it('respects ignore rules and maxFiles', async () => {
    const root = await mkdtemp(join(tmpdir(), 'scan-walk-'));
    try {
      await writeFile(join(root, 'a.mp3'), 'a');
      await writeFile(join(root, 'skip.txt'), 'x');
      const ignored = join(root, 'ignored');
      await mkdir(ignored);
      await writeFile(join(ignored, 'b.flac'), 'b');

      const found: string[] = [];
      for await (const entry of walkDirectory(root, { ignoreDirectories: ['ignored'], maxFiles: 1 })) {
        found.push(entry.path.replace(`${root}/`, ''));
      }

      expect(found).toEqual(['a.mp3']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
