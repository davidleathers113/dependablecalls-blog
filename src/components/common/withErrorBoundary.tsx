import React from 'react'
import type { ReactNode, ErrorInfo } from 'react'
import { ErrorBoundary } from './ErrorBoundary'
import type { ErrorFallbackProps } from './ErrorBoundary'

// Higher-Order Component for wrapping components with ErrorBoundary
export interface WithErrorBoundaryOptions {
  level?: 'page' | 'section' | 'component'
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  fallback?: ReactNode | React.ComponentType<ErrorFallbackProps>
  context?: string
  showTechnicalDetails?: boolean
}

export function withErrorBoundary<T extends Record<string, unknown>>(
  Component: React.ComponentType<T>,
  options: WithErrorBoundaryOptions = {}
): React.ComponentType<T> {
  const WrappedComponent = (props: T) => (
    <ErrorBoundary
      level={options.level || 'component'}
      onError={options.onError}
      fallback={options.fallback}
      context={options.context || Component.displayName || Component.name}
      showTechnicalDetails={options.showTechnicalDetails}
    >
      <Component {...props} />
    </ErrorBoundary>
  )

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}
