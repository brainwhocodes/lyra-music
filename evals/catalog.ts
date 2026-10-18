import type { LibraryTrack } from '../server/services/intelligence/types';

// Original evaluation text, authored before running the model. Descriptions
// deliberately paraphrase queries; no real artist lyrics or model output here.
const descriptions = [
  ['quiet-piano', 'Nightclub at Dawn', 'Quiet Room', 'solo piano instrumental', 'Gentle keys, long rests and a peaceful hush invite the listener to slow their breathing.'],
  ['quiet-guitar', 'A Small Shelter', 'Wood and String', 'acoustic instrumental', 'A delicate guitar lullaby for resting at the end of a tiring day. No vocalist performs.'],
  ['dance-synth', 'Still Water', 'Neon Floor', 'electronic dance', 'The synthesizers pulse at high speed. We jump together as the bass shakes the crowded club.'],
  ['dance-drums', 'After Midnight', 'Summer Festival', 'energetic dance pop', 'Raise your hands and move your feet. The drums drive an exuberant party until sunrise.'],
  ['loss-piano', 'The Empty Chair', 'Letters Unsent', 'sad piano ballad', 'Your coat still hangs beside the door. I grieve alone for someone who will never come home.'],
  ['loss-folk', 'The Last Photograph', 'Dusty Frames', 'melancholy acoustic folk', 'I miss the life we had. Every faded photograph brings sorrow and a lonely aching heart.'],
  ['forest', 'Under the Canopy', 'Green Valley', 'ambient nature', 'Rain falls through the trees. Birds call over a woodland stream far from the city.'],
  ['ocean', 'Salt and Sky', 'Coastline', 'ambient nature', 'Waves wash the beach beneath a wide blue sky. Seabirds glide above the tide.'],
  ['love-jazz', 'Your Hand in Mine', 'Two Together', 'romantic jazz', 'I love you more each day. Stay close, my darling, and share a tender kiss with me.'],
  ['love-folk', 'Our Wedding Morning', 'A Promise', 'romantic acoustic folk', 'Two hearts make a promise of lifelong love. I choose you today and every day.'],
  ['travel-rock', 'Beyond the Border', 'Open Road', 'adventure rock', 'Pack the bags and leave this town. The highway calls us toward distant countries and new adventures.'],
  ['travel-folk', 'A Ticket West', 'New Horizons', 'travelling acoustic folk', 'Board the train with a battered suitcase. We explore unfamiliar places and never stay for long.'],
] as const;

export const CATALOG: LibraryTrack[] = descriptions.map(([trackId, title, albumTitle, genre, lyrics], index) => ({
  trackId, title, albumId: `album-${index}`, albumTitle, artists: [`Fixture Artist ${index}`],
  genre, lyrics, year: 2024, duration: 180, coverPath: null,
  createdAt: `2026-01-${String(index + 1).padStart(2, '0')}T00:00:00.000Z`,
}));

export const SEARCH_CASES = [
  { query: 'Help me unwind and rest after a stressful afternoon.', relevance: { 'quiet-piano': 2, 'quiet-guitar': 2 } },
  { query: 'Fast songs for dancing with a crowd.', relevance: { 'dance-synth': 2, 'dance-drums': 2 } },
  { query: 'Songs about mourning someone and feeling alone.', relevance: { 'loss-piano': 2, 'loss-folk': 2 } },
  { query: 'Escape outdoors among trees, water and wildlife.', relevance: { forest: 2, ocean: 1 } },
  { query: 'Tender music for two people in love.', relevance: { 'love-jazz': 2, 'love-folk': 2 } },
  { query: 'Leaving home to discover faraway places.', relevance: { 'travel-rock': 2, 'travel-folk': 2 } },
  { query: 'Instrumental music for a quiet breathing exercise.', relevance: { 'quiet-piano': 2, 'quiet-guitar': 2 } },
  { query: 'Something that evokes waves and a seaside landscape.', relevance: { ocean: 2, forest: 1 } },
];

export const TAG_CASES = [
  { trackId: 'quiet-piano', required: ['calm'], forbidden: ['energetic', 'romantic'] },
  { trackId: 'dance-synth', required: ['energetic', 'electronic'], forbidden: ['calm', 'melancholy'] },
  { trackId: 'loss-piano', required: ['melancholy'], forbidden: ['energetic', 'hopeful'] },
  { trackId: 'forest', required: ['nature'], forbidden: ['romantic', 'energetic'] },
  { trackId: 'love-jazz', required: ['romantic'], forbidden: ['melancholy', 'journey'] },
  { trackId: 'travel-rock', required: ['journey'], forbidden: ['romantic', 'calm'] },
];

export const RECOMMENDATION_CASES = [
  { seed: 'quiet-piano', relevant: ['quiet-guitar'], forbidden: ['dance-synth', 'dance-drums'] },
  { seed: 'dance-synth', relevant: ['dance-drums'], forbidden: ['quiet-piano', 'quiet-guitar'] },
  { seed: 'loss-piano', relevant: ['loss-folk'], forbidden: ['dance-synth', 'dance-drums'] },
  { seed: 'forest', relevant: ['ocean'], forbidden: ['dance-synth', 'dance-drums'] },
  { seed: 'love-jazz', relevant: ['love-folk'], forbidden: ['loss-piano', 'loss-folk'] },
  { seed: 'travel-rock', relevant: ['travel-folk'], forbidden: ['quiet-piano', 'quiet-guitar'] },
];
