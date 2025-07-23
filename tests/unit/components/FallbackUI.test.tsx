import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import {
  ErrorFallback,
  NotFoundError,
  InternalServerError,
  UnauthorizedError,
  NetworkError,
  FormValidationError,
  FormSubmissionError,
  PaymentError,
  LoadingError,
  EmptyStateError,
  TimeoutError,
  SuccessState,
} from '../../../src/components/common/FallbackUI'

describe('FallbackUI Components', () => {
  describe('ErrorFallback', () => {
    it('renders basic error information', () => {
      render(<ErrorFallback title="Test Error" message="This is a test error message" />)

      expect(screen.getByText('Test Error')).toBeInTheDocument()
      expect(screen.getByText('This is a test error message')).toBeInTheDocument()
    })

    it('displays error code when provided', () => {
      render(<ErrorFallback title="Test Error" message="Test message" errorCode="ERR_001" />)

      expect(screen.getByText('Error Code: ERR_001')).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn()
      render(<ErrorFallback title="Test Error" message="Test message" onRetry={onRetry} />)

      fireEvent.click(screen.getByTestId('retry-button'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('shows technical details when enabled', () => {
      render(
        <ErrorFallback
          title="Test Error"
          message="Test message"
          details="Stack trace here"
          showTechnicalDetails={true}
        />
      )

      const toggleButton = screen.getByTestId('technical-details-toggle')
      expect(toggleButton).toBeInTheDocument()

      fireEvent.click(toggleButton)
      expect(screen.getByText('Stack trace here')).toBeInTheDocument()
    })

    it('shows home button when enabled', () => {
      const onGoHome = vi.fn()
      render(
        <ErrorFallback
          title="Test Error"
          message="Test message"
          onGoHome={onGoHome}
          showHomeButton={true}
        />
      )

      const homeButton = screen.getByTestId('home-button')
      expect(homeButton).toBeInTheDocument()

      fireEvent.click(homeButton)
      expect(onGoHome).toHaveBeenCalledTimes(1)
    })

    it('shows support button by default', () => {
      const onContactSupport = vi.fn()
      render(
        <ErrorFallback
          title="Test Error"
          message="Test message"
          onContactSupport={onContactSupport}
        />
      )

      const supportButton = screen.getByTestId('support-button')
      expect(supportButton).toBeInTheDocument()

      fireEvent.click(supportButton)
      expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
  })

  describe('NotFoundError', () => {
    it('renders 404 error correctly', () => {
      render(<NotFoundError />)

      expect(screen.getByText('Page Not Found')).toBeInTheDocument()
      expect(
        screen.getByText("The page you're looking for doesn't exist or may have been moved.")
      ).toBeInTheDocument()
      expect(screen.getByText('Error Code: 404')).toBeInTheDocument()
    })
  })

  describe('InternalServerError', () => {
    it('renders 500 error correctly', () => {
      render(<InternalServerError />)

      expect(screen.getByText('Server Error')).toBeInTheDocument()
      expect(
        screen.getByText(
          "We're experiencing technical difficulties. Our team has been notified and is working to resolve this issue."
        )
      ).toBeInTheDocument()
      expect(screen.getByText('Error Code: 500')).toBeInTheDocument()
    })
  })

  describe('UnauthorizedError', () => {
    it('renders unauthorized error correctly', () => {
      render(<UnauthorizedError />)

      expect(screen.getByText('Access Denied')).toBeInTheDocument()
      expect(
        screen.getByText(
          "You don't have permission to access this page. Please log in or contact your administrator."
        )
      ).toBeInTheDocument()
      expect(screen.getByText('Sign In')).toBeInTheDocument()
    })
  })

  describe('NetworkError', () => {
    it('renders network error correctly', () => {
      const onRetry = vi.fn()
      render(<NetworkError onRetry={onRetry} />)

      expect(screen.getByText('Connection Problem')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Unable to connect to our servers. Please check your internet connection and try again.'
        )
      ).toBeInTheDocument()

      fireEvent.click(screen.getByText('Try Again'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('FormValidationError', () => {
    it('renders validation errors correctly', () => {
      const errors = {
        email: 'Invalid email',
        password: 'Password too short',
      }

      render(<FormValidationError errors={errors} />)

      expect(screen.getByText('Form Validation Error')).toBeInTheDocument()
      expect(screen.getByText('Invalid email')).toBeInTheDocument()
      expect(screen.getByText('Password too short')).toBeInTheDocument()
    })

    it('calls onRetry when retry button is clicked', () => {
      const onRetry = vi.fn()
      const errors = { email: 'Invalid email' }

      render(<FormValidationError errors={errors} onRetry={onRetry} />)

      fireEvent.click(screen.getByText('Try Again'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('FormSubmissionError', () => {
    it('renders submission error correctly', () => {
      const onRetry = vi.fn()
      render(<FormSubmissionError onRetry={onRetry} />)

      expect(
        screen.getByText('There was an error submitting your form. Please try again.')
      ).toBeInTheDocument()

      fireEvent.click(screen.getByText('Retry'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('PaymentError', () => {
    it('renders card declined error correctly', () => {
      render(<PaymentError errorType="card_declined" />)

      expect(screen.getByText('Card Declined')).toBeInTheDocument()
      expect(
        screen.getByText(
          'Your card was declined. Please try a different payment method or contact your bank.'
        )
      ).toBeInTheDocument()
    })

    it('renders insufficient funds error correctly', () => {
      render(<PaymentError errorType="insufficient_funds" />)

      expect(screen.getByText('Insufficient Funds')).toBeInTheDocument()
      expect(
        screen.getByText('Your card has insufficient funds. Please use a different payment method.')
      ).toBeInTheDocument()
    })

    it('renders invalid card error correctly', () => {
      render(<PaymentError errorType="invalid_card" />)

      expect(screen.getByText('Invalid Card Information')).toBeInTheDocument()
      expect(
        screen.getByText('The card information you entered is invalid. Please check and try again.')
      ).toBeInTheDocument()
    })

    it('calls payment method handlers correctly', () => {
      const onUpdatePaymentMethod = vi.fn()
      const onRetry = vi.fn()
      const onContactSupport = vi.fn()

      render(
        <PaymentError
          errorType="card_declined"
          onUpdatePaymentMethod={onUpdatePaymentMethod}
          onRetry={onRetry}
          onContactSupport={onContactSupport}
        />
      )

      fireEvent.click(screen.getByText('Update Payment Method'))
      expect(onUpdatePaymentMethod).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Try Again'))
      expect(onRetry).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Contact Support'))
      expect(onContactSupport).toHaveBeenCalledTimes(1)
    })
  })

  describe('LoadingError', () => {
    it('renders data loading error correctly', () => {
      const onRetry = vi.fn()
      render(<LoadingError type="data" onRetry={onRetry} />)

      expect(screen.getByText('Failed to load data. Please try again.')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Try Again'))
      expect(onRetry).toHaveBeenCalledTimes(1)
    })

    it('renders page loading error correctly', () => {
      render(<LoadingError type="page" />)

      expect(
        screen.getByText('Failed to load page content. Please refresh and try again.')
      ).toBeInTheDocument()
    })

    it('renders component loading error correctly', () => {
      render(<LoadingError type="component" />)

      expect(screen.getByText('This section failed to load. Please try again.')).toBeInTheDocument()
    })

    it('uses custom message when provided', () => {
      render(<LoadingError type="data" message="Custom loading error message" />)

      expect(screen.getByText('Custom loading error message')).toBeInTheDocument()
    })
  })

  describe('EmptyStateError', () => {
    it('renders empty state correctly', () => {
      render(<EmptyStateError title="No Data" message="No data available" />)

      expect(screen.getByText('No Data')).toBeInTheDocument()
      expect(screen.getByText('No data available')).toBeInTheDocument()
    })

    it('calls action handler when button is clicked', () => {
      const onAction = vi.fn()
      render(
        <EmptyStateError
          title="No Data"
          message="No data available"
          actionLabel="Create New"
          onAction={onAction}
        />
      )

      fireEvent.click(screen.getByText('Create New'))
      expect(onAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('TimeoutError', () => {
    it('renders timeout error correctly', () => {
      const onRetry = vi.fn()
      const onCancel = vi.fn()

      render(<TimeoutError timeoutDuration={30} onRetry={onRetry} onCancel={onCancel} />)

      expect(screen.getByText('Request Timeout')).toBeInTheDocument()
      expect(
        screen.getByText(
          'The request took too long to complete (30s). Please try again or check your connection.'
        )
      ).toBeInTheDocument()

      fireEvent.click(screen.getByText('Try Again'))
      expect(onRetry).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Cancel'))
      expect(onCancel).toHaveBeenCalledTimes(1)
    })
  })

  describe('SuccessState', () => {
    it('renders success state correctly', () => {
      const onPrimaryAction = vi.fn()
      const onSecondaryAction = vi.fn()

      render(
        <SuccessState
          title="Success!"
          message="Operation completed successfully"
          onPrimaryAction={onPrimaryAction}
          onSecondaryAction={onSecondaryAction}
          primaryActionLabel="Continue"
          secondaryActionLabel="Done"
        />
      )

      expect(screen.getByText('Success!')).toBeInTheDocument()
      expect(screen.getByText('Operation completed successfully')).toBeInTheDocument()

      fireEvent.click(screen.getByText('Continue'))
      expect(onPrimaryAction).toHaveBeenCalledTimes(1)

      fireEvent.click(screen.getByText('Done'))
      expect(onSecondaryAction).toHaveBeenCalledTimes(1)
    })
  })

  describe('Accessibility', () => {
    it('has proper ARIA attributes for error components', () => {
      render(<ErrorFallback title="Test Error" message="Test message" testId="test-error" />)

      const errorContainer = screen.getByTestId('test-error')
      expect(errorContainer).toHaveAttribute('role', 'alert')
      expect(errorContainer).toHaveAttribute('aria-live', 'polite')
    })

    it('has proper ARIA attributes for success components', () => {
      render(<SuccessState title="Success" message="Success message" testId="test-success" />)

      const successContainer = screen.getByTestId('test-success')
      expect(successContainer).toHaveAttribute('role', 'status')
      expect(successContainer).toHaveAttribute('aria-live', 'polite')
    })

    it('has proper aria-expanded for technical details toggle', () => {
      render(
        <ErrorFallback
          title="Test Error"
          message="Test message"
          details="Technical details"
          showTechnicalDetails={true}
        />
      )

      const toggleButton = screen.getByTestId('technical-details-toggle')
      expect(toggleButton).toHaveAttribute('aria-expanded', 'false')

      fireEvent.click(toggleButton)
      expect(toggleButton).toHaveAttribute('aria-expanded', 'true')
    })
  })

  describe('Custom Styling', () => {
    it('applies custom className', () => {
      render(
        <ErrorFallback
          title="Test Error"
          message="Test message"
          className="custom-error-class"
          testId="custom-error"
        />
      )

      const errorContainer = screen.getByTestId('custom-error')
      expect(errorContainer).toHaveClass('custom-error-class')
    })

    it('applies custom testId', () => {
      render(<ErrorFallback title="Test Error" message="Test message" testId="my-custom-test-id" />)

      expect(screen.getByTestId('my-custom-test-id')).toBeInTheDocument()
    })
  })
})
