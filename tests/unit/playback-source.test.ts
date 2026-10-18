import { describe, expect, it } from 'vitest';
import { libraryPlaybackSource } from '../../utils/audio/playback-source';

describe('native playback capability selection', () => {
  it('keeps the original representation when the media element supports both formats', () => {
    expect(libraryPlaybackSource('local', () => 'probably')).toBe('/api/tracks/local/play');
  });
  it('requests only the unsupported format family, independently of User-Agent', () => {
    expect(libraryPlaybackSource('local', mime => mime.includes('ogg') ? '' : 'probably')).toBe('/api/tracks/local/play?unsupported=ogg');
    expect(libraryPlaybackSource('local', mime => mime.includes('flac') ? '' : 'maybe')).toBe('/api/tracks/local/play?unsupported=flac');
    expect(libraryPlaybackSource('local', () => '')).toBe('/api/tracks/local/play?unsupported=ogg,flac');
  });
});
