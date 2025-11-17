import { useAuthStore } from '~/stores/auth';

/**
 * Session middleware that checks if the user is authenticated via server session
 * Redirects to login page if not authenticated
 */
export default defineNuxtRouteMiddleware(async (to, event) => {
  // Skip check for public routes
  const publicRoutes: readonly string[] = ['/login', '/register', '/forgot-password', '/reset-password'];
  if (publicRoutes.includes(to.path)) {
    return;
  }

  const authStore = useAuthStore();
  
  // Try to fetch user data from server session (cookie-based)
  try {
    const user = await authStore.fetchUser();
    
    if (!user) {
      return navigateTo({
        path: '/login',
        query: { invalid: 'true' }
      });
    }
    
  } catch (error: any) {
    // Authentication failed - redirect to login
    if (error?.response?.status === 401 || error?.statusCode === 401) {
      return navigateTo({
        path: '/login',
        query: { invalid: 'true' }
      });
    }
    // For other errors, still redirect to login for safety
    return navigateTo('/login');
  }
});

