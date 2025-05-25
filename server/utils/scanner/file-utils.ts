import fs from 'fs-extra';
import path from 'path';
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
  let audioFiles: string[] = [];
  
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        // Recursively scan subdirectories
        audioFiles = [...audioFiles, ...(await findAudioFiles(fullPath))];
      } else if (entry.isFile() && isSupportedAudioFile(fullPath)) {
        audioFiles.push(fullPath);
      }
    }
  } catch (error: any) {
    console.error(`Error reading directory ${dirPath}: ${error.message}`);
  }
  
  return audioFiles;
}

export const fileUtils = {
  isSupportedAudioFile,
  findAudioFiles,
  ensureDir: fs.ensureDir,
  pathExists: fs.pathExists,
  readFile: fs.readFile,
  writeFile: fs.writeFile,
  readdir: fs.readdir,
} as const;
