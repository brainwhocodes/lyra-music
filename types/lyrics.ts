// types/lyrics.ts

/**
 * Defines the structure for a single timestamped lyric line.
 */
export interface TimestampedLyric {
  time: string; // Format: MM:SS.mmm or HH:MM:SS.mmm
  text: string;
}

/**
 * Defines the structure for lyrics data, aligning with the database schema.
 */
export interface Lyrics {
  lyricsId: string;
  trackId: string;
  lyricsJson: TimestampedLyric[] | null;
  source?: string | null; // e.g., 'generated_llm', 'manual_upload', 'synced_lrc', 'user_edited'
  llmModelUsed?: string | null;
  rawLlmOutput?: string | null;
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
}

