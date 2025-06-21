import * as mm from 'music-metadata';
import { basename, dirname, extname, join } from 'path';
import { db } from '~/server/db';
import { Album, albums, tracks, artistUsers } from '~/server/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import type { AlbumArtistInfo, TrackArtistInfo } from './db-operations';
import { fileUtils } from '~/server/utils/scanner/file-utils';
import { albumArtUtils } from '~/server/utils/scanner/album-art-utils';
import * as dbOperations from '~/server/utils/scanner/db-operations';
import type { TrackFileMetadata } from '~/server/utils/scanner/db-operations';
import { TrackMetadata } from '~/server/utils/scanner/types';
import { getReleaseInfoWithTags, searchReleaseByTitleAndArtist, getReleaseTracklist } from '~/server/utils/musicbrainz';
import { AlbumProcessStatus } from '~/types/enums/album-process-status';

/**
 * Splits a combined artist string into individual artist names.
 * Handles various formats like "Artist A, Artist B", "Artist X feat. Artist Y", etc.
 * @param artistString The combined artist string to split
 * @returns Array of individual artist names
 */
function splitArtistString(artistString: string): string[] {
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
      return trimmedArtist.split(separator)
        .map(part => part.trim())
        .filter(part => part.length > 0);
    }
  }
  
  // If no separator was found, return the original artist name as a single-element array
  return [trimmedArtist];
}

interface ScanLibraryParams {
  libraryId: string;
  libraryPath: string;
  userId: string;
  processOnlyUnprocessed?: boolean;
}

/**
 * Extracts metadata from an audio file.
 */
