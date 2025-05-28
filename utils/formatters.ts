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

export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || seconds < 0) {
    return '0:00';
  }
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatTrackDuration = (duration: number | undefined | null): string => {
  if (duration === undefined || duration === null) {
    return '--:--';
  }
  const totalSeconds = Math.floor(duration);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

// Add other formatting utilities as needed

/**
 * Resolves the URL for cover art.
 * @param coverPath - The path to the cover art, may include /public or use backslashes.
 * @returns A web-accessible URL for the cover art or a default image path.
 */
export function resolveCoverArtUrl(coverPath?: string | null): string {
  const defaultCover = '/images/icons/default-album-art.webp'; // Ensure this exists in public/images/covers

  if (!coverPath) {
    return defaultCover;
  }

  let path = coverPath.replace(/\\/g, '/'); // Normalize backslashes to forward slashes

  // Remove leading '/public/' if present, as Nuxt serves public assets from the root
  if (path.startsWith('/public/')) {
    path = path.substring('/public'.length);
  }
  
  // Ensure it starts with a slash if it's not an absolute URL already
  if (!path.startsWith('/') && !path.startsWith('http')) {
    path = `/${path}`;
  }

  return path;
}
