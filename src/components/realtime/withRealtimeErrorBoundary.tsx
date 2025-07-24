import { RealtimeErrorBoundary } from './RealtimeErrorBoundary'
import type { ComponentType } from 'react'

interface RealtimeErrorBoundaryOptions {
  onReconnect?: () => void
  onFallbackToPolling?: () => void
  onRefresh?: () => void
  featureName?: string
  enableAutoReconnect?: boolean
  maxReconnectAttempts?: number
  reconnectDelay?: number
}

/**
 * Higher-order component that wraps a real-time component with RealtimeErrorBoundary
 */
export function withRealtimeErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: RealtimeErrorBoundaryOptions
) {
  return (props: P) => (
    <RealtimeErrorBoundary {...options}>
      <Component {...props} />
    </RealtimeErrorBoundary>
  )
}
