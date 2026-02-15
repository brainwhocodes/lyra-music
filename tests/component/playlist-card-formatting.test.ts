import { describe, expect, it } from 'vitest'
import { formatPlaylistTrackCount } from '~/components/playlist/playlist-card.utils'

describe('playlist-card formatting', () => {
  it('formats track counts deterministically', () => {
    expect(formatPlaylistTrackCount(undefined)).toBe('0 tracks')
    expect(formatPlaylistTrackCount(1)).toBe('1 track')
    expect(formatPlaylistTrackCount(42)).toBe('42 tracks')
  })
})
