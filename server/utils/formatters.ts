import path from 'path';

export const formatDuration = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.floor(seconds % 60);
  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

export function truncateString(str: string, maxLength: number): string {
  if (str.length > maxLength) {
    return str.substring(0, maxLength) + '...';
  }
  return str;
}

/**
 * Determines the MIME type based on file extension
 * @param filePath - Path or filename to check
 * @returns The corresponding MIME type or 'application/octet-stream' if unknown
 */
export function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case '.mp3': return 'audio/mpeg';
    case '.flac': return 'audio/flac';
    case '.ogg':
    case '.oga':
    case '.opus': return 'audio/ogg';
    case '.m4a': return 'audio/mp4'; // Often used for AAC
    case '.aac': return 'audio/aac';
    case '.wav': return 'audio/wav';
    case '.jpg':
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    default: return 'application/octet-stream';
  }
}

// Re-export from path to avoid multiple imports in other files
export { join as joinPath, extname, basename, dirname } from 'path';
