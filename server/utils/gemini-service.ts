import { GoogleGenAI, HarmCategory, HarmBlockThreshold } from '@google/genai';
import { readFileSync } from 'node:fs';
import { parse, stringify } from 'yaml';

const config = useRuntimeConfig();
// Define the expected structure for a timestamped lyric line
export interface TimestampedLyric {
  time: string; // Format: MM:SS.mmm or HH:MM:SS.mmm
  text: string;
}

const API_KEY = config.geminiApiKey;

if (!API_KEY) {
  console.warn('GEMINI_API_KEY is not set. GeminiService will not function.');
}

// Initialize with a placeholder if API_KEY is not set, to allow type checking but prevent runtime errors during init
const ai = new GoogleGenAI({ apiKey: API_KEY || '' });

const generationConfig = {
  temperature: 0.1, // Lower temperature for more deterministic output for transcription
  topK: 0,
  topP: 0.95,
};

const safetySettings = [
  { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_NONE },
  { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_NONE },
];

/**
 * Transcribes an audio file using the Gemini API and attempts to get timestamped lyrics.
 * IMPORTANT: This function currently contains placeholders for server-side file handling.
 * Gemini API requires audio via GCS URI or inline base64 data.
 *
 * @param filePath The local path to the audio file. THIS WILL NOT WORK DIRECTLY.
 * @param mimeType The MIME type of the audio file (e.g., 'audio/mp3').
 * @returns A promise that resolves to an array of TimestampedLyric objects.
 * @throws Throws an error if transcription fails, API key is missing, or the output format is incorrect.
 */
