import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import ErrorBoundary from '../common/ErrorBoundary'
import { UnauthorizedError } from '../common/FallbackUI'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: 'supplier' | 'buyer' | 'admin'
  allowUnauthenticated?: boolean
}

/**
 * Authentication-aware error boundary fallback for protected routes
 */
function AuthErrorFallback() {
  return (
    <UnauthorizedError onGoHome={() => (window.location.href = '/')} className="min-h-screen" />
  )
}

/**
 * Protected route component with integrated error boundary
 * Handles authentication, authorization, and error protection
 */
export function ProtectedRoute({
  children,
  requiredRole,
  allowUnauthenticated = false,
}: ProtectedRouteProps) {
  const { user, userType, loading } = useAuthStore()

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  // Handle unauthenticated users
  if (!user && !allowUnauthenticated) {
    return <Navigate to="/login" replace />
  }

  // Handle role-based authorization
  if (requiredRole && userType !== requiredRole) {
    // If user is authenticated but lacks required role, show unauthorized error
    if (user) {
      return <AuthErrorFallback />
    }
    // If user is not authenticated, redirect to login
    return <Navigate to="/login" replace />
  }

  // Wrap authenticated content with error boundary
  return (
    <ErrorBoundary
      context={`ProtectedRoute - ${requiredRole || 'authenticated'}`}
      fallback={<AuthErrorFallback />}
      onError={(error, errorInfo) => {
        // Log authentication-related errors with context
        console.error('Authentication error boundary triggered:', {
          error: error.message,
          user: user?.id,
          userType,
          requiredRole,
          componentStack: errorInfo.componentStack,
        })
      }}
    >
      {children}
    </ErrorBoundary>
  )
}

export default ProtectedRoute
