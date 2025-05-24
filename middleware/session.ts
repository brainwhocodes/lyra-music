import { defineNuxtRouteMiddleware, useCookie, navigateTo, useNuxtApp } from '#app';
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
export default defineNuxtRouteMiddleware(async (to) => {
  // Skip check for public routes
  const publicRoutes: readonly string[] = ['/login', '/register', '/forgot-password', '/reset-password'];
  if (publicRoutes.includes(to.path)) {
    return;
  }

  const authCookie = useCookie<string | null>('auth_token');
  const authStore = useAuthStore();
  // If no auth token exists, redirect to login
  if (!authCookie.value) {
    // Clear any remaining auth state
    authStore.clearState();
    return navigateTo({
      path: '/login',
      query: { authRequired: 'true' }
    });
  }
  
  try {
        
    const user = await $fetch('/api/auth/me', {
      headers: {
        Authorization: `Bearer ${authCookie.value}`
      }
    })

    authStore.setMinimalUserData(user);
    
    // Token is valid, continue to the requested route
    return;
  } catch (error) {
    // Token is invalid or malformed
    console.error('Invalid token:', error);
    
    // Clear the invalid token and auth state
    authCookie.value = null;
    authStore.clearState();
    
    // Redirect to login with invalid session message
    return navigateTo({
      path: '/login',
      query: { invalid: 'true' }
    });
  }
});