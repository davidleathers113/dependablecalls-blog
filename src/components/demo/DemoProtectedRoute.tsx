/**
 * Demo Protected Route Component
 * 
 * Similar to ProtectedRoute but allows access in demo mode.
 * Provides a secure way to showcase platform features without
 * requiring authentication.
 * 
 * Security: Only allows read-only demo data access.
 */

import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../../store/authStore'
import { ErrorBoundary as CustomErrorBoundary } from '../common/ErrorBoundary'
import { UnauthorizedError } from '../common/FallbackUI'
import { captureError } from '../../lib/monitoring'

interface DemoProtectedRouteProps {
  children: React.ReactNode
  /** Minimum user type required (defaults to any authenticated user) */
  requiredUserType?: 'supplier' | 'buyer' | 'admin' | 'network'
  /** Redirect path if unauthorized (defaults to login) */
  redirectTo?: string
}

function DemoProtectedRoute({ 
  children, 
  requiredUserType,
  redirectTo = '/login' 
}: DemoProtectedRouteProps) {
  const { 
    user, 
    loading, 
    isDemoMode, 
    demoUserType, 
    userType,
    isAuthenticated 
  } = useAuthStore()

  // Show loading state while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 border-4 border-primary-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  // Check if user is authenticated OR in demo mode
  const hasAccess = isAuthenticated || isDemoMode
  
  if (!hasAccess) {
    return <Navigate to={redirectTo} replace />
  }

  // Check user type requirements
  const currentUserType = isDemoMode ? demoUserType : userType
  
  if (requiredUserType && currentUserType !== requiredUserType) {
    // If user doesn't have required type, redirect to their appropriate dashboard
    const dashboardPath = isDemoMode ? `/demo/${currentUserType}` : '/app/dashboard'
    return <Navigate to={dashboardPath} replace />
  }

  // Render children with error boundary
  return (
    <CustomErrorBoundary
      context={isDemoMode ? "DemoProtectedRoute" : "ProtectedRoute - Authentication"}
      fallback={<UnauthorizedError onGoHome={() => (window.location.href = '/')} />}
      onError={(error, errorInfo) => {
        // Log authentication-related errors
        captureError(error, {
          errorBoundary: isDemoMode ? 'demo-protected-route' : 'protected-route',
          componentStack: errorInfo.componentStack,
          context: isDemoMode ? 'demo-authentication' : 'authentication',
          user: user?.id || 'demo-user',
          isDemoMode,
          userType: currentUserType || 'unknown',
        })
      }}
    >
      {children}
    </CustomErrorBoundary>
  )
}

export default DemoProtectedRoute