import type { User } from '~/types/user'

export interface SessionUser {
  userId: string
  name: string
  email: string
}

export const deriveSessionUserFromToken = (token: string | null | undefined, verifier: (token: string) => User | null): SessionUser | null => {
  if (!token) {
    return null
  }

  const decoded = verifier(token)
  if (!decoded?.userId || !decoded?.email || !decoded?.name) {
    return null
  }

  if (decoded.exp && Date.now() / 1000 > decoded.exp) {
    return null
  }

  return {
    userId: decoded.userId,
    name: decoded.name,
    email: decoded.email,
  }
}
