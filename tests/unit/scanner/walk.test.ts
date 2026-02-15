import { describe, expect, it, vi } from 'vitest';
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

  it('continues when stat fails for a file', async () => {
    vi.resetModules();
    vi.doMock('node:fs/promises', () => ({
      opendir: vi.fn(async () => ({
        async *[Symbol.asyncIterator]() {
          yield {
            name: 'a.mp3',
            isDirectory: () => false,
            isFile: () => true,
          };
          yield {
            name: 'b.mp3',
            isDirectory: () => false,
            isFile: () => true,
          };
        },
      })),
      stat: vi.fn(async (target: string) => {
        if (target.endsWith('/b.mp3')) {
          const error = new Error('missing');
          (error as Error & { code?: string }).code = 'ENOENT';
          throw error;
        }
        return { size: 1, mtimeMs: 1000 };
      }),
    }));

    const { walkDirectory: mockedWalkDirectory } = await import('~/server/services/scanner/walk');
    const errors: Array<{ code: string; path: string }> = [];
    const found: string[] = [];

    for await (const entry of mockedWalkDirectory('/root', {
      onError: (error) => errors.push(error),
    })) {
      found.push(entry.path);
    }

    expect(found).toEqual(['/root/a.mp3']);
    expect(errors).toEqual([{ code: 'ENOENT', path: '/root/b.mp3' }]);

    vi.doUnmock('node:fs/promises');
  });
});
