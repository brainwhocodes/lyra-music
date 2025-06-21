import { defineStore } from 'pinia';
import { useFetch, navigateTo, useRouter } from '#imports';

// Define the type for our user object in the store (without ID)
interface User {
  name: string;
  email: string;
  role: string;
}

// Define a type for the full user data including ID (for cookie)
interface FullUserData extends User {
  id: string;
}

export const useAuthStore = defineStore('auth', () => {
  // State: holds user data without ID
  const user = ref<User | null>(null);
  // State: holds only the ID, primarily for internal use if needed
  const userId = ref<string | null>(null);
  // Watch for changes to user state and update localStorage with the full user data
  // This requires having the ID available, e.g., from the userId ref
  watch(user, (newUserState: User | null) => {
    if (newUserState && userId.value) {
      const fullUserData: FullUserData = {
        id: userId.value,
        ...newUserState
      };
      try {
        localStorage.setItem('auth_token', JSON.stringify(fullUserData));
      } catch (e) {
        console.error('Failed to stringify user data for localStorage:', e);
      }
    } else {
      // If user logs out (newUserState is null), clear the localStorage
      localStorage.removeItem('auth_token');
      userId.value = null; // Also clear the stored ID
    }
  }, { deep: true });

  // getters
  const isAuthenticated = computed(() => !!user.value);

  // actions
  async function fetchUser() {
    const router = useRouter();
    const token = localStorage.getItem('auth_token'); // Get token from localStorage

    try {
      // Check if token exists AND current path is not /login before redirecting
      if (!token && router.currentRoute.value?.path !== '/login') {
        if (router.currentRoute.value?.path == '/') {
          return;
        }
        await navigateTo('/login');
        return;
      }
      // Use useFetch to get full response details including potential errors
      const { data: responseData, error } = await useFetch<FullUserData>('/api/auth/me', {
        retry: 1,  // Only retry once
        headers: token ? { Authorization: `Bearer ${token}` } : {}, // Add Auth header
        onResponseError({ response: { status } }: any) {
          // Handle 401 errors specifically
          if (status === 401) {
            console.error('Session expired or invalid');
            // Clear state and localStorage on auth errors
            user.value = null;
            userId.value = null;
            localStorage.removeItem('auth_token');
          }
        }
      });
      
      if (error.value || !responseData.value) {
        console.error('Error fetching user:', error.value || 'No data returned');
        user.value = null;
        userId.value = null;
        localStorage.removeItem('auth_token'); // Clear token on fetch error
        return;
      }

      const fullUserData = responseData.value;
      console.log('User data fetched:', fullUserData);
      
      // Store the ID separately
      userId.value = fullUserData.id;
      
      // Store user data without ID in the Pinia state
      const { id, ...userWithoutId } = fullUserData;
      user.value = userWithoutId;
      
      // The watcher will automatically update localStorage with the fullUserData
      return fullUserData;
    } catch (error: any) {
      console.error('Error fetching user:', error);
      user.value = null;
      userId.value = null;
      localStorage.removeItem('auth_token');
      if (router.currentRoute.value?.path !== '/login') {
        await navigateTo('/login');
      }
    }
  }

  async function logout() {
    // Clear local state
    user.value = null;
    userId.value = null;
    // Watcher will clear the auth_token from localStorage

    // Call the backend logout endpoint (important!)
    try {
      await $fetch('/api/auth/logout', { method: 'POST' });
      
      // Show success toast notification
      
      // Redirect to login page after successful logout with success message
      navigateTo({
        path: '/login',
        query: { loggedOut: 'true' }
      });
    } catch (error) {
      console.error('Error during backend logout:', error);      
      // Still redirect even if there's an error
      navigateTo('/login');
    }
  }

  /**
   * Clears all authentication state
   */
  function clearState() {
    user.value = null;
    userId.value = null;
    localStorage.removeItem('auth_token');
  }

  /**
   * Sets minimal user data from token to avoid unnecessary redirects
   */
  function setMinimalUserData(userData: any, token: string) {
    localStorage.setItem('auth_token', token);
    user.value = userData;
  }

  return { 
    user,
    userId, // Expose userId if needed elsewhere
    isAuthenticated,
    fetchUser,
    logout,
    clearState,
    setMinimalUserData
  };
});
