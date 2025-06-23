/**
 * Splits a combined artist string into individual artist names.
 * Handles various formats like "Artist A, Artist B", "Artist X feat. Artist Y", etc.
 * @param artistString The combined artist string to split
 * @returns Array of individual artist names
 */
export function splitArtistString(artistString: string): string[] {
  if (!artistString || typeof artistString !== 'string') return [];

  // Trim the input string
  const trimmedArtist = artistString.trim();
  if (!trimmedArtist) return [];

  // Common separators in artist strings
  const separators = [
    ', ', // Standard comma separation (Eminem, Dr. Dre)
    '; ', // Semicolon separation
    ' feat. ', // Featured artist notation
    ' featuring ', // Full featured artist notation
    ' ft. ', // Alternative featured artist notation
    ' with ', // Collaboration notation
    ' & ', // Ampersand separation
    ' and ', // Text 'and' separation
    ' x ', // Modern collaboration notation (Artist x Artist)
  ];

  // First, try splitting with common separators
  for (const separator of separators) {
    if (trimmedArtist.includes(separator)) {
      return trimmedArtist
        .split(separator)
        .map(part => part.trim())
        .filter(part => part.length > 0);
    }
  }

  // If no separator was found, return the original artist name as a single-element array
  return [trimmedArtist];
}
