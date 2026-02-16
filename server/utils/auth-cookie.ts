import type { H3Event, CookieSerializeOptions } from 'h3'

export const AUTH_COOKIE_NAME = 'auth_token'
export const AUTH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 7

export const getAuthCookieOptions = (_event: H3Event): CookieSerializeOptions => {
  const isProduction = process.env.NODE_ENV === 'production'

  return {
    httpOnly: true,
    secure: isProduction,
    sameSite: 'lax',
    path: '/',
    maxAge: AUTH_COOKIE_MAX_AGE_SECONDS,
  }
}

export const getExpiredAuthCookieOptions = (event: H3Event): CookieSerializeOptions => ({
  ...getAuthCookieOptions(event),
  maxAge: 0,
  expires: new Date(0),
})
