import genreImageMap from '~/utils/genre-image-map.json'

/**
 * Composable to return genre artwork URLs.
 */
export const useGenreImage = () => {
  const defaultImage: string = (genreImageMap as Record<string, string>).default || '/images/icons/default-album-art.webp'

  const getGenreImageUrl = (genreName: string | undefined | null): string => {
    if (!genreName) {
      return defaultImage
    }
    const key = genreName.normalize('NFKC').trim().toLowerCase().replace(/[-–—_]+/g, ' ').replace(/\s+/g, ' ')
    const map = genreImageMap as Record<string, string>
    if (Object.hasOwn(map, key)) return map[key]
    // Embedded tags sometimes contain multiple explicit genres. Only map known
    // names; incidental substrings must not assign the wrong illustration.
    for (const part of key.split(/[;,/|]/).map((value) => value.trim())) {
      if (Object.hasOwn(map, part)) return map[part]
    }
    return defaultImage
  }

  return { getGenreImageUrl }
}
