import { createError } from 'h3';
import { inArray } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '~/server/db';
import { artists, genres } from '~/server/db/schema';
import path from 'node:path';

const stationInput = z.object({
  name: z.string().trim().min(1).max(200),
  artistIds: z.array(z.string().min(1).max(200)).max(100).optional().default([]),
  genreIds: z.array(z.string().min(1).max(200)).max(100).optional().default([]),
});

export function parseStationInput(body: unknown) {
  const result = stationInput.safeParse(body);
  if (!result.success) throw createError({ statusCode: 400, statusMessage: 'Provide a station name and valid artist/genre IDs.' });
  return { ...result.data, artistIds: [...new Set(result.data.artistIds)], genreIds: [...new Set(result.data.genreIds)],
    replaceArtists: Object.hasOwn(body as object, 'artistIds'), replaceGenres: Object.hasOwn(body as object, 'genreIds') };
}

type Transaction = Parameters<Parameters<typeof db.transaction>[0]>[0];
export function validateStationSeeds(tx: Transaction, input: ReturnType<typeof parseStationInput>) {
  const artistCount = input.artistIds.length ? tx.select({ id: artists.artistId }).from(artists).where(inArray(artists.artistId, input.artistIds)).all().length : 0;
  const genreCount = input.genreIds.length ? tx.select({ id: genres.genreId }).from(genres).where(inArray(genres.genreId, input.genreIds)).all().length : 0;
  if (artistCount !== input.artistIds.length || genreCount !== input.genreIds.length) throw createError({ statusCode: 400, statusMessage: 'One or more station seeds do not exist.' });
}

export const stationRelations = { radioChannelArtists: { with: { artist: true } }, radioChannelGenres: { with: { genre: true } } } as const;

/** Only remove image files produced by the radio uploader, never arbitrary stored paths. */
export function stationImagePath(stored: string | null): string | undefined {
  if (!stored || !/^\/uploads\/radio\/(logos|backgrounds)\/[a-f0-9-]{36}\.(png|jpe?g|webp|gif)$/i.test(stored)) return;
  return path.resolve(process.cwd(), stored.slice(1));
}
