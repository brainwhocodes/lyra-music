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

  const authStore = useAuthStore();
  try {
    const headers: Record<string, string> = {}
    let token: string | null = null

    if (process.server) {
      const reqHeaders = useRequestHeaders(['cookie'])
      if (reqHeaders.cookie) {
        headers.cookie = reqHeaders.cookie
        const match = reqHeaders.cookie
          .split(';')
          .find(c => c.trim().startsWith('auth_token='))
        if (match) {
          token = decodeURIComponent(match.split('=')[1])
        }
      }
    } else {
      token = localStorage.getItem('auth_token')
    }

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    const user = await $fetch('/api/auth/me', {
      method: 'POST',
      headers,
    })

    authStore.setMinimalUserData(user, token ?? '')
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

