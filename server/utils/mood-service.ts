interface MoodMappingData {
  predefinedMoods: readonly string[];
  genreToMoodMap: { [genre: string]: string[] };
}

let moodData: MoodMappingData = {
  predefinedMoods: [
    "Energetic",
    "Chill / Relaxed",
    "Happy / Upbeat",
    "Sad / Melancholic",
    "Romantic",
    "Intense / Powerful",
    "Peaceful / Serene",
    "Dark / Brooding",
    "Funky / Groovy",
    "Experimental / Avant-garde",
    "Nostalgic",
    "Hopeful",
    "Aggressive",
    "Dreamy"
  ],
  genreToMoodMap: {
    "electronic": ["Energetic", "Happy / Upbeat", "Funky / Groovy"],
    "dance": ["Energetic", "Happy / Upbeat", "Funky / Groovy"],
    "house": ["Energetic", "Funky / Groovy", "Happy / Upbeat"],
    "techno": ["Energetic", "Intense / Powerful", "Dark / Brooding"],
    "ambient": ["Chill / Relaxed", "Peaceful / Serene", "Dreamy"],
    "lo-fi": ["Chill / Relaxed", "Nostalgic"],
    "downtempo": ["Chill / Relaxed", "Dreamy"],
    "rock": ["Energetic", "Intense / Powerful"],
    "pop": ["Happy / Upbeat", "Energetic", "Romantic"],
    "indie pop": ["Happy / Upbeat", "Dreamy", "Nostalgic"],
    "alternative rock": ["Energetic", "Intense / Powerful", "Sad / Melancholic"],
    "metal": ["Intense / Powerful", "Aggressive", "Dark / Brooding"],
    "classical": ["Peaceful / Serene", "Romantic", "Sad / Melancholic", "Intense / Powerful"],
    "jazz": ["Chill / Relaxed", "Funky / Groovy", "Romantic", "Nostalgic"],
    "blues": ["Sad / Melancholic", "Chill / Relaxed", "Nostalgic"],
    "hip hop": ["Energetic", "Funky / Groovy", "Happy / Upbeat"],
    "rap": ["Energetic", "Aggressive", "Intense / Powerful"],
    "r&b": ["Romantic", "Chill / Relaxed", "Funky / Groovy"],
    "soul": ["Happy / Upbeat", "Romantic", "Funky / Groovy", "Nostalgic"],
    "folk": ["Sad / Melancholic", "Peaceful / Serene", "Romantic", "Nostalgic", "Hopeful"],
    "country": ["Happy / Upbeat", "Sad / Melancholic", "Nostalgic", "Romantic"],
    "reggae": ["Happy / Upbeat", "Chill / Relaxed"],
    "ska": ["Energetic", "Happy / Upbeat", "Funky / Groovy"],
    "punk": ["Energetic", "Aggressive", "Intense / Powerful"],
    "soundtrack": ["Intense / Powerful", "Romantic", "Sad / Melancholic", "Peaceful / Serene", "Dreamy"]
  }
};

// Dynamically create the Mood type from the JSON data
export type Mood = typeof moodData.predefinedMoods[number];

/**
 * Retrieves a list of moods associated with the given track genres.
 *
 * @param trackGenres - An array of genre strings for a track.
 * @returns An array of unique Mood strings.
 */
export function getMoodsForTrackGenres(trackGenres: ReadonlyArray<string>): Mood[] {
  if (!trackGenres || trackGenres.length === 0) {
    return [];
  }

  const { genreToMoodMap } = moodData;
  const moods = new Set<Mood>();

  for (const genre of trackGenres) {
    if (typeof genre !== 'string') continue; // Skip non-string genres

    const genreLower = genre.toLowerCase();
    const mappedMoods = genreToMoodMap[genreLower];

    if (Array.isArray(mappedMoods)) {
      for (const mood of mappedMoods) {
        // Ensure the mood from the map is actually one of the predefined moods
        if ((moodData.predefinedMoods as ReadonlyArray<string>).includes(mood)) {
          moods.add(mood as Mood);
        }
      }
    }
  }
  return Array.from(moods);
}

/**
 * Returns all predefined moods.
 * @returns A readonly array of all predefined mood strings.
 */
export function getAllPredefinedMoods(): ReadonlyArray<Mood> {
  return moodData.predefinedMoods as ReadonlyArray<Mood>;
}
