import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { useGenreImage } from '../../composables/useGenreImage';
import map from '../../utils/genre-image-map.json';

describe('genre artwork routing', () => {
  const { getGenreImageUrl } = useGenreImage();
  it('normalizes embedded music tags and selects a known family from compound tags', () => {
    expect(getGenreImageUrl('  HIP-HOP  ')).toBe(map['hip hop']);
    expect(getGenreImageUrl('Future   Funk')).toBe(map['future funk']);
    expect(getGenreImageUrl('unknown; Vaporwave')).toBe(map.vaporwave);
    expect(getGenreImageUrl('J－POP')).toBe(map['j pop']);
  });
  it('keeps unknown and prototype names on the generic music illustration', () => {
    for (const genre of [null, undefined, '', 'toString', '__proto__', 'Popcorn', 'Rocky Mountain']) {
      expect(getGenreImageUrl(genre)).toBe(map.default);
    }
  });
  it('ships every mapped artwork locally', () => {
    const assets = new Set(Object.values(map));
    expect(assets.size).toBe(7);
    for (const asset of assets) {
      expect(asset).toMatch(/^\/images\/genres\/[a-z-]+-genre-art\.webp$/);
      expect(existsSync(`public${asset}`), asset).toBe(true);
    }
  });
});
