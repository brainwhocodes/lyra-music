/**
 * User state composable backed by Nuxt useState.
 * Stores only non-sensitive user fields and relies on httpOnly cookies set server-side.
 * Provides helpers to fetch the current user session and to logout.
 *
 * One export per file as per project conventions.
 */
import { useState, useRequestFetch, computed, readonly } from "#imports";

export interface AppUser {
  userId: string;
  name: string;
  email: string;
}

/**
 * Returns reactive user state and helpers.
 */
export interface UseUserReturn {
  user: ReadonlyState<AppUser | null>;
  isAuthenticated: BoolState;
  userId: StringState;
  fetchUser: () => Promise<AppUser | null>;
  logout: () => Promise<void>;
  setUserData: (data: AppUser) => void;
  clearUser: () => void;
}

type ReadonlyState<T> = { readonly value: T | null };
type BoolState = { readonly value: boolean };
type StringState = { readonly value: string | null };

export const useUser: () => UseUserReturn = () => {
  // Capture Nuxt's request context synchronously. Session checks are actions,
  // not payload-cached useFetch calls created later inside event handlers.
  const request = useRequestFetch();
  const user = useState<AppUser | null>("user", (): AppUser | null => null);
  // Shared by composable callers within this Nuxt app, isolated per SSR request.
  // A login/logout or newer session check owns the state over older responses.
  const generation = useState<number>("user-session-generation", () => 0);
  const latestCheck = useState<number>("user-session-check", () => 0);
  const isAuthenticated = computed<boolean>(() => Boolean(user.value));
  const userId = computed<string | null>(() => user.value?.userId ?? null);

  /** Sets the current user state. */
  const setUserData = (data: AppUser): void => {
    generation.value++;
    user.value = data;
  };

  /** Clears the current user state. */
  const clearUser = (): void => {
    generation.value++;
    user.value = null;
  };

  /**
   * Fetches the current session user from the server using cookie-based auth.
   * Never touches cookies on the client.
   */
  const fetchUser = async (): Promise<AppUser | null> => {
    const owner = generation.value;
    const check = ++latestCheck.value;
    const current = () => owner === generation.value && check === latestCheck.value;
    try {
      const data = await request<AppUser>("/api/auth/me", { method: "POST" });
      if (!current()) return user.value;
      if (data) {
        user.value = data;
        return data;
      }
      user.value = null;
      return null;
    } catch (_e) {
      if (!current()) return user.value;
      user.value = null;
      return null;
    }
  };

  /**
   * Logs out by calling the server endpoint which clears httpOnly cookie.
   * Client state is cleared locally.
   */
  const logout = async (): Promise<void> => {
    const owner = ++generation.value;
    await $fetch("/api/auth/logout", { method: "POST" });
    if (owner === generation.value) clearUser();
  };

  return {
    user: readonly(user),
    isAuthenticated,
    userId,
    fetchUser,
    logout,
    setUserData,
    clearUser,
  };
};
