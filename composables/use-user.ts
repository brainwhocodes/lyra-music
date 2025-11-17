/**
 * User state composable backed by Nuxt useState.
 * Stores only non-sensitive user fields and relies on httpOnly cookies set server-side.
 * Provides helpers to fetch the current user session and to logout.
 *
 * One export per file as per project conventions.
 */
import { useState, useFetch, computed, readonly } from '#imports'
import type { User } from '~/types/user'

export interface AppUser {
  userId: string
  name: string
  email: string
}

/**
 * Returns reactive user state and helpers.
 */
export interface UseUserReturn {
  user: ReadonlyState<AppUser | null>
  isAuthenticated: BoolState
  userId: StringState
  fetchUser: () => Promise<AppUser | null>
  logout: () => Promise<void>
  setUserData: (data: AppUser) => void
  clearUser: () => void
}

type ReadonlyState<T> = { readonly value: T | null }
type BoolState = { readonly value: boolean }
type StringState = { readonly value: string | null }

export const useUser: () => UseUserReturn = () => {
  const user = useState<AppUser | null>('user', (): AppUser | null => null)
  const isAuthenticated = computed<boolean>(() => Boolean(user.value))
  const userId = computed<string | null>(() => user.value?.userId ?? null)

  /** Sets the current user state. */
  const setUserData = (data: AppUser): void => {
    user.value = data
  }

  /** Clears the current user state. */
  const clearUser = (): void => {
    user.value = null
  }

  /**
   * Fetches the current session user from the server using cookie-based auth.
   * Never touches cookies on the client.
   */
  const fetchUser = async (): Promise<AppUser | null> => {
    try {
      const { data } = await useFetch<AppUser>('/api/auth/me', { method: 'POST' })
      if (data.value) {
        user.value = data.value
        return data.value
      }
      user.value = null
      return null
    } catch (_e) {
      user.value = null
      return null
    }
  }

  /**
   * Logs out by calling the server endpoint which clears httpOnly cookie.
   * Client state is cleared locally.
   */
  const logout = async (): Promise<void> => {
    clearUser()
    try {
      await $fetch('/api/auth/logout', { method: 'POST' })
    } catch (_e) {
      // ignore errors; cookie clearing is server-side
    }
  }

  return {
    user: readonly(user),
    isAuthenticated,
    userId,
    fetchUser,
    logout,
    setUserData,
    clearUser,
  }
}
