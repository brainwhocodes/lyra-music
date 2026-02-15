import { describe, expect, it } from 'vitest'
import { sanitizeRedirectPath } from '~/utils/redirect'

describe('sanitizeRedirectPath', () => {
  it('allows safe in-app paths', () => {
    expect(sanitizeRedirectPath('/library')).toBe('/library')
    expect(sanitizeRedirectPath('/playlists/abc')).toBe('/playlists/abc')
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
