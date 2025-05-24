// use-cover-art.ts

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
    const placeholder = '/images/covers/default-album-art.webp'; // Default placeholder image

    if (!artPath) {
      return placeholder;
    }

    let path = artPath.replace(/\\/g, '/'); // Normalize backslashes to forward slashes

    // Remove '/public/' or 'public/' prefix to make it root-relative for web serving
    if (path.startsWith('/public/')) {
      path = path.substring('/public'.length); // e.g., /public/covers/art.jpg -> /covers/art.jpg
    } else if (path.startsWith('public/')) {
      path = path.substring('public'.length); // e.g., public/covers/art.jpg -> covers/art.jpg
    }

    // Ensure the path starts with a leading slash if it's relative and not an absolute URL
    if (!path.startsWith('/') && !path.startsWith('http')) {
      path = '/' + path;
    }

    // A simple check to prevent returning just "/" if original path was e.g. "/public/"
    if (path === '/') {
        return placeholder;
    }

    return path;
  };

  return {
    getCoverArtUrl,
  };
};
