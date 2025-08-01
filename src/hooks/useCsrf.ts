/**
 * React Hook for CSRF Protection
 * 
 * Provides CSRF tokens to components and handles token lifecycle
 * in coordination with React Hook Form and Supabase Auth.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { 
  createCsrfToken, 
  getCsrfTokenFromCookie, 
  addCsrfHeader,
  withCsrfToken 
} from '../lib/csrf'
import { onAuthStateChange } from '../lib/supabase-optimized'
import type { AuthChangeEvent } from '@supabase/supabase-js'

interface UseCsrfReturn {
  csrfToken: string | null
  refreshToken: () => Promise<void>
  addCsrfToHeaders: (headers?: HeadersInit) => HeadersInit
  withCsrfData: <T extends Record<string, unknown>>(data: T) => T & { csrfToken: string }
  loading: boolean
  error: string | null
}

/**
 * Hook for managing CSRF tokens in React components
 */
export function useCsrf(): UseCsrfReturn {
  const [csrfToken, setCsrfToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { user } = useAuthStore()

  // Initialize or refresh CSRF token
  const refreshToken = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Try to get existing token from cookie first
      const existingToken = getCsrfTokenFromCookie()
      if (existingToken) {
        setCsrfToken(existingToken)
        return
      }
      
      // Create new token
      const newToken = await createCsrfToken()
      setCsrfToken(newToken)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to create CSRF token'
      setError(message)
      console.error('CSRF token error:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  // Add CSRF header to request headers
  const addCsrfToHeaders = useCallback((headers?: HeadersInit): HeadersInit => {
    return addCsrfHeader(headers)
  }, [])

  // Wrap form data with CSRF token
  const withCsrfData = useCallback(<T extends Record<string, unknown>>(data: T): T & { csrfToken: string } => {
    if (!csrfToken) {
      throw new Error('CSRF token not available')
    }
    return withCsrfToken(data)
  }, [csrfToken])

  // Initialize token on mount and when user changes
  useEffect(() => {
    refreshToken()
  }, [refreshToken, user?.id])

  // Refresh token periodically (30 minutes)
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      refreshToken()
    }, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [refreshToken, user])

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = onAuthStateChange(
      async (event: AuthChangeEvent) => {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          await refreshToken()
        } else if (event === 'SIGNED_OUT') {
          setCsrfToken(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [refreshToken])

  return {
    csrfToken,
    refreshToken,
    addCsrfToHeaders,
    withCsrfData,
    loading,
    error
  }
}

/**
 * Hook for forms that automatically includes CSRF token
 */
export function useCsrfForm<T extends Record<string, unknown>>() {
  const { csrfToken, loading: csrfLoading, error: csrfError } = useCsrf()

  const submitWithCsrf = useCallback(
    (onSubmit: (data: T & { csrfToken: string }) => Promise<void> | void) => {
      return async (data: T) => {
        if (!csrfToken) {
          throw new Error('CSRF token not available')
        }

        const dataWithCsrf = { ...data, csrfToken }
        await onSubmit(dataWithCsrf)
      }
    },
    [csrfToken]
  )

  return {
    csrfToken,
    csrfLoading,
    csrfError,
    submitWithCsrf
  }
}

/**
 * Higher-order component that provides CSRF protection
 */
export function withCsrfProtection<P extends object>(
  Component: React.ComponentType<P & { csrfToken: string | null }>
): React.ComponentType<P> {
  return function WithCsrfProtection(props: P) {
    const { csrfToken } = useCsrf()
    return React.createElement(Component, { ...props, csrfToken })
  }
}