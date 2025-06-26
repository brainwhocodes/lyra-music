import { mkdir, access, readFile, writeFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { SUPPORTED_EXTENSIONS } from './types';

/**
 * Checks if a file extension is supported for metadata scanning.
 */
export function isSupportedAudioFile(filePath: string): boolean {
  const ext = path.extname(filePath).toLowerCase();
  return (SUPPORTED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Recursively scans a directory for supported audio files.
 */
export async function findAudioFiles(dirPath: string): Promise<string[]> {
  try {
    const entries = await readdir(dirPath, { withFileTypes: true });

    const results = await Promise.all(
      entries.map(async (entry) => {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          return findAudioFiles(fullPath);
        }
        if (entry.isFile() && isSupportedAudioFile(fullPath)) {
          return [fullPath];
        }
        return [] as string[];
      })
    );

    return results.flat();
  } catch (error: any) {
    console.error(`Error reading directory ${dirPath}: ${error.message}`);
    return [];
  }
}

export const fileUtils = {
  isSupportedAudioFile,
  findAudioFiles,
  ensureDir,
  pathExists,
  readFile,
  writeFile,
  readdir,
} as const;

async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true });
  return;
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
} 
