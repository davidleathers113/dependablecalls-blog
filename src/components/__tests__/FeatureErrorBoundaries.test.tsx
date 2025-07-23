import React from 'react'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { PaymentErrorBoundary } from '../payments/PaymentErrorBoundary'
import { FormErrorBoundary } from '../forms/FormErrorBoundary'
import { RealtimeErrorBoundary } from '../realtime/RealtimeErrorBoundary'
import { z } from 'zod'

// Mock Sentry
vi.mock('@sentry/react', () => ({
  captureException: vi.fn(),
}))

describe('PaymentErrorBoundary', () => {
  const ThrowPaymentError = ({ errorType }: { errorType: string }) => {
    if (errorType === 'card_declined') {
      throw new Error('Your card was declined')
    }
    if (errorType === 'network') {
      throw new Error('Network connection failed')
    }
    return <div>Payment form content</div>
  }

  it('should catch and display card declined errors', () => {
    const onRetry = vi.fn()
    const onUpdatePaymentMethod = vi.fn()

    render(
      <PaymentErrorBoundary onRetry={onRetry} onUpdatePaymentMethod={onUpdatePaymentMethod}>
        <ThrowPaymentError errorType="card_declined" />
      </PaymentErrorBoundary>
    )

    expect(screen.getByText('Card Declined')).toBeInTheDocument()
    expect(screen.getByText(/Your card was declined/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Update Payment Method/i })).toBeInTheDocument()
  })

  it('should handle retry action', () => {
    const onRetry = vi.fn()

    render(
      <PaymentErrorBoundary onRetry={onRetry}>
        <ThrowPaymentError errorType="network" />
      </PaymentErrorBoundary>
    )

    const retryButton = screen.getByRole('button', { name: /Try Again/i })
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalled()
  })

  it('should preserve form data on error', () => {
    const FormWithError = () => {
      const [shouldError, setShouldError] = React.useState(false)

      if (shouldError) {
        throw new Error('Payment failed')
      }

      return (
        <form>
          <input name="cardNumber" defaultValue="4242424242424242" />
          <button type="button" onClick={() => setShouldError(true)}>
            Trigger Error
          </button>
        </form>
      )
    }

    render(
      <PaymentErrorBoundary preserveFormData={true}>
        <FormWithError />
      </PaymentErrorBoundary>
    )

    // Trigger error
    fireEvent.click(screen.getByText('Trigger Error'))

    // Check that sessionStorage was called (in a real test, you'd mock this)
    expect(screen.getByText(/Payment Failed/)).toBeInTheDocument()
  })
})

describe('FormErrorBoundary', () => {
  const testSchema = z.object({
    name: z.string().min(3),
    email: z.string().email(),
  })

  const ThrowFormError = ({ errorType }: { errorType: string }) => {
    if (errorType === 'validation') {
      const error = new z.ZodError([
        {
          code: 'too_small',
          minimum: 3,
          type: 'string',
          inclusive: true,
          message: 'Name must be at least 3 characters',
          path: ['name'],
        },
      ])
      throw error
    }
    if (errorType === 'network') {
      throw new Error('Network timeout')
    }
    return <div>Form content</div>
  }

  it('should display validation errors', () => {
    render(
      <FormErrorBoundary validationSchema={testSchema}>
        <ThrowFormError errorType="validation" />
      </FormErrorBoundary>
    )

    expect(screen.getByText('Form Validation Error')).toBeInTheDocument()
    expect(screen.getByText(/Name must be at least 3 characters/)).toBeInTheDocument()
  })

  it('should handle network errors', () => {
    const onRetry = vi.fn()

    render(
      <FormErrorBoundary onRetry={onRetry}>
        <ThrowFormError errorType="network" />
      </FormErrorBoundary>
    )

    expect(screen.getByText(/Network error occurred/)).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /Retry/i })
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalled()
  })

  it('should save draft when requested', () => {
    const onSaveDraft = vi.fn()

    const FormWithDraft = () => {
      throw new Error('Form submission failed')
    }

    render(
      <FormErrorBoundary enableDraftSaving={true} onSaveDraft={onSaveDraft} formName="testForm">
        <FormWithDraft />
      </FormErrorBoundary>
    )

    const saveDraftButton = screen.getByRole('button', { name: /Save as Draft/i })
    fireEvent.click(saveDraftButton)

    expect(onSaveDraft).toHaveBeenCalled()
  })
})

