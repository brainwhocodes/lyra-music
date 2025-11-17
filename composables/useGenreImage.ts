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
    const key = genreName.toLowerCase()
    const map = genreImageMap as Record<string, string>
    return map[key] || defaultImage
  }

  return { getGenreImageUrl }
}
