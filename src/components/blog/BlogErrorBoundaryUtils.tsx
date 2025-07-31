import React, { type ReactNode } from 'react'
import { BlogErrorBoundary } from './BlogErrorBoundary'

/**
 * HOC wrapper for blog components that need error boundary protection
 */
export function withBlogErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  fallback?: ReactNode
) {
  const WrappedComponent = (props: P) => (
    <BlogErrorBoundary fallback={fallback}>
      <Component {...props} />
    </BlogErrorBoundary>
  )

  WrappedComponent.displayName = `withBlogErrorBoundary(${Component.displayName || Component.name})`
  
  return WrappedComponent
}