import type { TrackArtistDetail, FormattedArtist, Track } from '~/types/track';

/**
 * Composable that provides utilities for formatting track artists consistently across the application
 * 
 * @returns Object containing track artist formatting functions
 */
export const useTrackArtists = () => {
  /**
   * Formats an array of track artist details into an array of formatted artists.
   *
   * @param artists - Array of track artist details to format.
   * @returns Array of formatted artists with URLs and display properties.
   */
  const getFormattedTrackArtists = (artists: TrackArtistDetail[]): FormattedArtist[] => {
    if (!artists || artists.length === 0) {
      return [];
    }
    return artists.map(artist => ({
      ...artist,
      url: `/artists/${artist.artistId}`,
      displayRole: '', // No roles displayed, just use commas
      isPrimary: !!artist.isPrimaryArtist, // Ensure boolean
      // Ensure all properties from FormattedArtist are present if not in TrackArtistDetail
      name: artist.name, 
      artistId: artist.artistId,
    }));
  };

  /**
   * Formats track artists with URLs and display properties
   * 
   * @param track - The track containing artists to format
   * @returns The same track with formatted artists added
   */
  const formatTrackWithArtists = (track: Track): Track => {
    return {
      ...track,
      formattedArtists: getFormattedTrackArtists(track.artists || []),
    };
  };

  /**
   * Formats a collection of tracks to add formatted artists
   * 
   * @param tracks - Array of tracks to process
   * @returns Array of tracks with formatted artists
   */
  const formatTracksWithArtists = (tracks: Track[]): Track[] => {
    return tracks.map(track => formatTrackWithArtists(track));
  };

  /**
   * Creates a formatted string of artist names for a track
   * 
   * @param track - The track to format artist names for
   * @param maxArtists - Maximum number of artists to display before truncating
   * @returns Formatted artist name string
   */
  const getTrackArtistNameString = (track: Track, maxArtists: number = 3): string => {
    if (!track.artists || track.artists.length === 0) {
      return track.artistName || 'Unknown Artist';
    }
    
    // If there are too many artists, show "Various Artists"
    if (track.artists.length > maxArtists) {
      return 'Various Artists';
    }

    // Get primary artists first, fall back to all artists
    const primaryArtists = track.artists.filter(a => a.isPrimaryArtist);
    const artistsToShow = primaryArtists.length > 0 ? primaryArtists : track.artists;

    return artistsToShow
      .map(artist => artist.name)
      .reduce((result, name, index, array) => {
        if (index === 0) return name;
        if (index === array.length - 1) return `${result} & ${name}`; // Use ampersand for the last join
        return `${result} & ${name}`; // Use comma for other joins
      }, '');
  };

  return {
    getFormattedTrackArtists, // Export the new function
    formatTrackWithArtists,
    formatTracksWithArtists,
    getTrackArtistNameString
  };
};
