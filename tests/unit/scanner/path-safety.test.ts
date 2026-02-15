import { describe, expect, it } from 'vitest';
import { isPathInsideAllowedRoots, isPathInsideRoot } from '~/server/services/scanner/path-safety';

describe('path safety', () => {
  it('allows a path that is exactly the root or nested under it', () => {
    expect(isPathInsideRoot('/music/library', '/music/library')).toBe(true);
    expect(isPathInsideRoot('/music/library/albums', '/music/library')).toBe(true);
  });

  it('rejects prefix-only sibling paths', () => {
    expect(isPathInsideRoot('/music/library-archive', '/music/library')).toBe(false);
  });

  it('checks against multiple allowed roots', () => {
    expect(isPathInsideAllowedRoots('/data/allowed/a', ['/other', '/data/allowed'])).toBe(true);
    expect(isPathInsideAllowedRoots('/data/disallowed', ['/other', '/data/allowed'])).toBe(false);
  });
});
