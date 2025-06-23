import { defineEventHandler, getRouterParam, createError } from 'h3';
import { db } from '~/server/db';
import { radioChannels } from '~/server/db/schema/radio-channels';
import { radioChannelArtists } from '~/server/db/schema/radio-channel-artists';
import { radioChannelGenres } from '~/server/db/schema/radio-channel-genres';
import { artistsTracks } from '~/server/db/schema/artists-tracks';
import { albumGenres } from '~/server/db/schema/album-genres';
import { tracks } from '~/server/db/schema/tracks';
import { sql, inArray, or, eq } from 'drizzle-orm';
import type { Track, TrackArtistDetail } from '~/types/track';
import { shuffle } from '~/server/utils/array';

const SEED_BATCH_SIZE = 200; // Fetch a larger pool of tracks for randomness
const FINAL_BATCH_SIZE = 50; // The final number of tracks to return

function reorderToAvoidConsecutiveArtists(tracks: Track[]): Track[] {
  const result = [...tracks];
  for (let i = 1; i < result.length; i++) {
    const prevArtistId = result[i - 1]?.artists?.[0]?.artistId;
    const currArtistId = result[i]?.artists?.[0]?.artistId;
    if (prevArtistId && currArtistId && prevArtistId === currArtistId) {
      let swapIndex = i + 1;
      while (
        swapIndex < result.length &&
        result[swapIndex]?.artists?.[0]?.artistId === prevArtistId
      ) {
        swapIndex++;
      }
      if (swapIndex < result.length) {
        [result[i], result[swapIndex]] = [result[swapIndex], result[i]];
      }
    }
  }
  return result;
}

export default defineEventHandler(async (event) => {
  const channelId = getRouterParam(event, 'id');

  if (!channelId) {
    throw createError({ statusCode: 400, statusMessage: 'Missing channel ID' });
  }

  const channel = await db.query.radioChannels.findFirst({
    where: eq(radioChannels.channelId, channelId),
  });

  if (!channel) {
    throw createError({ statusCode: 404, statusMessage: 'Radio station not found' });
  }

  let fetchedTracks: Track[] = [];

  try {
    if (channel.dynamic) {
      const seedArtists = await db.query.radioChannelArtists.findMany({
        where: eq(radioChannelArtists.channelId, channelId),
        columns: { artistId: true },
      });
      const seedArtistIds = seedArtists.map((a: { artistId: string }) => a.artistId);

      const seedGenres = await db.query.radioChannelGenres.findMany({
        where: eq(radioChannelGenres.channelId, channelId),
        columns: { genreId: true },
      });
      const seedGenreIds = seedGenres.map((g: { genreId: string }) => g.genreId);

      const queryConditions = [];

      if (seedArtistIds.length > 0) {
        const artistTrackIdsQuery = db
          .select({ trackId: artistsTracks.trackId })
          .from(artistsTracks)
          .where(inArray(artistsTracks.artistId, seedArtistIds));
        queryConditions.push(inArray(tracks.trackId, artistTrackIdsQuery));
      }

      if (seedGenreIds.length > 0) {
        const genreAlbumIdsQuery = db
          .select({ albumId: albumGenres.albumId })
          .from(albumGenres)
          .where(inArray(albumGenres.genreId, seedGenreIds));
        queryConditions.push(inArray(tracks.albumId, genreAlbumIdsQuery));
      }

      if (queryConditions.length > 0) {
        let dynamicTracks = await db.query.tracks.findMany({
          where: or(...queryConditions),
          orderBy: sql`RANDOM()`,
          limit: SEED_BATCH_SIZE,
          with: {
            album: true,
            artistsTracks: { with: { artist: true } },
          },
        });

        // Shuffle the array to mix artists and genres together properly
        dynamicTracks = shuffle(dynamicTracks);

        // Take the final batch size after shuffling
        const finalTracks = dynamicTracks.slice(0, FINAL_BATCH_SIZE);

        fetchedTracks = finalTracks.map((track): Track => ({
          ...track,
          albumTitle: track.album?.title,
          coverPath: track.album?.coverPath,
          musicbrainzTrackId: track.musicbrainzTrackId ?? undefined,
          artists: track.artistsTracks.map((artistTrack): TrackArtistDetail => ({
            artistId: artistTrack.artist.artistId,
            name: artistTrack.artist.name,
            role: artistTrack.role ?? undefined,
            isPrimaryArtist: !!artistTrack.isPrimaryArtist,
          })),
        }));
      }
    } else {
      // TODO: Implement logic for non-dynamic, manually curated stations
      // This would fetch from the `radio_channel_tracks` table
    }

    return reorderToAvoidConsecutiveArtists(fetchedTracks);
  } catch (error: any) {
    console.error(`Error fetching tracks for radio station ${channelId}:`, error);
    throw createError({ statusCode: 500, statusMessage: 'Failed to fetch tracks for station' });
  }
});
