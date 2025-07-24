import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import { PaymentError } from '../common/FallbackUI'
import { captureException } from '@sentry/react'

interface PaymentErrorBoundaryProps {
  children: ReactNode
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  onRetry?: () => void
  onUpdatePaymentMethod?: () => void
  onContactSupport?: () => void
  fallbackComponent?: ReactNode
  preserveFormData?: boolean
}

interface PaymentErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorType?:
    | 'card_declined'
    | 'insufficient_funds'
    | 'payment_failed'
    | 'connection_error'
    | 'invalid_card'
  formData?: Record<string, unknown>
}

/**
 * PaymentErrorBoundary - Specialized error boundary for payment-related components
 *
 * Features:
 * - Detects and categorizes payment-specific errors
 * - Preserves form data during errors (if enabled)
 * - Provides payment-specific recovery options
 * - Integrates with Sentry for error tracking
 */
export class PaymentErrorBoundary extends Component<
  PaymentErrorBoundaryProps,
  PaymentErrorBoundaryState
> {
  constructor(props: PaymentErrorBoundaryProps) {
    super(props)
    this.state = {
      hasError: false,
      formData: {},
    }
  }

  static getDerivedStateFromError(error: Error): Partial<PaymentErrorBoundaryState> {
    // Categorize payment errors based on error message or code
    const errorType = PaymentErrorBoundary.categorizePaymentError(error)

    return {
      hasError: true,
      error,
      errorType,
    }
  }

  static categorizePaymentError(error: Error): PaymentErrorBoundaryState['errorType'] {
    const errorMessage = error.message.toLowerCase()
    const errorCode = (error as Error & { code?: string }).code?.toLowerCase()

    // Stripe-specific error codes
    if (errorCode === 'card_declined' || errorMessage.includes('card declined')) {
      return 'card_declined'
    }

    if (errorCode === 'insufficient_funds' || errorMessage.includes('insufficient funds')) {
      return 'insufficient_funds'
    }

    if (errorCode === 'invalid_card' || errorMessage.includes('invalid card')) {
      return 'invalid_card'
    }

    // Network/connection errors
    if (
      errorMessage.includes('network') ||
      errorMessage.includes('connection') ||
      errorMessage.includes('timeout') ||
      errorCode === 'network_error'
    ) {
      return 'connection_error'
    }

    // Default to generic payment failure
    return 'payment_failed'
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to console with payment context
    console.error('PaymentErrorBoundary caught an error:', error, errorInfo)

    // Capture in Sentry with payment context
    captureException(error, {
      contexts: {
        payment: {
          errorType: this.state.errorType,
          hasFormData: Boolean(this.state.formData && Object.keys(this.state.formData).length > 0),
        },
      },
      tags: {
        component: 'PaymentErrorBoundary',
        errorType: this.state.errorType || 'unknown',
      },
    })

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }

    // Try to preserve form data if enabled
    if (this.props.preserveFormData) {
      this.preserveFormData()
    }
  }

  preserveFormData = () => {
    try {
      // Find all form elements within the error boundary
      const forms = document.querySelectorAll('form')
      const formData: Record<string, unknown> = {}

      forms.forEach((form) => {
        const data = new FormData(form)
        data.forEach((value, key) => {
          // Don't store sensitive payment data
          if (!key.includes('cvv') && !key.includes('cvc') && !key.includes('securityCode')) {
            formData[key] = value
          }
        })
      })

      // Store in state and sessionStorage for recovery
      this.setState({ formData })
      sessionStorage.setItem('paymentFormRecovery', JSON.stringify(formData))
    } catch (err) {
      console.error('Failed to preserve form data:', err)
    }
  }

  handleRetry = () => {
    // Clear error state
    this.setState({ hasError: false, error: undefined, errorType: undefined })

    // Restore form data if available
    if (this.state.formData && Object.keys(this.state.formData).length > 0) {
      // This would need to be implemented based on your form library
      console.log('Form data available for restoration:', this.state.formData)
    }

    // Call custom retry handler if provided
    if (this.props.onRetry) {
      this.props.onRetry()
    }
  }

  handleUpdatePaymentMethod = () => {
    // Clear error state
    this.setState({ hasError: false, error: undefined, errorType: undefined })

    // Call custom handler if provided
    if (this.props.onUpdatePaymentMethod) {
      this.props.onUpdatePaymentMethod()
    }
  }

  handleContactSupport = () => {
    // Prepare error details for support
    const errorDetails = {
      errorType: this.state.errorType,
      errorMessage: this.state.error?.message,
      timestamp: new Date().toISOString(),
    }

    // Store error details for support reference
    sessionStorage.setItem('paymentErrorDetails', JSON.stringify(errorDetails))

    // Call custom handler if provided
    if (this.props.onContactSupport) {
      this.props.onContactSupport()
    } else {
      // Default to opening support page
      window.location.href = '/support?type=payment-error'
    }
  }

  componentDidUpdate(prevProps: PaymentErrorBoundaryProps) {
    // Reset error state if children change (e.g., navigating to a different payment form)
    if (prevProps.children !== this.props.children && this.state.hasError) {
      this.setState({ hasError: false, error: undefined, errorType: undefined })
    }
  }

  render() {
    if (this.state.hasError && this.state.errorType) {
      // Use custom fallback if provided
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent
      }

      // Use PaymentError component with appropriate handlers
      return (
        <PaymentError
          errorType={this.state.errorType}
          onRetry={this.handleRetry}
          onUpdatePaymentMethod={this.handleUpdatePaymentMethod}
          onContactSupport={this.handleContactSupport}
          className="my-8"
          testId="payment-error-boundary-fallback"
        />
      )
    }

    return this.props.children
  }
}

// Export as default for easier imports
export default PaymentErrorBoundary
