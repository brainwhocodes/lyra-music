import { describe, expect, it } from 'vitest'
import { deriveSessionUserFromToken } from '~/server/utils/auth-session'

describe('deriveSessionUserFromToken', () => {
  it('returns a session user for a valid token payload', () => {
    const now = Math.floor(Date.now() / 1000)
    const user = deriveSessionUserFromToken('token', () => ({
      userId: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      exp: now + 600,
    }))

    expect(user).toEqual({ userId: 'u1', name: 'Ada', email: 'ada@example.com' })
  })

  it('returns null when payload is expired or invalid', () => {
    const now = Math.floor(Date.now() / 1000)
    expect(deriveSessionUserFromToken('token', () => ({
      userId: 'u1',
      name: 'Ada',
      email: 'ada@example.com',
      exp: now - 10,
    }))).toBeNull()

    expect(deriveSessionUserFromToken('token', () => null)).toBeNull()
    expect(deriveSessionUserFromToken(undefined, () => null)).toBeNull()
  })
})
