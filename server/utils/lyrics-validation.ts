import { z } from 'zod';

// Individual lyric line schema
export const lyricLineSchema = z.object({
  time: z.string().regex(/^\d{2}:\d{2}\.\d{3}$/, {
    message: 'Time must be in mm:ss.SSS format (e.g., 00:12.345)',
  }),
  text: z.string(),
});

// Schema for the entire lyrics array (YAML output from LLM)
export const lyricsSchema = z.array(lyricLineSchema);

export type LyricLine = z.infer<typeof lyricLineSchema>;
export type LyricsOutput = z.infer<typeof lyricsSchema>;

/**
 * Validates the raw YAML string (after parsing to JSON) against the lyrics schema.
 * @param data The data parsed from YAML (expected to be an array of lyric lines).
 * @returns A promise that resolves with the validated data or throws an error if validation fails.
 */
export async function validateLyricsData(data: unknown): Promise<LyricsOutput> {
  const validationResult = await lyricsSchema.safeParseAsync(data);
  if (!validationResult.success) {
    // Log the specific Zod error details for better debugging
    console.error('Lyrics validation failed:', validationResult.error.flatten());
    throw new Error('Invalid lyrics data format received from LLM.');
  }
  return validationResult.data;
}
