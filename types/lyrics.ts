// types/lyrics.ts

/**
 * Defines the structure for a single timestamped lyric line.
 */
export interface TimestampedLyric {
  time: string; // Format: MM:SS.mmm or HH:MM:SS.mmm
  text: string;
}
