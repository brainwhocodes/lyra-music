import { defineEventHandler, createError, parseCookies, getHeader } from 'h3';
import { getUserFromEvent, verifyToken } from '../utils/auth';

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
    // Method 1: Check for auth_token cookie
    const cookies = parseCookies(event);
    const cookieToken = cookies['auth_token'];
    
    // Method 2: Check for Authorization header with Bearer token
    const authHeader = getHeader(event, 'authorization');
    const bearerToken = authHeader && authHeader.startsWith('Bearer ') 
      ? authHeader.substring(7) 
      : null;
    
    // Use either cookie token or bearer token
    const authToken = cookieToken || bearerToken;
    
    if (authToken) {
      try {
        // Verify the JWT token
        const userData = verifyToken(authToken);

        if (!userData.expiresAt || Date.parse(userData.expiresAt) < Date.now()) {
          setCookie(event, 'auth_token', '', {
            httpOnly: true,
            secure: true,
            sameSite: 'strict',
            maxAge: 0
          })
          throw createError({
            statusCode: 401,
            message: 'Unauthorized: Invalid token'
          });
        }

        if (userData && userData.userId) {
          // Create a user object from the token data
          user = {
            userId: userData.userId,
            name: userData.name || '',
            email: userData.email || '',
          };
        }
      } catch (e) {
        console.error('Failed to verify auth token:', e);
      }
    }
  }
  
  // If still no user, throw unauthorized error
  if (!user) {
    createError({
      statusCode: 401,
      message: 'Unauthorized: Authentication required'
    });
    return;
  }

  // Add user to event context, mapping the enhanced user object properties
  event.context.user = { ...user };
});