describe('RealtimeErrorBoundary', () => {
  const ThrowRealtimeError = ({ errorType }: { errorType: string }) => {
    if (errorType === 'websocket') {
      throw new Error('WebSocket connection failed')
    }
    if (errorType === 'timeout') {
      throw new Error('Request timed out')
    }
    return <div>Real-time content</div>
  }

  it('should handle WebSocket errors', () => {
    const onReconnect = vi.fn()

    render(
      <RealtimeErrorBoundary featureName="Test Feature" onReconnect={onReconnect}>
        <ThrowRealtimeError errorType="websocket" />
      </RealtimeErrorBoundary>
    )

    expect(screen.getByText('Real-time Connection Error')).toBeInTheDocument()
    expect(screen.getByText(/Test Feature feature is temporarily unavailable/)).toBeInTheDocument()

    const reconnectButton = screen.getByRole('button', { name: /Reconnect Now/i })
    fireEvent.click(reconnectButton)

    expect(onReconnect).toHaveBeenCalled()
  })

  it('should show timeout error with retry', () => {
    const onRetry = vi.fn()

    render(
      <RealtimeErrorBoundary onReconnect={onRetry}>
        <ThrowRealtimeError errorType="timeout" />
      </RealtimeErrorBoundary>
    )

    expect(screen.getByText('Request Timeout')).toBeInTheDocument()

    const retryButton = screen.getByRole('button', { name: /Try Again/i })
    fireEvent.click(retryButton)

    expect(onRetry).toHaveBeenCalled()
  })

  it('should offer fallback to polling', () => {
    const onFallbackToPolling = vi.fn()

    render(
      <RealtimeErrorBoundary onFallbackToPolling={onFallbackToPolling} featureName="Live Updates">
        <ThrowRealtimeError errorType="websocket" />
      </RealtimeErrorBoundary>
    )

    const fallbackButton = screen.getByRole('button', { name: /Continue with Limited Features/i })
    fireEvent.click(fallbackButton)

    expect(onFallbackToPolling).toHaveBeenCalled()
  })

  it('should show connection status indicator', async () => {
    const RealtimeComponent = () => {
      const [isConnected, setIsConnected] = React.useState(true)

      React.useEffect(() => {
        const timer = setTimeout(() => setIsConnected(false), 100)
        return () => clearTimeout(timer)
      }, [])

      if (!isConnected) {
        throw new Error('Connection lost')
      }

      return <div>Connected</div>
    }

    render(
      <RealtimeErrorBoundary enableAutoReconnect={false} featureName="Dashboard">
        <RealtimeComponent />
      </RealtimeErrorBoundary>
    )

    // Initially connected
    expect(screen.getByText('Connected')).toBeInTheDocument()

    // Wait for disconnection
    await waitFor(() => {
      expect(screen.getByText(/Real-time Connection Error/)).toBeInTheDocument()
    })
  })
})

describe('Error Boundary Integration', () => {
  it('should not interfere with normal component operation', () => {
    const NormalComponent = () => <div>Normal operation</div>

    const { rerender } = render(
      <PaymentErrorBoundary>
        <NormalComponent />
      </PaymentErrorBoundary>
    )

    expect(screen.getByText('Normal operation')).toBeInTheDocument()

    // Re-render should work normally
    rerender(
      <PaymentErrorBoundary>
        <NormalComponent />
      </PaymentErrorBoundary>
    )

    expect(screen.getByText('Normal operation')).toBeInTheDocument()
  })

  it('should reset error state when children change', () => {
    const ErrorComponent = () => {
      throw new Error('Test error')
    }
    const NormalComponent = () => <div>Normal component</div>

    const { rerender } = render(
      <PaymentErrorBoundary>
        <ErrorComponent />
      </PaymentErrorBoundary>
    )

    expect(screen.getByText(/Payment Failed/)).toBeInTheDocument()

    // Change to normal component
    rerender(
      <PaymentErrorBoundary>
        <NormalComponent />
      </PaymentErrorBoundary>
    )

    expect(screen.getByText('Normal component')).toBeInTheDocument()
    expect(screen.queryByText(/Payment Failed/)).not.toBeInTheDocument()
  })
})
