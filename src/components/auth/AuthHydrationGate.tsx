import React from 'react'
import { useAuthStore } from '../../store/authStore'
import Loading from '../common/Loading'

interface AuthHydrationGateProps {
  children: React.ReactNode
  /**
   * Custom fallback UI to show while hydrating
   * If not provided, will use default loading skeleton
   */
  fallback?: React.ReactNode
  /**
   * Additional CSS classes for the fallback container
   */
  fallbackClassName?: string
}

/**
 * Default loading skeleton for auth hydration
 */
function DefaultAuthSkeleton({ className }: { className?: string }) {
  return (
    <div className={`min-h-screen flex items-center justify-center bg-gray-50 ${className || ''}`}>
      <div className="flex flex-col items-center space-y-4">
        <Loading size="lg" />
        <p className="text-sm text-gray-600 animate-pulse">
          Authenticating...
        </p>
      </div>
    </div>
  )
}

/**
 * AuthHydrationGate prevents auth UI flicker by showing loading state
 * until the auth store has fully hydrated from persistent storage.
 * 
 * This solves the common problem where:
 * 1. App loads with loading: true
 * 2. Store hydrates with skipHydration: true 
 * 3. User sees brief "not authenticated" UI before auth state loads
 * 
 * Usage:
 * ```tsx
 * <AuthHydrationGate>
 *   <App />
 * </AuthHydrationGate>
 * ```
 * 
 * With custom fallback:
 * ```tsx
 * <AuthHydrationGate fallback={<CustomLoader />}>
 *   <App />
 * </AuthHydrationGate>
 * ```
 */
export function AuthHydrationGate({
  children,
  fallback,
  fallbackClassName,
}: AuthHydrationGateProps) {
  const { _hasHydrated, loading } = useAuthStore(
    // Use composed selector to prevent over-rendering
    (state) => ({
      _hasHydrated: state._hasHydrated,
      loading: state.loading,
    })
  )

  // Show loading state until store has hydrated AND initial auth check is complete
  const isHydrating = !_hasHydrated || loading

  if (isHydrating) {
    return (
      <>
        {fallback || <DefaultAuthSkeleton className={fallbackClassName} />}
      </>
    )
  }

  return <>{children}</>
}

/**
 * Hook to check if auth store has fully hydrated
 * Useful for conditional rendering based on hydration state
 */
export function useAuthHydrated() {
  return useAuthStore((state) => state._hasHydrated)
}

/**
 * Hook to check if app is ready (hydrated and not loading)
 * Combines hydration status with loading state
 */
export function useAuthReady() {
  return useAuthStore((state) => state._hasHydrated && !state.loading)
}

export default AuthHydrationGate