import { defineEventHandler, createError, parseCookies, getHeader, setCookie } from 'h3';
import { getUserFromEvent, verifyToken } from '../utils/auth';
import { AUTH_COOKIE_NAME, getExpiredAuthCookieOptions } from '~/server/utils/auth-cookie';
import { deriveSessionUserFromToken } from '~/server/utils/auth-session';

// Authentication middleware
export default defineEventHandler(async (event) => {
  // Skip authentication for public routes
  const path = event.path || '';

  // Public paths that should not require authentication
  const publicPaths = ['/api/auth', '/api/health'];
  const publicPages = ['/login', '/register'];

  // Skip auth check for non-API routes and explicitly allowed public paths
  if (!path.startsWith('/api') || publicPaths.some(p => path.startsWith(p)) || publicPages.some(p => path === p)) {
    return;
  }

  // Check if user is authenticated
  let user = await getUserFromEvent(event);

  // If no user is found in the event, try multiple auth methods
  if (!user) {
    const cookies = parseCookies(event);
    const cookieToken = cookies[AUTH_COOKIE_NAME];

    const authHeader = getHeader(event, 'authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ')
      ? authHeader.substring(7)
      : null;

    user = deriveSessionUserFromToken(cookieToken || bearerToken, verifyToken);

    if (!user && cookieToken) {
      setCookie(event, AUTH_COOKIE_NAME, '', getExpiredAuthCookieOptions(event));
    }
  }

  // If still no user, throw unauthorized error
  if (!user) {
    throw createError({
      statusCode: 401,
      message: 'Unauthorized: Authentication required'
    });
  }

  // Add user to event context, mapping the enhanced user object properties
  event.context.user = { ...user };
});
