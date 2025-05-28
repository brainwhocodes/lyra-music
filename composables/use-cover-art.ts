// composables/use-cover-art.ts

/**
 * Composable for generating cover art URLs.
 */
export const useCoverArt = () => {
  /**
   * Generates a web-friendly URL for cover art from a given path string.
   * Handles path normalization and provides a default placeholder.
   *
   * @param artPath - The path to the cover art file. Can be null or undefined.
   * @returns A string representing the URL for the cover art, or a placeholder if artPath is invalid.
   */
  const getCoverArtUrl = (artPath: string | null | undefined): string => {
    const placeholder = '/images/icons/default-album-art.webp'; // Default placeholder image

    if (!artPath) {
      console.warn('[useCoverArt] artPath is null or undefined, returning placeholder.');
      return placeholder;
    }

    let path = artPath.replace(/\\/g, '/'); // Normalize backslashes to forward slashes

    // Check for common absolute file path patterns (Windows and POSIX-like)
    // This is a basic check and might need refinement for edge cases.
    const isLikelyAbsolutePath = /^([a-zA-Z]:\/|\/|[a-zA-Z]:\/\/|\\\\)/.test(artPath) || path.startsWith('/'); // artPath is original, path is normalized
    const isHttpUrl = path.startsWith('http://') || path.startsWith('https://');

    // If it looks like an absolute file path and not an HTTP URL, it's likely not web-servable directly.
    // Server should ideally store web-relative paths or handle serving these via an API endpoint.
    if (isLikelyAbsolutePath && !isHttpUrl && !path.startsWith('/public/') && !path.startsWith('public/')) {
      // Only treat it as an error if it doesn't look like it's ALREADY a root-relative path intended for public serving
      if (!(path.startsWith('/') && !path.startsWith('//') && !path.includes(':'))) { // Heuristic: if it starts with / but not // and no :, it might be a valid root relative web path
         console.warn(`[useCoverArt] artPath "${artPath}" appears to be an absolute file path not in /public. Returning placeholder. Consider adjusting scanner to store web-relative paths.`);
         return placeholder;
      }
    }

    // Remove '/public/' or 'public/' prefix to make it root-relative for web serving
    if (path.startsWith('/public/')) {
      path = path.substring('/public'.length); // e.g., /public/covers/art.jpg -> /covers/art.jpg
    } else if (path.startsWith('public/')) {
      path = path.substring('public'.length); // e.g., public/covers/art.jpg -> covers/art.jpg
      if (!path.startsWith('/')) {
        path = '/' + path; // Ensure it's root relative after stripping 'public/'
      }
    }

    // Ensure the path starts with a leading slash if it's relative and not an absolute URL
    if (!path.startsWith('/') && !isHttpUrl) {
      path = '/' + path;
    }

    // A simple check to prevent returning just "/" if original path was e.g. "/public/"
    if (path === '/') {
        console.warn('[useCoverArt] artPath resulted in just "/", returning placeholder.');
        return placeholder;
    }

    // console.log(`[useCoverArt] Original: "${artPath}", Processed: "${path}"`); // Optional: for debugging all paths
    return path;
  };

  return {
    getCoverArtUrl,
  };
};
