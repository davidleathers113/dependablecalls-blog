import { useState, useCallback } from 'react'

interface UseLoadingStateResult {
  loading: boolean
  error: string | null
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
  withLoading: <T>(fn: () => Promise<T>) => Promise<T | null>
}

/**
 * Hook for managing loading and error states
 * Provides utilities for async operations
 */
export function useLoadingState(): UseLoadingStateResult {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const clearError = useCallback(() => setError(null), [])

  const withLoading = useCallback(async <T>(fn: () => Promise<T>): Promise<T | null> => {
    try {
      setLoading(true)
      setError(null)
      const result = await fn()
      return result
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    loading,
    error,
    setLoading,
    setError,
    clearError,
    withLoading,
  }
}