async function extractMetadata(filePath: string): Promise<{
  metadata: TrackMetadata;
  albumArtPath: string | null;
}> {
  try {
    const metadata = await mm.parseFile(filePath, { duration: true, skipCovers: false });
    const albumDir = dirname(filePath);
    
    // Process external album art first (folder.jpg, etc.)
    let albumArtPath = await albumArtUtils.processExternalAlbumArt(albumDir);
    
    // If no external art, try embedded art
    if (!albumArtPath && metadata.common.picture?.length) {
      albumArtPath = await albumArtUtils.processEmbeddedAlbumArt(metadata.common.picture);
    }

    return { metadata, albumArtPath };
  } catch (error: any) {
    console.error(`Error extracting metadata from ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Processes a single audio file, extracting metadata and updating the database.
 */
async function processAudioFile(
  filePath: string,
  { libraryId, userId, isVariousArtistsCompilation = false }: { 
    libraryId: string; 
    userId: string; 
    isVariousArtistsCompilation?: boolean;
  }
): Promise<{ albumId: string; title: string; primaryArtistName: string; needsCover: boolean } | null> {
  // console.log(`Processing: ${filePath}`);
  let skipMusicBrainzDetailsFetch = false;

  try {
    const { metadata, albumArtPath } = await extractMetadata(filePath);
    const folderPath = dirname(filePath);
    const common = metadata.common || {};

    const trackTitle = common.title?.trim();
    const rawTrackArtistName = common.artist?.trim();
    const trackAlbumTitle = common.album?.trim();
    const trackYear = common.year;
    const trackExplicit = (metadata.common as any).parentaladvisory === true; // Determine explicit flag

    let musicbrainzReleaseIdFromMeta: string | undefined;
    const rawMbReleaseId = (common as any).musicbrainz_releaseid;
    if (Array.isArray(rawMbReleaseId) && rawMbReleaseId.length > 0) {
      musicbrainzReleaseIdFromMeta = String(rawMbReleaseId[0]);
    } else if (typeof rawMbReleaseId === 'string') {
      musicbrainzReleaseIdFromMeta = rawMbReleaseId;
    }

    if (!trackTitle) {
      // console.warn(`  Track title not found for ${filePath}. Skipping.`);
      return null;
    }

    // --- Initial Artist ID Gathering ---
    const allArtistNames = new Set<string>();
    const primaryAlbumArtistNames = new Set<string>();
    const primaryTrackArtistNames = new Set<string>();
    
    // Process track artist
    if (rawTrackArtistName) {
      const splitTrackArtists = splitArtistString(rawTrackArtistName);
      splitTrackArtists.forEach(artist => {
        allArtistNames.add(artist);
        primaryTrackArtistNames.add(artist);
      });
    }
    
    // Process album artist
    const albumArtistNameFromMeta = (common as any).albumartist?.trim();
    if (albumArtistNameFromMeta) {
      const splitAlbumArtists = splitArtistString(albumArtistNameFromMeta);
      splitAlbumArtists.forEach(artist => {
        allArtistNames.add(artist);
        primaryAlbumArtistNames.add(artist);
      });
    }
    
    // Process additional artists array if present
    ((common as any).artists || []).forEach((artist: string) => {
      if (artist) {
        splitArtistString(artist.trim()).forEach(splitArtist => {
          allArtistNames.add(splitArtist);
        });
      }
    });
    
    // Process featured artists if present
    ((common as any).featuredartists || []).forEach((artist: string) => {
      if (artist) {
        splitArtistString(artist.trim()).forEach(splitArtist => {
          allArtistNames.add(splitArtist);
          // Not adding to primary artists since these are featured
        });
      }
    });

    if (allArtistNames.size === 0) {
      allArtistNames.add('Unknown Artist');
      primaryTrackArtistNames.add('Unknown Artist');
      primaryAlbumArtistNames.add('Unknown Artist');
    }
    
    // Determine effective primary artist name based on priority:
    // 1. Primary track artist (from track.artist)
    // 2. Primary album artist (from common.albumartist)
    // 3. First artist in the set of all artists
    // 4. Fallback to 'Unknown Artist' if all else fails
    // Cast to string to handle potential undefined values from .values().next().value
    const effectivePrimaryArtistName: string = 
      (primaryTrackArtistNames.size > 0 ? primaryTrackArtistNames.values().next().value : 
      primaryAlbumArtistNames.size > 0 ? primaryAlbumArtistNames.values().next().value : 
      allArtistNames.size > 0 ? allArtistNames.values().next().value : 
      'Unknown Artist') || 'Unknown Artist'; 

    const artistRecordsMinimal: import('~/server/db/schema').Artist[] = [];
    
    // For primary artists, use findOrCreateArtist to fetch images
    const primaryArtistNames = new Set<string>([...primaryAlbumArtistNames, ...primaryTrackArtistNames]);
    
    for (const name of allArtistNames) {
      let artistRec;
      
      // Use findOrCreateArtist for primary artists to fetch images
      if (primaryArtistNames.has(name)) {
        artistRec = await dbOperations.findOrCreateArtist({
          artistName: name,
          userId: userId,
          skipRemoteImageFetch: false // Explicitly set to fetch images
        });
      } else {
        // Use minimal version for non-primary artists
        artistRec = await dbOperations.getOrCreateArtistMinimal({ artistName: name });
      }
      
      if (artistRec) artistRecordsMinimal.push(artistRec);
    }

    if (artistRecordsMinimal.length === 0) {
      // console.warn(`  No artist records could be processed for ${filePath}. Skipping album/track linking.`);
      return null; // Or handle track creation without album/artist if desired
    }
    
    // Flag to track if we're dealing with existing records (optimization for rescans)
    let allEntitiesExist = false;

    // Prepare AlbumArtistInfo for findOrCreateAlbum
    const albumArtistsInfo: AlbumArtistInfo[] = artistRecordsMinimal.map(artistRec => ({
      artistId: artistRec.artistId,
      isPrimary: primaryAlbumArtistNames.has(artistRec.name) || 
                (primaryTrackArtistNames.has(artistRec.name) && primaryAlbumArtistNames.size === 0) || 
                (artistRecordsMinimal.length === 1),
      // Role determination: primary album artists get 'main', others get null
      role: primaryAlbumArtistNames.has(artistRec.name) || 
            (primaryTrackArtistNames.has(artistRec.name) && primaryAlbumArtistNames.size === 0) || 
            (artistRecordsMinimal.length === 1) ? 'main' : null,
    }));

    // Ensure at least one primary artist if multiple artists exist and none were matched by name
    if (albumArtistsInfo.length > 1 && !albumArtistsInfo.some(a => a.isPrimary)) {
      const primaryDesignate = albumArtistsInfo.find(a => a.artistId === (artistRecordsMinimal.find(ar => ar.name === effectivePrimaryArtistName)?.artistId));
      if (primaryDesignate) {
        primaryDesignate.isPrimary = true;
        primaryDesignate.role = 'main';
      } else if (albumArtistsInfo.length > 0) {
         // Fallback: if effectivePrimaryArtistName didn't match any in the list (e.g. was from a different tag set)
         // or if there's only one artist, make it primary.
        albumArtistsInfo[0].isPrimary = true;
        albumArtistsInfo[0].role = 'main';
      }
    }

    // --- Initial Album Record Fetch/Creation ---
    let albumRecord = await dbOperations.findOrCreateAlbum({
      albumTitle: trackAlbumTitle || 'Unknown Album',
      artistsArray: albumArtistsInfo, // Use the new structure
      isVariousArtistsCompilation, // Pass the flag for "Various Artists" compilation detection
      userId,
      year: trackYear,
      coverPath: albumArtPath,
      musicbrainzReleaseId: musicbrainzReleaseIdFromMeta,
      folderPath,
    });

    // --- Determine skipMusicBrainzDetailsFetch ---
    if (albumRecord) {
      const hasGenres = await dbOperations.hasAlbumGenres(albumRecord.albumId);
      
      // Check if the album already existed and has complete data
      if (albumRecord.musicbrainzReleaseId && albumRecord.year !== null && hasGenres) {
        skipMusicBrainzDetailsFetch = true;
        // console.log(`  Album '${albumRecord.title}' is complete. Skipping further MusicBrainz details fetch.`);
        
        // Check if all artists also have complete data (have MusicBrainz IDs)
        const allArtistsComplete = artistRecordsMinimal.every(artist => 
          artist.musicbrainzArtistId !== null && artist.musicbrainzArtistId !== undefined);
          
        if (allArtistsComplete) {
          // All entities exist and have complete data - we can skip expensive operations
          allEntitiesExist = true;
          // console.log(`  All artists and album for track ${trackTitle} already exist with complete data. Skipping detailed processing.`);
        }
      }
    }

    // --- Full Artist Processing (Conditional Image Fetch) ---
    const finalArtistRecords: import('~/server/db/schema').Artist[] = [];
    
    // If all entities exist with complete data, we can use the minimal artist records directly
    // This avoids the expensive findOrCreateArtist calls which may trigger image fetching
    if (allEntitiesExist) {
      finalArtistRecords.push(...artistRecordsMinimal);
    } else {
      for (const minimalArtist of artistRecordsMinimal) {
        const fullArtist = await dbOperations.findOrCreateArtist({
          artistName: minimalArtist.name,
          userId,
          musicbrainzArtistId: minimalArtist.musicbrainzArtistId, // Pass MBID if available
          skipRemoteImageFetch: skipMusicBrainzDetailsFetch,
        });
        if (fullArtist) finalArtistRecords.push(fullArtist);
      }
    }
    // --- Track Artist Preparation ---
    const trackSpecificArtistNames = new Set<string>();
    
    // Use already processed primary track artists
    primaryTrackArtistNames.forEach(artist => trackSpecificArtistNames.add(artist));
    
    // Add primary album artists if there are no track artists
    if (trackSpecificArtistNames.size === 0) {
      primaryAlbumArtistNames.forEach(artist => trackSpecificArtistNames.add(artist));
    }
    
    // Add all artists from common.artists that we've already split
    (((common as any).artists || []) as string[]).forEach((artist: string) => {
      if (artist) {
        splitArtistString(artist.trim()).forEach(splitArtist => {
          trackSpecificArtistNames.add(splitArtist);
        });
      }
    });

    // Add featured artists if available
    (((common as any).featuredartists || []) as string[]).forEach((artist: string) => {
      if (artist) {
        splitArtistString(artist.trim()).forEach(splitArtist => {
          trackSpecificArtistNames.add(splitArtist);
        });
      }
    });

    // If no specific track artists found, fall back to the effective primary artist for the file
    if (trackSpecificArtistNames.size === 0 && effectivePrimaryArtistName) {
      trackSpecificArtistNames.add(effectivePrimaryArtistName);
    }
    
    // If still nothing, use "Unknown Artist"
    if (trackSpecificArtistNames.size === 0) {
        trackSpecificArtistNames.add('Unknown Artist');
    }

    // --- Prepare Track Metadata (with potential MusicBrainz fallback for track/disk numbers) ---
    let trackNumberForDb: number | null = common.track?.no ?? null;
    let diskNumberForDb: number | null = common.disk?.no ?? null;
    let durationForDb: number | null = metadata.format?.duration ? Math.round(metadata.format.duration) : null;
    const musicbrainzRecordingIdFromMeta: string | undefined = (common as any).musicbrainz_recordingid || (common as any).MUSICBRAINZ_TRACKID; // music-metadata uses 'musicbrainz_recordingid', some tags might have 'MUSICBRAINZ_TRACKID'

    if (albumRecord?.musicbrainzReleaseId && (!trackNumberForDb || trackNumberForDb === 0)) {
      const releaseTracklist = await getReleaseTracklist(albumRecord.musicbrainzReleaseId);
      if (releaseTracklist && releaseTracklist.length > 0) {
        let matchedMbTrack = null;
        // Try matching by Recording ID first (most reliable)
        if (musicbrainzRecordingIdFromMeta) {
          matchedMbTrack = releaseTracklist.find(mbTrack => mbTrack.recordingId === musicbrainzRecordingIdFromMeta);
        }
        // Fallback: Try matching by title (less reliable)
        if (!matchedMbTrack && trackTitle) {
          matchedMbTrack = releaseTracklist.find(mbTrack => 
            mbTrack.title.toLowerCase() === trackTitle.toLowerCase() ||
            (mbTrack.title.length > 5 && trackTitle.toLowerCase().includes(mbTrack.title.toLowerCase().substring(0,5))) // Basic substring match for robustness
          );
        }

        if (matchedMbTrack) {
          trackNumberForDb = matchedMbTrack.trackNumber;
          diskNumberForDb = matchedMbTrack.diskNumber;
          if (!durationForDb && matchedMbTrack.length) {
            durationForDb = Math.round(matchedMbTrack.length / 1000); // MB length is in ms
          }
        } else {
        }
      } else {
      }
    }

    const trackArtistsForDb: TrackArtistInfo[] = [];
    for (const artistName of trackSpecificArtistNames) {
      const artistRecord = finalArtistRecords.find(ar => ar.name === artistName);
      if (artistRecord) {
        // Determine primary status for the track artist
        let isPrimaryTrackArtist = false;
        if (rawTrackArtistName && rawTrackArtistName === artistName) {
          isPrimaryTrackArtist = true;
        } else if (!rawTrackArtistName && trackSpecificArtistNames.size === 1) {
          isPrimaryTrackArtist = true; // Only one artist for the track, make them primary
        }

        trackArtistsForDb.push({
          artistId: artistRecord.artistId,
          isPrimary: isPrimaryTrackArtist,
          role: isPrimaryTrackArtist ? 'main' : 'artist', // Simplified role assignment
        });
      }
    }

    // Ensure at least one primary artist if multiple exist and primary wasn't clearly identified
    if (trackArtistsForDb.length > 0 && !trackArtistsForDb.some(a => a.isPrimary)) {
      // If rawTrackArtistName was present and matched an artist, that one should already be primary.
      // This handles cases where rawTrackArtistName wasn't set or didn't match any in the list.
      trackArtistsForDb[0].isPrimary = true;
      trackArtistsForDb[0].role = 'main'; 
    } else if (trackArtistsForDb.length === 1 && trackArtistsForDb[0]) {
        // If only one artist, ensure it's primary and role is main
        trackArtistsForDb[0].isPrimary = true;
        trackArtistsForDb[0].role = 'main';
    }

    // --- Conditional Album Cover Fetch (if no MBID initially and no local cover) ---
    if (!allEntitiesExist && !skipMusicBrainzDetailsFetch && albumRecord && !albumRecord.coverPath && !albumRecord.musicbrainzReleaseId) {
      console.log(`  Album '${albumRecord.title}' lacks MBID and cover. Attempting to find MBID for cover art.`);
      try {
        let mbReleaseIdForCover: string | null = null;

        if (trackAlbumTitle && trackAlbumTitle !== 'Unknown Album' && effectivePrimaryArtistName) {
          const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, effectivePrimaryArtistName);
          if (searchResultMbId) {
            mbReleaseIdForCover = searchResultMbId;
            const updatedAlbumWithMbIdResult = await db.update(albums)
              .set({ musicbrainzReleaseId: mbReleaseIdForCover, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId))
              .returning();
            if (updatedAlbumWithMbIdResult.length > 0) {
              albumRecord = updatedAlbumWithMbIdResult[0]; // Update local albumRecord instance
              console.log(`  Found and updated album '${albumRecord.title}' with MBID: ${mbReleaseIdForCover} for cover search.`);
            }
          } else {
            console.log(`  Could not find MBID for album '${trackAlbumTitle}' by '${effectivePrimaryArtistName}' for cover search.`);
          }
        } else {
          console.log(` Skipping MBID search for cover art for '${albumRecord.title}' due to missing/generic album title or missing primary artist name.`);
        }

        if (mbReleaseIdForCover) {
          console.log(`  Fetching MB cover art for '${albumRecord.title}' (MBID: ${mbReleaseIdForCover})`);
          const mbCoverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbReleaseIdForCover);
          if (mbCoverPath) {
            const updatedAlbumResult = await db.update(albums)
              .set({ coverPath: mbCoverPath, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId)).returning();
            if (updatedAlbumResult.length > 0) {
              albumRecord = updatedAlbumResult[0]; // Update local albumRecord instance
              console.log(`  Successfully fetched and updated cover for '${albumRecord.title}'.`);
            }
          }
        }
      } catch (coverFetchError: any) {
        console.error(`  Error during conditional cover fetch for album '${albumRecord.title}': ${coverFetchError.message}`);
      }
    }

    // --- Conditional MusicBrainz Genre Fetching ---
    if (!allEntitiesExist && albumRecord?.albumId) {
      let mbReleaseIdToUseForGenres: string | undefined = albumRecord.musicbrainzReleaseId || musicbrainzReleaseIdFromMeta;

      if (!mbReleaseIdToUseForGenres && trackAlbumTitle && !skipMusicBrainzDetailsFetch) {
        // console.log(`  Searching MBID for album: ${trackAlbumTitle} by ${effectivePrimaryArtistName}`);
        const searchResultMbId = await searchReleaseByTitleAndArtist(trackAlbumTitle, effectivePrimaryArtistName);
        if (searchResultMbId) {
          mbReleaseIdToUseForGenres = searchResultMbId;
          if (albumRecord && !albumRecord.musicbrainzReleaseId) {
            const updatedAlbumResult = await db.update(albums)
              .set({ musicbrainzReleaseId: searchResultMbId, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, albumRecord.albumId)).returning();
            if (updatedAlbumResult.length > 0) albumRecord = updatedAlbumResult[0];
            // console.log(`  Found and updated album ${albumRecord.title} with MBID: ${searchResultMbId}`);
          }
        }
      }

      if (mbReleaseIdToUseForGenres && !skipMusicBrainzDetailsFetch) {
        try {
          // console.log(`  Fetching genres for album ${albumRecord.title} (MBID: ${mbReleaseIdToUseForGenres})`);
          const releaseInfo = await getReleaseInfoWithTags(mbReleaseIdToUseForGenres);
          if (releaseInfo?.genres?.length) {
            for (const genre of releaseInfo.genres) {
              const genreId = await dbOperations.findOrCreateGenre(genre.name);
              if (genreId && albumRecord?.albumId) {
                await dbOperations.linkAlbumToGenre(albumRecord.albumId, genreId);
              }
            }
            // console.log(`  Processed ${releaseInfo.genres.length} genres for ${albumRecord.title}.`);
          }
        } catch (genreError: any) {
          // console.error(`  Error fetching genres for ${albumRecord.title}: ${genreError.message}`);
        }
      } // Closes 'if (mbReleaseIdToUseForGenres && !skipMusicBrainzDetailsFetch)'
    } // Closes 'if (albumRecord?.albumId)' for genre fetching

    // --- Track Creation ---
    if (trackTitle && albumRecord?.albumId && trackArtistsForDb.length > 0) {
      const trackMetadataForDb: TrackFileMetadata = {
        trackNumber: trackNumberForDb,
        diskNumber: diskNumberForDb,
        duration: durationForDb,
        year: trackYear ?? common.year ?? albumRecord?.year ?? null,
        genre: common.genre?.join(', ') || null,
        explicit: trackExplicit,
      };

      const trackRecord = await dbOperations.findOrCreateTrack({
        title: trackTitle || 'Unknown Title', // Ensure title is never undefined
        filePath: filePath || '', // Ensure filePath is never undefined
        albumId: albumRecord!.albumId, // Added non-null assertion
        artists: trackArtistsForDb,
        musicbrainzTrackId: musicbrainzRecordingIdFromMeta || (common as any).musicbrainz_trackid,
        metadata: trackMetadataForDb,
      });

      if (trackRecord) {
        // console.log(`  Processed track: ${trackTitle} (ID: ${trackRecord.trackId})`);
      }
    } else if (trackTitle) {
      // console.warn(`  Album record not found, or no artists identified for track ${trackTitle}. Track not fully linked.`);
    }

    // Return album info for batch cover processing
    if (!albumRecord) {
      return null;
    }
    
    return {
      albumId: albumRecord.albumId,
      title: albumRecord.title,
      primaryArtistName: effectivePrimaryArtistName || 'Unknown Artist', // Provide fallback for undefined
      needsCover: !albumRecord.coverPath && !albumRecord.musicbrainzReleaseId,
    };
  } catch (error: any) { // Catch for the main try block of processAudioFile
    console.error(`[SCANNER] Failed to process audio file ${filePath}: ${error.message}. Skipping this file.`, error.stack);
    // Here, you might want to update scan statistics if you have a global stats object
    return null;
  }
} // Closing brace for processAudioFile async function

interface ScanStats {
  scannedFiles: number;
  addedTracks: number;
  addedArtists: number;
  addedAlbums: number;
  errors: number;
}
/**
 * Determines if an album folder should be treated as a Various Artists compilation
 * An album is considered a Various Artists compilation when:
 * - It contains tracks from multiple distinct primary artists
 * - No single artist has more than 5 tracks in that album folder
 * @param audioFilesInFolder Audio files in the same album folder
 * @param userId The user ID (for processing files)
 * @returns Object containing the various artists determination and optional various artists ID
 */
async function detectVariousArtistsAlbum(audioFilesInFolder: string[], userId: string): Promise<{
  isVariousArtistsCompilation: boolean;
  primaryArtistCounts: Record<string, { count: number; name: string }>;
  albumTitle?: string;
}> {
  if (audioFilesInFolder.length === 0) {
    return { isVariousArtistsCompilation: false, primaryArtistCounts: {} };
  }

  // Maximum number of tracks by the same artist before we no longer consider it a compilation
  const ARTIST_DOMINANCE_THRESHOLD = 5;
  
  const primaryArtistCounts: Record<string, { count: number; name: string }> = {};
  let albumTitle: string | undefined;

  // First pass: collect primary artist information
  for (const filePath of audioFilesInFolder) {
    try {
      const { metadata } = await extractMetadata(filePath);
      const common = metadata.common || {};
      
      // Extract album title if not already done
      if (!albumTitle && common.album) {
        albumTitle = common.album.trim();
      }

      // Get primary artist(s) for this track
      const primaryTrackArtists = new Set<string>();
      
      // From track artist
      if (common.artist) {
        splitArtistString(common.artist).forEach(artist => primaryTrackArtists.add(artist));
      }
      
      // From album artist if track artist is not available
      if (primaryTrackArtists.size === 0 && (common as any).albumartist) {
        splitArtistString((common as any).albumartist).forEach(artist => primaryTrackArtists.add(artist));
      }
      
      // Default to unknown if needed
      if (primaryTrackArtists.size === 0) {
        primaryTrackArtists.add('Unknown Artist');
      }
      
      // Count each primary artist for this track
      for (const artistName of primaryTrackArtists) {
        // Get or create artist record to get its ID
        const artistRecord = await dbOperations.getOrCreateArtistMinimal({ 
          artistName 
        });
        
        if (artistRecord) {
          const artistId = artistRecord.artistId;
          if (!primaryArtistCounts[artistId]) {
            primaryArtistCounts[artistId] = { count: 0, name: artistName };
          }
          primaryArtistCounts[artistId].count++;
        }
      }
    } catch (error) {
      // Skip files that can't be processed
      console.error(`Error analyzing file ${filePath} for artist distribution: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Analyze the distribution of primary artists
  const uniqueArtistCount = Object.keys(primaryArtistCounts).length;
  const hasDominantArtist = Object.values(primaryArtistCounts).some(info => info.count > ARTIST_DOMINANCE_THRESHOLD);
  
  // It's a Various Artists compilation if:
  // 1. There are multiple unique primary artists, AND
  // 2. No single artist has more than the threshold number of tracks
  const isVariousArtistsCompilation = uniqueArtistCount > 1 && !hasDominantArtist;
  
  return {
    isVariousArtistsCompilation,
    primaryArtistCounts,
    albumTitle
  };
}

/**
 * Scans a specific media library directory, extracts metadata, and updates the database.
 * This implements a two-phase approach:
 * 1. First phase: Create initial album records for each folder in PENDING status
 * 2. Second phase: Process audio files in each album, updating metadata and status
 * @returns Statistics about the scan operation
 */
export async function scanLibrary({
  libraryId,
  libraryPath,
  userId,
  processOnlyUnprocessed = false,
}: ScanLibraryParams): Promise<ScanStats> {
  console.log(`Starting scan for library: ${libraryPath}`);
  await dbOperations.resetScanSession(); // Clear caches for new scan

  const stats: ScanStats = {
    scannedFiles: 0,
    addedTracks: 0,
    addedArtists: 0,
    addedAlbums: 0,
    errors: 0,
  };

  try {
    // Get initial counts from database to calculate additions
    const initialCounts = await getEntityCounts(userId);
    const albumsNeedingCovers: { albumId: string; title: string; artistName: string }[] = [];

    let audioFiles: string[] = [];
    if (processOnlyUnprocessed) {
      console.log('Scanning for unprocessed albums only.');
      const albumsToScan = await dbOperations.getAlbumsToProcess(userId, true);
      console.log(`Found ${albumsToScan.length} unprocessed albums to scan.`);

      const filePromises = albumsToScan
        .filter(album => album.folderPath)
        .map(album => fileUtils.findAudioFiles(album.folderPath!));

      const filesByAlbum = await Promise.all(filePromises);
      audioFiles = filesByAlbum.flat();
    } else {
      console.log('Performing a full library scan.');
      audioFiles = await fileUtils.findAudioFiles(libraryPath);
    }
    
    if (audioFiles.length === 0) {
      console.log(`No audio files found in library: ${libraryPath}`);
      return stats;
    }
    
    console.log(`Found ${audioFiles.length} audio files. Starting metadata processing...`);
    stats.scannedFiles = audioFiles.length;
    
    // PHASE 1: Group files by folder and create initial album records
    console.log('PHASE 1: Creating initial album records for folders...');
    
    // Group files by folder (which typically represents an album)
    const filesByFolder: Record<string, string[]> = {};
    audioFiles.forEach(filePath => {
      const folder = dirname(filePath);
      if (!filesByFolder[folder]) {
        filesByFolder[folder] = [];
      }
      filesByFolder[folder].push(filePath);
    });
    
    const folderPaths = Object.keys(filesByFolder);
    console.log(`Found ${folderPaths.length} potential album folders to process.`);
    
    // Create initial album records with PENDING status
    let createdAlbums: Album[] = [];
    let albumCounter = 0;
    const totalFolders = folderPaths.length;
    
    for (const folderPath of folderPaths) {
      // Skip folders that already have a COMPLETED album for this user
      const completedAlbum = await db
        .select({ albumId: albums.albumId })
        .from(albums)
        .where(and(
          eq(albums.folderPath, folderPath),
          eq(albums.userId, userId),
          eq(albums.processedStatus, AlbumProcessStatus.COMPLETED)
        ))
        .limit(1);
      if (completedAlbum.length > 0) {
        continue; // nothing to do, already processed
      }
      const filesInFolder = filesByFolder[folderPath];
      if (filesInFolder.length === 0) continue;
      
      albumCounter++;
      console.log(`[${albumCounter}/${totalFolders}] Creating initial album record for folder: ${folderPath}`);
      
      try {
        // Try to get album name from the first audio file's metadata first
        const firstFilePath = filesInFolder[0];
        let albumTitle = 'Unknown Album';
        let extractedMetadata = null;
        
        try {
          // Try to extract metadata from the first file to get album title
          const { metadata } = await extractMetadata(firstFilePath);
          extractedMetadata = metadata;
          if (metadata?.common?.album) {
            albumTitle = metadata.common.album.trim();
          }
        } catch (metadataError) {
          console.warn(`Could not extract metadata from ${firstFilePath}, falling back to folder name`);
        }
        
        // If no album title from metadata, fall back to folder name
        if (albumTitle === 'Unknown Album') {
          const folderName = basename(folderPath);
          if (folderName) {
            albumTitle = folderName;
          }
        }
        
        // Create album record in PENDING status
        const newAlbum = await dbOperations.createInitialAlbumRecord({
          folderPath,
          albumTitle,
          userId,
          processedStatus: AlbumProcessStatus.PENDING
        });
        
        if (newAlbum) {
          createdAlbums.push(newAlbum);
        }
      } catch (error: any) {
        console.error(`Error creating initial album record for folder ${folderPath}:`, error.message);
        stats.errors++;
      }
    }
    
    console.log(`PHASE 1 complete: Created/identified ${createdAlbums.length} album records`);
    
    // PHASE 2: Process audio files for each album folder
    console.log('PHASE 2: Processing audio files and updating albums...');
    
    // Process each folder as a potential album
    for (const folderPath of folderPaths) {
      const filesInFolder = filesByFolder[folderPath];
      const albumRecord = createdAlbums.find(album => album.folderPath === folderPath);
      
      if (albumRecord) {
        // Update album to IN_PROGRESS
        await db.update(albums)
          .set({ 
            processedStatus: AlbumProcessStatus.IN_PROGRESS,
            updatedAt: new Date().toISOString()
          })
          .where(eq(albums.albumId, albumRecord.albumId));
          
        console.log(`Processing album: ${albumRecord.title} (Folder: ${folderPath})`);
        
        try {
          // Check if this folder should be treated as a "Various Artists" compilation
          const { isVariousArtistsCompilation } = await detectVariousArtistsAlbum(filesInFolder, userId);
          
          if (isVariousArtistsCompilation) {
            console.log(`Detected Various Artists compilation in folder: ${folderPath}`);
          }
          
          // Process each file in the folder with the compilation flag
          for (const filePath of filesInFolder) {
            try {
              // Pass the isVariousArtistsCompilation flag to processAudioFile
              const albumInfo = await processAudioFile(filePath, { 
                libraryId, 
                userId, 
                isVariousArtistsCompilation
              });
              
              // If the album needs a cover and has enough info to search, add to batch processing list
              if (albumInfo && albumInfo.needsCover && albumInfo.title && albumInfo.primaryArtistName) {
                albumsNeedingCovers.push({
                  albumId: albumInfo.albumId,
                  title: albumInfo.title,
                  artistName: albumInfo.primaryArtistName
                });
              }
            } catch (error: any) {
              console.error(`Error processing file ${filePath}: ${error.message}`);
              stats.errors++;
            }
          }
          
          // Mark album as COMPLETED
          await db.update(albums)
            .set({ 
              processedStatus: AlbumProcessStatus.COMPLETED,
              updatedAt: new Date().toISOString()
            })
            .where(eq(albums.albumId, albumRecord.albumId));
            
        } catch (error: any) {
          console.error(`Error processing album folder ${folderPath}: ${error.message}`);
          stats.errors++;
          
          // Mark album as FAILED
          await db.update(albums)
            .set({ 
              processedStatus: AlbumProcessStatus.FAILED,
              updatedAt: new Date().toISOString()
            })
            .where(eq(albums.albumId, albumRecord.albumId));
        }
      }
    }
    
    // Batch process album covers after all files are processed
    if (albumsNeedingCovers.length > 0) {
      console.log(`Batch processing covers for ${albumsNeedingCovers.length} albums...`);
      await batchProcessAlbumCovers(albumsNeedingCovers);
    }
    
    // Get final counts to calculate additions
    const finalCounts = await getEntityCounts(userId);
    
    // Calculate additions
    stats.addedTracks = finalCounts.tracks - initialCounts.tracks;
    stats.addedArtists = finalCounts.artists - initialCounts.artists;
    stats.addedAlbums = finalCounts.albums - initialCounts.albums;
    
    console.log(`Scan complete. Added ${stats.addedTracks} tracks, ${stats.addedArtists} artists, ${stats.addedAlbums} albums.`);
    
    // Reset caches after scan is complete
    await dbOperations.resetScanSession();
    
    return stats;
  } catch (error: any) {
    console.error(`Scan error: ${error.message}`);
    stats.errors++;
    return stats;
  }
}

/**
 * Batch processes album covers for multiple albums at once
 */
async function batchProcessAlbumCovers(albumsToProcess: { albumId: string; title: string; artistName: string }[]): Promise<void> {
  // Process in smaller batches to avoid overwhelming the MusicBrainz API
  const batchSize = 10;
  
  for (let i = 0; i < albumsToProcess.length; i += batchSize) {
    const batch = albumsToProcess.slice(i, i + batchSize);
    
    // Process each album in the current batch
    const promises = batch.map(async (album) => {
      try {
        // Search for MusicBrainz release ID
        const mbReleaseId = await searchReleaseByTitleAndArtist(album.title, album.artistName);
        
        if (mbReleaseId) {
          // Update album with MusicBrainz release ID
          await db.update(albums)
            .set({ musicbrainzReleaseId: mbReleaseId, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, album.albumId));
          
          // Fetch and save cover art
          const coverPath = await albumArtUtils.downloadAlbumArtFromMusicBrainz(mbReleaseId);
          
          if (coverPath) {
            await db.update(albums)
              .set({ coverPath: coverPath, updatedAt: new Date().toISOString() })
              .where(eq(albums.albumId, album.albumId));
          }
        }
      } catch (error) {
        // Log error but continue with other albums
        console.error(`Error processing cover for album ${album.title}: ${error}`);
      }
    });
    
    // Wait for current batch to complete before moving to next batch
    await Promise.all(promises);
    
    // Add a small delay between batches to respect API rate limits
    if (i + batchSize < albumsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

/**
 * Gets the current count of entities (tracks, artists, albums) for a user
 */
async function getEntityCounts(userId: string): Promise<{ tracks: number; artists: number; albums: number }> {
  // Count tracks for the user
  const [tracksResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(tracks);
  
  // Count artists for the user
  const [artistsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(artistUsers)
    .where(eq(artistUsers.userId, userId));
  
  // Count albums for the user
  const [albumsResult] = await db
    .select({ count: sql<number>`count(*)` })
    .from(albums)
    .where(eq(albums.userId, userId));
  
  return {
    tracks: tracksResult?.count || 0,
    artists: artistsResult?.count || 0,
    albums: albumsResult?.count || 0
  };
}

/**
 * Scans the covers directory and updates the database by setting coverPath to null
 * for albums whose cover art files are missing from disk.
 */
export async function pruneOrphanedAlbumArtPaths(): Promise<void> {
  console.log('Starting scan to prune orphaned album art paths...');
  
  try {
    // Ensure the covers directory exists
    await fileUtils.ensureDir(albumArtUtils.COVERS_DIR);
    
    // Get all files in the covers directory
    const filesOnDisk = await fileUtils.readdir(albumArtUtils.COVERS_DIR);
    const existingCoverFiles = new Set(filesOnDisk);
    
    console.log(`Found ${existingCoverFiles.size} files in ${albumArtUtils.COVERS_DIR}.`);

    // Find all albums with a cover path
    const albumsWithArt = await db
      .select({
        albumId: albums.albumId,
        title: albums.title,
        coverPath: albums.coverPath,
      })
      .from(albums)
      .where(sql`${albums.coverPath} IS NOT NULL AND ${albums.coverPath} != ''`);

    if (albumsWithArt.length === 0) {
      console.log('No albums in the database have a cover path set. Nothing to prune.');
      return;
    }

    console.log(`Checking ${albumsWithArt.length} albums with cover paths in the database.`);
    let prunedCount = 0;

    // Check each album's cover path
    for (const album of albumsWithArt) {
      if (!album.coverPath) continue;
      
      const filename = basename(album.coverPath);
      
      if (!existingCoverFiles.has(filename)) {
        console.log(`  Found orphaned cover path for album "${album.title}" (ID: ${album.albumId}): ${album.coverPath}`);
        
        // Update the album to remove the cover path
        await db
          .update(albums)
          .set({ coverPath: null, updatedAt: new Date().toISOString() })
          .where(eq(albums.albumId, album.albumId));
          
        prunedCount++;
      }
    }

    console.log(`Pruned ${prunedCount} orphaned album art paths.`);
  } catch (error: any) {
    console.error('Error pruning orphaned album art paths:', error.message);
    throw error;
  }
}

/**
 * Gets album covers in batches, optimizing API calls.
 * @param albumsNeedingCovers Albums that need cover art
 * @returns Array of processed album IDs
 */
async function getBatchedCovers(albumsNeedingCovers: { albumId: string; title: string; artistName: string }[]): Promise<string[]> {
  const processedAlbumIds: string[] = [];
  
  console.log(`Processing batch cover fetching for ${albumsNeedingCovers.length} albums`);
  
  // Process in smaller batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < albumsNeedingCovers.length; i += batchSize) {
    const batch = albumsNeedingCovers.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (album) => {
      try {
        const coverPath = await albumArtUtils.searchAndDownloadAlbumArt(album.title, album.artistName);
        
        if (coverPath) {
          await db.update(albums)
            .set({ coverPath, updatedAt: new Date().toISOString() })
            .where(eq(albums.albumId, album.albumId));
            
          return album.albumId;
        }
      } catch (error) {
        console.error(`Error fetching cover for album ${album.title} by ${album.artistName}:`, error);
      }
      return null;
    });
    
    const batchResults = await Promise.all(batchPromises);
    for (const albumId of batchResults) {
      if (albumId) processedAlbumIds.push(albumId);
    }
    
    // Small delay between batches to avoid rate limits
    if (i + batchSize < albumsNeedingCovers.length) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  
  console.log(`Successfully fetched ${processedAlbumIds.length} album covers out of ${albumsNeedingCovers.length} requested`);
  return processedAlbumIds;
}

/**
 * Identifies potential album folders from a list of audio files.
 * @param audioFiles Array of audio file paths
 * @returns Map of folder paths to audio files in that folder
 */
function identifyAlbumFolders(audioFiles: string[]): Map<string, string[]> {
  const albumFolders = new Map<string, string[]>();
  
  // Group audio files by their parent folder
  for (const filePath of audioFiles) {
    const folderPath = dirname(filePath);
    if (!albumFolders.has(folderPath)) {
      albumFolders.set(folderPath, []);
    }
    albumFolders.get(folderPath)!.push(filePath);
  }
  
  return albumFolders;
}

/**
 * Creates initial album records for each folder in PENDING status.
 * @param folderMap Map of folder paths to audio files in that folder
 * @param params Parameters needed for album creation
 * @returns Array of created album records
 */
async function createInitialAlbumRecords(
  folderMap: Map<string, string[]>,
  { libraryId, userId }: { libraryId: string; userId: string }
): Promise<Album[]> {
  const createdAlbums: Album[] = [];
  let counter = 0;
  const totalFolders = folderMap.size;
  
  for (const [folderPath, audioFiles] of folderMap.entries()) {
    counter++;
    console.log(`[${counter}/${totalFolders}] Creating initial album record for folder: ${folderPath}`);
    
    try {
      if (audioFiles.length === 0) continue;
      
      // Try to get album name from folder
      const folderName = basename(folderPath);
      
      // Create album record in PENDING status
      const newAlbum = await dbOperations.createInitialAlbumRecord({
        folderPath,
        albumTitle: folderName || 'Unknown Album',
        userId,
        processedStatus: AlbumProcessStatus.PENDING
      });
      
      if (newAlbum) {
        createdAlbums.push(newAlbum);
      }
    } catch (error) {
      console.error(`Error creating initial album record for folder ${folderPath}:`, error);
    }
  }
  
  console.log(`Created initial records for ${createdAlbums.length} albums`);
  return createdAlbums;
}

// Create a grouped export object that includes all scanner functions
const scanner = {
  scanLibrary,
  extractMetadata,
  pruneOrphanedAlbumArtPaths,
  processAudioFile,
  getBatchedCovers,
  identifyAlbumFolders,
  createInitialAlbumRecords,
};

// Export as default for backward compatibility
export default scanner;

// Export types
export * from './types';

// Export utility functions
export * from './file-utils';
export * from './album-art-utils';
export * from './db-operations';

export { batchProcessAlbumCovers };
