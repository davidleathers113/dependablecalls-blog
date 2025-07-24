import { ProtectedRoute } from './ProtectedRoute'
import type { ComponentType } from 'react'

interface ProtectedRouteOptions {
  requiredRole?: 'supplier' | 'buyer' | 'admin'
  allowUnauthenticated?: boolean
}

/**
 * Higher-order component for protecting components with authentication and error boundaries
 */
export function withProtectedRoute<P extends object>(
  Component: ComponentType<P>,
  options?: ProtectedRouteOptions
) {
  const WrappedComponent = (props: P) => (
    <ProtectedRoute
      requiredRole={options?.requiredRole}
      allowUnauthenticated={options?.allowUnauthenticated}
    >
      <Component {...props} />
    </ProtectedRoute>
  )

  WrappedComponent.displayName = `withProtectedRoute(${Component.displayName || Component.name})`

  return WrappedComponent
}
