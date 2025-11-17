// server/api/filesystem/browse.get.ts
import { defineEventHandler, getQuery } from 'h3';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { exec } from 'node:child_process';

interface FilesystemEntry {
  name: string;
  fullPath: string;
  isDirectory: boolean;
}

interface FilesystemBrowseResult {
  currentPath: string;
  parentPath: string | null;
  entries: FilesystemEntry[];
  error?: string;
}

const getWindowsDrives = async (): Promise<string[]> => {
  let potentialDrives: string[] = [];
  try {
    const stdout = await new Promise<string>((resolveExec, rejectExec) => {
      exec('wmic logicaldisk get name', (err, sout, serr) => {
        if (err) {
          console.error('Error fetching Windows drives using wmic:', serr);
          rejectExec(err); // Propagate error to trigger fallback
          return;
        }
        resolveExec(sout);
      });
    });
    const lines = stdout.split(/\r\r?\n|\n/);
    potentialDrives = lines
      .map(line => line.trim())
      .filter(line => /^[A-Z]:$/.test(line));
  } catch (wmicError) {
    console.warn('WMIC command failed, falling back to common drive letters for check.');
    // Fallback to checking common drive letters
    const commonDriveLetters = ['C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];
    potentialDrives = commonDriveLetters.map(letter => `${letter}:`);
  }

  const results = await Promise.all(
    potentialDrives.map(async (driveLetter) => {
      const drivePath = driveLetter + '\\'; // e.g., C:\\
      try {
        await fs.readdir(drivePath); // Attempt to read the root of the drive
        return driveLetter;
      } catch {
        return null;
      }
    })
  );

  return results.filter((d): d is string => Boolean(d));
};


export default defineEventHandler(async (event): Promise<FilesystemBrowseResult> => {
  const query = getQuery(event);
  let rawPath: string = typeof query.path === 'string' ? query.path : '';
  
  const requestedPath = path.normalize(rawPath);
  let targetPath: string = requestedPath;

  try {
    let entries: FilesystemEntry[] = [];
    let currentPathDisplay: string = '';
    let parentPathDisplay: string | null = null;

    // If rawPath is empty (initial load) or targetPath is '.' (normalized empty path) or 'Computer', treat as root request.
    if (!rawPath || targetPath === '.' || targetPath === 'Computer') {
      currentPathDisplay = os.platform() === 'win32' ? 'Computer' : '/';
      parentPathDisplay = null;

      if (os.platform() === 'win32') {
        const drives = await getWindowsDrives();
        if (drives.length === 0) {
            const homeDir = os.homedir();
            entries.push({ name: path.basename(homeDir), fullPath: homeDir, isDirectory: true});
            currentPathDisplay = homeDir;
        } else {
            drives.forEach(driveLetter => {
              entries.push({ name: driveLetter, fullPath: driveLetter + '\\', isDirectory: true });
            });
        }
      } else {
        targetPath = os.homedir();
        currentPathDisplay = targetPath;
        parentPathDisplay = path.dirname(targetPath);
        if (parentPathDisplay === currentPathDisplay) parentPathDisplay = null;

        const items = await fs.readdir(targetPath, { withFileTypes: true });
        for (const item of items) {
          if (!item.name.startsWith('.')) {
            entries.push({ name: item.name, fullPath: path.join(targetPath, item.name), isDirectory: item.isDirectory() });
          }
        }
      }
    } else {
      if (os.platform() === 'win32' && /^[A-Z]:$/.test(targetPath) && targetPath.length === 2) {
        targetPath += '\\'; // Ensure 'C:' becomes 'C:\\'
      }
      if (!path.isAbsolute(targetPath)) {
         return { currentPath: targetPath, parentPath: null, entries: [], error: 'Path must be absolute.' };
      }

      const stats = await fs.stat(targetPath);
      if (!stats.isDirectory()) {
        return { currentPath: targetPath, parentPath: path.dirname(targetPath), entries: [], error: 'Path is not a directory.' };
      }

      currentPathDisplay = targetPath;
      const parentDir = path.dirname(targetPath);
      
      if (parentDir !== targetPath) {
         parentPathDisplay = parentDir;
      } else if (os.platform() === 'win32' && /^[A-Z]:\\$/.test(targetPath)) {
         parentPathDisplay = 'Computer';
      } else {
         parentPathDisplay = null;
      }

      const items = await fs.readdir(targetPath, { withFileTypes: true });
      for (const item of items) {
        if (item.name.startsWith('.') || (os.platform() === 'win32' && (item.name.toLowerCase() === 'system volume information' || item.name.toLowerCase() === '$recycle.bin'))) {
          continue;
        }
        entries.push({ name: item.name, fullPath: path.join(targetPath, item.name), isDirectory: item.isDirectory() });
      }
    }

    entries.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return { currentPath: currentPathDisplay, parentPath: parentPathDisplay, entries };

  } catch (error: any) {
    console.error(`Error browsing filesystem for path '${rawPath}':`, error);
    const errorPath = targetPath || rawPath || 'the requested location';
    let parentForError = null;
    try {
        if (targetPath && path.dirname(targetPath) !== targetPath) parentForError = path.dirname(targetPath);
        else if (rawPath && path.dirname(rawPath) !== rawPath) parentForError = path.dirname(rawPath);
    } catch {}


    if (error.code === 'ENOENT') {
      return { currentPath: errorPath, parentPath: parentForError, entries: [], error: 'Path not found.' };
    }
    if (error.code === 'EPERM' || error.code === 'EACCES') {
      return { currentPath: errorPath, parentPath: parentForError, entries: [], error: 'Permission denied.' };
    }
    return { currentPath: errorPath, parentPath: parentForError, entries: [], error: `An error occurred: ${error.message}` };
  }
});
