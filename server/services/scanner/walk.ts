import { opendir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { limits } from '~/server/jobs/limits';
import type { WalkOptions } from './schemas';

export interface WalkEntry {
  path: string;
  sizeBytes: number | null;
  mtimeMs: number | null;
  extension: string | null;
}

export interface WalkError {
  code: string;
  path: string;
}

export type WalkRuntimeOptions = WalkOptions & {
  onError?: (error: WalkError) => void | Promise<void>;
};

const AUDIO_EXTENSIONS = new Set(['.mp3', '.flac', '.m4a', '.wav', '.ogg', '.opus', '.aac', '.alac']);

function toWalkError(path: string, error: unknown): WalkError {
  const code = typeof error === 'object' && error && 'code' in error && typeof (error as any).code === 'string'
    ? (error as any).code
    : 'UNKNOWN';

  return { code, path };
}

async function reportError(path: string, error: unknown, onError?: WalkRuntimeOptions['onError']) {
  if (!onError) {
    return;
  }

  await onError(toWalkError(path, error));
}

export async function* walkDirectory(rootPath: string, options: WalkRuntimeOptions = {}): AsyncGenerator<WalkEntry> {
  const ignoreDirectories = new Set(options.ignoreDirectories ?? []);
  const ignoreExtensions = new Set((options.ignoreExtensions ?? []).map((e) => e.toLowerCase()));
  const maxDepth = Math.min(options.maxDepth ?? limits.maxScanDepth, limits.maxScanDepth);
  const maxFiles = Math.min(options.maxFiles ?? limits.maxFilesPerScan, limits.maxFilesPerScan);

  const stack: Array<{ dir: string; depth: number }> = [{ dir: rootPath, depth: 0 }];
  let emitted = 0;

  while (stack.length > 0) {
    const current = stack.pop()!;
    let dir;

    try {
      dir = await opendir(current.dir);
    } catch (error) {
      if (current.depth === 0) {
        throw error;
      }

      await reportError(current.dir, error, options.onError);
      continue;
    }

    for await (const entry of dir) {
      if (ignoreDirectories.has(entry.name)) {
        continue;
      }

      const entryPath = join(current.dir, entry.name);

      if (entry.isDirectory()) {
        if (current.depth < maxDepth) {
          stack.push({ dir: entryPath, depth: current.depth + 1 });
        }
        continue;
      }

      if (!entry.isFile()) {
        continue;
      }

      const extension = extname(entry.name).toLowerCase();
      if (!AUDIO_EXTENSIONS.has(extension) || ignoreExtensions.has(extension)) {
        continue;
      }

      let info;
      try {
        info = await stat(entryPath);
      } catch (error) {
        await reportError(entryPath, error, options.onError);
        continue;
      }

      emitted += 1;
      yield {
        path: entryPath,
        sizeBytes: Number.isFinite(info.size) ? info.size : null,
        mtimeMs: Number.isFinite(info.mtimeMs) ? Math.trunc(info.mtimeMs) : null,
        extension,
      };

      if (emitted >= maxFiles) {
        return;
      }
    }
  }
}
