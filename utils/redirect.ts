const SAFE_REDIRECT_PATH = '/library'

const ALLOWED_REDIRECT_PREFIXES = ['/library', '/albums', '/artists', '/genres', '/playlists', '/discovery', '/radio', '/podcasts', '/settings', '/tracks']

export const sanitizeRedirectPath = (rawRedirect: string | null | undefined): string => {
  if (!rawRedirect) {
    return SAFE_REDIRECT_PATH
  }

  if (!rawRedirect.startsWith('/') || rawRedirect.startsWith('//')) {
    return SAFE_REDIRECT_PATH
  }

  if (rawRedirect.includes('\\')) {
    return SAFE_REDIRECT_PATH
  }

  return ALLOWED_REDIRECT_PREFIXES.some((prefix) => rawRedirect === prefix || rawRedirect.startsWith(`${prefix}/`))
    ? rawRedirect
    : SAFE_REDIRECT_PATH
}

