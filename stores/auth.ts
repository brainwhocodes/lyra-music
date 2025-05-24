import { ref, computed, watch } from 'vue';
import { defineStore } from 'pinia';
import { useCookie, useFetch, navigateTo, useRouter } from '#imports';

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
  // Use cookie for persistence - stores the FullUserData
  const userCookie = useCookie<string | null>('user-data', { // Store as string
    maxAge: 60 * 60 * 24 * 7, // 7 days
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production'
  });
  
  // State: holds user data without ID
  const user = ref<User | null>(null);
  // State: holds only the ID, primarily for internal use if needed
  const userId = ref<string | null>(null);
  
  // Initialize state from cookie if available
  if (userCookie.value) {
    try {
      // Make sure we're parsing a string, not an object
      const cookieValue = typeof userCookie.value === 'string' 
        ? userCookie.value 
        : JSON.stringify(userCookie.value);
      
      const fullUserData: FullUserData = JSON.parse(cookieValue);
      userId.value = fullUserData.id;
      const { id, ...userWithoutId } = fullUserData;
      user.value = userWithoutId; 
    } catch (e) {
      console.error('Failed to parse user cookie:', e);
      userCookie.value = null; // Clear corrupted cookie
      user.value = null;
      userId.value = null;
    }
  }
  
  // Watch for changes to user state and update cookie with the full user data
  // This requires having the ID available, e.g., from the userId ref
  watch(user, (newUserState) => {
    if (newUserState && userId.value) {
      const fullUserData: FullUserData = {
        id: userId.value,
        ...newUserState
      };
      try {
        userCookie.value = JSON.stringify(fullUserData);
      } catch (e) {
        console.error('Failed to stringify user data for cookie:', e);
      }
    } else {
      // If user logs out (newUserState is null), clear the cookie
      userCookie.value = null;
      userId.value = null; // Also clear the stored ID
    }
  }, { deep: true });

  // getters
  const isAuthenticated = computed(() => !!user.value);

  // actions
  async function fetchUser() {
    const router = useRouter();
    const token = useCookie('auth_token').value; // Get token from the cookie ref

    try {
      // Check if cookie exists AND current path is not /login before redirecting
      if (!userCookie.value && router.currentRoute.value?.path !== '/login') {
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
        onResponseError({ response }) {
          // Handle 401 errors specifically
          if (response.status === 401) {
            console.error('Session expired or invalid');
            // Clear state and cookies on auth errors
            user.value = null;
            userId.value = null;
            userCookie.value = null;
          }
        }
      });
      
      if (error.value || !responseData.value) {
        console.error('Error fetching user:', error.value || 'No data returned');
        user.value = null;
        userId.value = null;
        userCookie.value = null; // Clear cookie on fetch error
        return;
      }

      const fullUserData = responseData.value;
      console.log('User data fetched:', fullUserData);
      
      // Store the ID separately
      userId.value = fullUserData.id;
      
      // Store user data without ID in the Pinia state
      const { id, ...userWithoutId } = fullUserData;
      user.value = userWithoutId;
      
      // The watcher will automatically update the cookie with the fullUserData
      return fullUserData;
    } catch (error: any) {
      console.error('Error fetching user:', error);
      user.value = null;
      userId.value = null;
      userCookie.value = null;
      if (router.currentRoute.value?.path !== '/login') {
        await navigateTo('/login');
      }
    }
  }

  async function logout() {
    // Clear local state
    user.value = null;
    userId.value = null;
    // Watcher will clear the user-data cookie

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
    userCookie.value = null;
  }

  /**
   * Sets minimal user data from token to avoid unnecessary redirects
   */
  function setMinimalUserData(userData: any) {
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