export async function transcribeAudioWithTimestamps(filePath: string, mimeType: string, trackTitle: string, artistName: string): Promise<TimestampedLyric[]> {
  if (!API_KEY) {
    throw new Error('Gemini API key is not configured. Please set GEMINI_API_KEY environment variable.');
  }

  try {
    // TODO: Implement server-side file handling.
    // Option 1: Upload file to Google Cloud Storage, then use the gs:// URI.
    // Option 2: Read file into a Buffer, convert to base64, and send as inlineData (for smaller files).
    // Direct filePath usage as shown in some client-side examples WILL NOT WORK here.
    // For production or larger files, consider uploading to Google Cloud Storage and using the GCS URI.
    // This implementation uses inline base64 data, suitable for smaller files.
    console.log(`[GeminiService] Transcribing audio file: ${filePath} with mimeType: ${mimeType}`);

    const audioBuffer = readFileSync(filePath);
    const audioBase64 = audioBuffer.toString('base64');

    // Build the prompt and audio part for Gemini
    const prompt = `
HIGH-PRECISION “NO-DRIFT” LYRIC-TRANSCRIPTION PROMPT
────────────────────────────────────────

SYSTEM ROLE
You are SongScribe, an expert who delivers frame-accurate karaoke lyrics. All instructions are mandatory.

TRACK DETAILS
SONG  : “${trackTitle}”
ARTIST: “${artistName}”

DELIVERABLES (MUST APPEAR IN THIS EXACT ORDER)

1. YAML lyrics
Include the lyrics header exactly as shown:
lyrics:
- time: "00:00"
  line: "First lyric line"
- time: "00:05"
  line: "Second lyric line"
- time: "01:12.34"
  line: "\[instrumental]”

# …continue until the track ends

YAML rules
• Double-quote every time and line value.
• Indent with two spaces.
• No tabs, no trailing spaces, end file with a newline.

────────────────────────────────────────
ANTI-DRIFT TIMESTAMP RULES

1. Hard anchors
   Restart timing at the downbeat of each verse, chorus, bridge, and any section break longer than five seconds. Re-calculate subsequent times from that anchor to kill cumulative drift.

2. Tolerance check
   After each 30-second span, compare your current wall-clock with the audio’s playhead. If misalignment exceeds ±0.15 s, rewind, correct prior entries, and resume.

3. Waveform verification
   For every line, zoom to the waveform peak of the first syllable to place the timestamp. Never estimate by ear alone.

4. Back-pass audit
   When transcription is finished, run a complete pass watching the finished captions over the track. Correct any line that appears more than 120 ms early or late.

5. Resolution
   Use hundredths (mm\:ss.SS) whenever the song is faster than 100 BPM or has dense lyrics (> 3 lines every 5 s). Otherwise mm\:ss is acceptable.

6. Cumulative safeguard
   If the track length in your final YAML differs from the player’s duration by more than 0.50 s, you must locate and fix the drift source before submission.

────────────────────────────────────────

FINAL INSTRUCTION
Output only the YAML block exactly as specified above. Any extra text, commentary, or formatting causes rejection. No markdown or other formatting.
`;

    // Prepare the contents array for the Gemini API
    const audioPart = {
      inlineData: {
        mimeType: mimeType,
        data: audioBase64,
      },
    };
    const contents = [{ text: prompt }, audioPart];

    // Call Gemini using the new models.generateContent method
    console.log('[GeminiService] Sending request to Gemini API for transcription...');
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-preview-05-20',
      contents,
      config: {
       tools: [{googleSearch: {}}]
      }
    });
    const responseText = response.text;
    console.log('[GeminiService] Received response from Gemini API (transcription).');
    // Log the full response for debugging
    console.log('[GeminiService] Full response text:\n', responseText);

    if (!responseText) {
      throw new Error('Gemini API response is empty.');
    }
    // --- Parse and Extract Lyrics using js-yaml ---
    try {
      const parsedYaml = parse(responseText) as any;
      let rawLyrics: { time?: string; line?: string }[] = [];

      if (parsedYaml && typeof parsedYaml === 'object') {
        if (Array.isArray(parsedYaml.lyrics)) {
          // Case: { lyrics: [ {time, line}, ... ] }
          rawLyrics = parsedYaml.lyrics;
        } else if (Array.isArray(parsedYaml)) {
          // Case: [ {time, line}, ... ] (direct array, possibly if 'lyrics:' header was missing and it's just the list)
          rawLyrics = parsedYaml;
        }
      }
      
      if (rawLyrics.length === 0 && typeof parsedYaml === 'object' && parsedYaml !== null) {
        // Fallback for cases where the YAML might be just the list under a different key or malformed
        // but still parsable as an object containing an array somewhere.
        // This is a bit speculative and might need refinement based on actual error cases.
        const keys = Object.keys(parsedYaml);
        if (keys.length === 1 && Array.isArray(parsedYaml[keys[0]])) {
          rawLyrics = parsedYaml[keys[0]];
        }
      }

      if (rawLyrics.length === 0) {
        console.error('[GeminiService] Parsed YAML but found no lyrics array or it was empty:', parsedYaml);
        throw new Error('Parsed YAML, but the expected lyrics array was not found or was empty.');
      }

      const timestampedLyrics: TimestampedLyric[] = rawLyrics.map((item: any) => {
        if (typeof item.time !== 'string' || typeof item.line !== 'string') {
          console.warn('[GeminiService] Invalid lyric item structure in YAML:', item);
          throw new Error('Invalid lyric item structure in parsed YAML.');
        }
        return { time: item.time, text: item.line };
      }).filter(lyric => lyric !== null) as TimestampedLyric[];

      if (timestampedLyrics.length === 0) {
        throw new Error('No valid timestamped lyrics found after parsing YAML.');
      }

      return timestampedLyrics;
    } catch (yamlError) {
      console.error('[GeminiService] Failed to parse YAML response:', yamlError);
      console.error('[GeminiService] Original response text for YAML parsing error:\n', responseText);
      throw new Error(`Failed to parse lyrics from Gemini response (YAML parsing error): ${yamlError instanceof Error ? yamlError.message : 'Unknown YAML error'}`);
    }

  } catch (error) {
    console.error('[GeminiService] Error during audio transcription:', error);
    if (error instanceof Error && error.message.startsWith('Failed to parse lyrics from Gemini response')) {
        throw error; // Re-throw specific parsing errors to avoid double wrapping
    }
    if (error instanceof Error) {
      throw new Error(`Gemini API transcription request failed: ${error.message}`);
    }
    throw new Error('Gemini API request failed with an unknown error.');
  }
}
