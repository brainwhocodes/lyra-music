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

  const authCookie = useCookie('auth_token');
  const authStore = useAuthStore();
  try {
        
    const user = await $fetch('/api/auth/me', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${authCookie}`
      }
    })

    authStore.setMinimalUserData(user, authCookie);
    console.log(user)
    if ((user as any).status === 'success') {
      return;
    } else {
      authStore.clearState();
      return navigateTo({
        path: '/login',
        query: { invalid: 'true' }
      });
    }
    
  } catch (error) {
    console.error('Failed to verify auth token:', error);
    authStore.clearState();
    return navigateTo({
      path: '/login',
      query: { invalid: 'true' }
    });
  }
});