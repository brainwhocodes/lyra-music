// Additional paraphrases fixed before evaluating the lexical/category-diversity candidate.
// This is a small holdout on the existing catalog, not an independent music corpus.
export const HOLDOUT_SEARCH_CASES = [
  { query: 'Slow instrumental keys for a peaceful night with no singing.', relevance: { 'quiet-piano': 2, 'quiet-guitar': 1 } },
  { query: 'A racing electronic beat for a busy dancefloor.', relevance: { 'dance-synth': 2, 'dance-drums': 1 } },
  { query: 'Remembering a departed loved one in a sorrowful ballad.', relevance: { 'loss-piano': 2, 'loss-folk': 2 } },
  { query: 'The sound of a rainy woodland and animals.', relevance: { forest: 2, ocean: 1 } },
  { query: 'Lyrics about the coast, tides, and sea birds.', relevance: { ocean: 2, forest: 1 } },
  { query: 'Affectionate songs about a lifelong promise between partners.', relevance: { 'love-folk': 2, 'love-jazz': 2 } },
  { query: 'Heading somewhere unfamiliar with a suitcase and train ticket.', relevance: { 'travel-folk': 2, 'travel-rock': 1 } },
  { query: 'Unamplified string playing for a gentle bedtime.', relevance: { 'quiet-guitar': 2, 'quiet-piano': 1 } },
];
