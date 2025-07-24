import { PaymentErrorBoundary } from './PaymentErrorBoundary'
import type { ComponentType } from 'react'

interface PaymentErrorBoundaryOptions {
  onRetry?: () => void
  onUpdatePaymentMethod?: () => void
  onContactSupport?: () => void
  preserveFormData?: boolean
}

/**
 * Higher-order component that wraps a component with PaymentErrorBoundary
 */
export function withPaymentErrorBoundary<P extends object>(
  Component: ComponentType<P>,
  options?: PaymentErrorBoundaryOptions
) {
  return (props: P) => (
    <PaymentErrorBoundary {...options}>
      <Component {...props} />
    </PaymentErrorBoundary>
  )
}
