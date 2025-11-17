import { stat } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { db } from '~/server/db';
import { tracks } from '~/server/db/schema';
import { eq } from 'drizzle-orm';
import type { FileMetadata } from './scan-types';

const SUPPORTED_AUDIO_EXTENSIONS = new Set([
  '.mp3', '.flac', '.m4a', '.aac', '.ogg', '.wav', '.wma', '.mp4'
]);

/**
 * Checks if a file is a supported audio format
 */
export function isSupportedAudioFile(filePath: string): boolean {
  const extension = extname(filePath).toLowerCase();
  return SUPPORTED_AUDIO_EXTENSIONS.has(extension);
}

/**
 * Gets file metadata including modification time and size
 */
export async function getFileMetadata(filePath: string): Promise<FileMetadata | null> {
  try {
    const stats = await stat(filePath);
    return {
      filePath,
      lastModified: stats.mtime,
      size: stats.size,
      isChanged: false // Will be determined by comparing with database
    };
  } catch (error) {
    console.error(`Error getting file metadata for ${filePath}:`, error);
    return null;
  }
}

/**
 * Determines which files have changed since last scan by comparing modification times
 */
export async function getChangedFiles(
  fileMetadataList: FileMetadata[],
  userId: string
): Promise<FileMetadata[]> {
  if (fileMetadataList.length === 0) return [];

  try {
    // Get all existing tracks with their file paths and last scan times
    const existingTracks = await db
      .select({
        filePath: tracks.filePath,
        modifiedTime: tracks.updatedAt
      })
      .from(tracks);

    // Create a map for quick lookup
    const existingTrackMap = new Map<string, Date>();
    for (const track of existingTracks) {
      if (track.filePath && track.modifiedTime) {
        existingTrackMap.set(track.filePath, new Date(track.modifiedTime));
      }
    }

    // Determine which files have changed
    const changedFiles: FileMetadata[] = [];
    for (const fileMetadata of fileMetadataList) {
      const lastScanTime = existingTrackMap.get(fileMetadata.filePath);
      
      // File is changed if:
      // 1. It doesn't exist in database (new file)
      // 2. File modification time is newer than last scan time
      const isChanged = !lastScanTime || fileMetadata.lastModified > lastScanTime;
      
      changedFiles.push({
        ...fileMetadata,
        isChanged
      });
    }

    return changedFiles;
  } catch (error) {
    console.error('Error determining changed files:', error);
    // If we can't determine changes, assume all files are changed (safe fallback)
    return fileMetadataList.map(fm => ({ ...fm, isChanged: true }));
  }
}

/**
 * Filters files to only include changed files (for incremental scanning)
 */
export function filterChangedFiles(fileMetadataList: FileMetadata[]): FileMetadata[] {
  return fileMetadataList.filter(fm => fm.isChanged);
}

/**
 * Splits an array into chunks of specified size
 */
export function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize));
  }
  return chunks;
}

/**
 * Calculates estimated time remaining based on processing rate
 */
export function calculateEstimatedTimeRemaining(
  totalFiles: number,
  processedFiles: number,
  startTime: Date
): number | null {
  if (processedFiles === 0) return null;
  
  const elapsedMs = Date.now() - startTime.getTime();
  const filesPerMs = processedFiles / elapsedMs;
  const remainingFiles = totalFiles - processedFiles;
  
  return Math.round(remainingFiles / filesPerMs);
}

/**
 * Validates that a directory path exists and is accessible
 */
export async function validateDirectoryPath(directoryPath: string): Promise<boolean> {
  try {
    const stats = await stat(directoryPath);
    return stats.isDirectory();
  } catch (error) {
    return false;
  }
}

/**
 * Creates a safe batch size based on system resources
 */
export function calculateOptimalBatchSize(totalFiles: number, maxWorkers: number = 4): number {
  // Base batch size on total files and available workers
  const baseBatchSize = Math.max(10, Math.min(100, Math.ceil(totalFiles / (maxWorkers * 4))));
  
  // Adjust based on memory considerations (smaller batches for very large libraries)
  if (totalFiles > 10000) {
    return Math.min(baseBatchSize, 50);
  } else if (totalFiles > 1000) {
    return Math.min(baseBatchSize, 75);
  }
  
  return baseBatchSize;
}
