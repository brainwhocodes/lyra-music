import { describe, it, expect } from 'vitest'
import { isSingleFolder } from '~/server/utils/scanner'

describe('isSingleFolder', () => {
  it('returns true when only one audio file exists', () => {
    expect(isSingleFolder(['one.mp3'])).toBe(true)
  })

  it('returns false when multiple audio files exist', () => {
    expect(isSingleFolder(['one.mp3', 'two.mp3'])).toBe(false)
  })
})
