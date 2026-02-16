import { describe, expect, it } from 'vitest'
import { sanitizeRedirectPath } from '~/utils/redirect'

describe('sanitizeRedirectPath', () => {
  it('allows safe in-app paths', () => {
    expect(sanitizeRedirectPath('/library')).toBe('/library')
    expect(sanitizeRedirectPath('/playlists/abc')).toBe('/playlists/abc')
  })

  it('preserves query strings and hashes for whitelisted routes', () => {
    expect(sanitizeRedirectPath('/tracks?albumId=abc')).toBe('/tracks?albumId=abc')
    expect(sanitizeRedirectPath('/tracks?albumId=abc#queue')).toBe('/tracks?albumId=abc#queue')
    expect(sanitizeRedirectPath('/playlists/abc?view=compact')).toBe('/playlists/abc?view=compact')
  })

  it('rejects absolute and protocol-relative redirects', () => {
    expect(sanitizeRedirectPath('https://evil.com')).toBe('/library')
    expect(sanitizeRedirectPath('//evil.com/pwn')).toBe('/library')
  })

  it('rejects unknown or malformed paths', () => {
    expect(sanitizeRedirectPath('/admin')).toBe('/library')
    expect(sanitizeRedirectPath('/radio\\evil')).toBe('/library')
    expect(sanitizeRedirectPath(undefined)).toBe('/library')
  })
})
