/**
 * Auth-related hooks extracted from AuthHydrationGate for React Refresh compatibility
 */
import { useAuthStore } from '../../store/authStore'

/**
 * Hook to check if auth store has fully hydrated
 * Useful for conditional rendering based on hydration state
 */
export function useAuthHydrated(): boolean {
  return useAuthStore((state) => state._hasHydrated)
}

/**
 * Hook to check if app is ready (hydrated and not loading)
 * Combines hydration status with loading state
 */
export function useAuthReady(): boolean {
  return useAuthStore((state) => state._hasHydrated && !state.loading)
}