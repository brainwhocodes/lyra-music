import { useAuthStore } from '~/stores/auth';

interface TokenPayload {
  id: string;
  email?: string;
  role?: string;
  name?: string;
  exp?: number;
  iat?: number;
}

/**
 * Session middleware that checks if the auth token is valid and not expired
 * Redirects to login page and clears the token if it's expired
 */
export default defineNuxtRouteMiddleware(async (to, event) => {
  // Skip check for public routes
  const publicRoutes: readonly string[] = ['/login', '/register', '/forgot-password', '/reset-password'];
  if (publicRoutes.includes(to.path)) {
    return;
  }

  const authCookie = useCookie<string | null>('auth_token');
  const authStore = useAuthStore();
  try {
        
    const user = await $fetch('/api/auth/me', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authCookie.value ?? ''}`
      }
    })

    authStore.setMinimalUserData(user, authCookie.value ?? '')
    return
    
  } catch (error: any) {
    console.error('Failed to verify auth token:', error);
    authStore.clearState();
    if (error?.response?.status === 401 || error?.statusCode === 401) {
      return navigateTo({
        path: '/login',
        query: { invalid: 'true' }
      });
    }
    throw error;
  }
});

