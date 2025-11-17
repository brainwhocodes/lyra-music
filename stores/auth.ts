import { defineStore } from 'pinia';
import { useFetch, navigateTo, useRouter } from '#imports';
import type { User } from '~/types/user';

// Define a type for the auth store user (matches server response)
interface AuthUser {
  userId: string;
  name: string;
  email: string;
}

export const useAuthStore = defineStore('auth', () => {
  // State: holds user data
  const user = ref<AuthUser | null>(null);

  // getters
  const isAuthenticated = computed(() => !!user.value);
  const userId = computed(() => user.value?.userId || null);

  // actions
  async function fetchUser(): Promise<AuthUser | null> {
    const router = useRouter();

    try {
      // Use useFetch to get user data from server session (cookie-based)
      const { data: responseData, error } = await useFetch<AuthUser>('/api/auth/me', {
        method: 'POST',
        retry: 1,
        onResponseError({ response: { status } }: any) {
          // Handle 401 errors specifically
          if (status === 401) {
            // Clear state on auth errors
            user.value = null;
          }
        }
      });
      
      if (error.value || !responseData.value) {
        user.value = null;
        // Only redirect to login if not already there and not on home page
        if (router.currentRoute.value?.path !== '/login' && router.currentRoute.value?.path !== '/') {
          await navigateTo('/login');
        }
        return null;
      }

      user.value = responseData.value;
      return responseData.value;
    } catch (error: any) {
      user.value = null;
      // Only redirect to login if not already there
      if (router.currentRoute.value?.path !== '/login') {
        await navigateTo('/login');
      }
      return null;
    }
  }

  async function logout(): Promise<void> {
    // Clear local state first
    user.value = null;

    // Call the backend logout endpoint to clear server-side session
    try {
      await $fetch('/api/auth/logout', { method: 'POST' });
      
      // Redirect to login page after successful logout
      await navigateTo({
        path: '/login',
        query: { loggedOut: 'true' }
      });
    } catch (error) {
      // Still redirect even if there's an error
      await navigateTo('/login');
    }
  }

  /**
   * Clears all authentication state
   */
  function clearState(): void {
    user.value = null;
  }

  /**
   * Sets user data from successful authentication
   */
  function setUserData(userData: AuthUser): void {
    user.value = userData;
  }

  return { 
    user: readonly(user),
    userId,
    isAuthenticated,
    fetchUser,
    logout,
    clearState,
    setUserData
  };
});
