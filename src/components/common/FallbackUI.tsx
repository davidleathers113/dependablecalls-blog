import React from 'react'
import {
  ExclamationTriangleIcon,
  XCircleIcon,
  ShieldExclamationIcon,
  WifiIcon,
  ArrowPathIcon,
  HomeIcon,
  PhoneIcon,
  CreditCardIcon,
  DocumentTextIcon,
  EyeSlashIcon,
  ClockIcon,
  CheckCircleIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import {
  shouldShowTechnicalDetails,
  getEnvironmentName,
  getEnvironmentErrorMessage,
} from '../../utils/environment'

// Base error interfaces
interface BaseErrorProps {
  className?: string
  testId?: string
}

interface ErrorActionProps {
  onRetry?: () => void
  onGoHome?: () => void
  onGoBack?: () => void
  onContactSupport?: () => void
  retryLabel?: string
  showHomeButton?: boolean
  showBackButton?: boolean
  showSupportButton?: boolean
}

interface ErrorDetailsProps {
  title: string
  message: string
  details?: string
  errorCode?: string
  showTechnicalDetails?: boolean
  error?: Error | unknown
  errorInfo?: { componentStack?: string; [key: string]: unknown }
  timestamp?: Date
}

type ErrorFallbackProps = BaseErrorProps & ErrorActionProps & ErrorDetailsProps

// Generic Error Fallback Component
export function ErrorFallback({
  title,
  message,
  details,
  errorCode,
  showTechnicalDetails,
  error,
  errorInfo,
  timestamp = new Date(),
  onRetry,
  onGoHome,
  onGoBack,
  onContactSupport,
  retryLabel = 'Try Again',
  showHomeButton = false,
  showBackButton = false,
  showSupportButton = true,
  className = '',
  testId = 'error-fallback',
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = React.useState(false)
  const shouldShowDetails = showTechnicalDetails ?? shouldShowTechnicalDetails()
  const environment = getEnvironmentName()

  return (
    <div
      className={`min-h-[400px] flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">{title}</h2>

        <p className="text-gray-600 mb-6 leading-relaxed">{message}</p>

        {errorCode && <div className="mb-4 text-sm text-gray-500">Error Code: {errorCode}</div>}

        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              data-testid="retry-button"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              {retryLabel}
            </button>
          )}

          <div className="flex space-x-3">
            {showHomeButton && onGoHome && (
              <button
                onClick={onGoHome}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                data-testid="home-button"
              >
                <HomeIcon className="h-4 w-4 mr-2" />
                Home
              </button>
            )}

            {showBackButton && onGoBack && (
              <button
                onClick={onGoBack}
                className="flex-1 flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
                data-testid="back-button"
              >
                ← Back
              </button>
            )}
          </div>

          {showSupportButton && onContactSupport && (
            <button
              onClick={onContactSupport}
              className="w-full flex items-center justify-center px-4 py-2 text-primary-600 bg-primary-50 rounded-lg hover:bg-primary-100 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
              data-testid="support-button"
            >
              <PhoneIcon className="h-4 w-4 mr-2" />
              Contact Support
            </button>
          )}
        </div>

        {!!(shouldShowDetails && (details || error)) && (
          <div className="mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline mx-auto"
              aria-expanded={showDetails}
              aria-label={showDetails ? 'Hide technical details' : 'Show technical details'}
              data-testid="technical-details-toggle"
            >
              {showDetails ? 'Hide' : 'Show'} Technical Details
              {showDetails ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>

            {showDetails && (
              <div className="mt-3 p-4 bg-gray-50 rounded-lg text-left space-y-4">
                {/* Environment Info */}
                <div className="text-xs text-gray-500 flex items-center justify-between">
                  <span>
                    Environment: <span className="font-medium">{environment}</span>
                  </span>
                  <span>Time: {timestamp.toLocaleString()}</span>
                </div>

                {/* Error Details */}
                {details !== undefined && details !== null && details !== '' && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">Error Details:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto bg-white p-2 rounded border border-gray-200">
                      {details}
                    </pre>
                  </div>
                )}

                {/* Error Object */}
                {error && error instanceof Error && (
                  <>
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Error Message:</h4>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-2 rounded border border-gray-200">
                        {error.message}
                      </pre>
                    </div>

                    {error.stack && (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-700 mb-1">Stack Trace:</h4>
                        <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto bg-white p-2 rounded border border-gray-200 max-h-48">
                          {error.stack}
                        </pre>
                      </div>
                    )}
                  </>
                )}

                {/* Component Stack */}
                {errorInfo?.componentStack && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">Component Stack:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto bg-white p-2 rounded border border-gray-200 max-h-48">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                {/* Additional Error Info */}
                {errorInfo && Object.keys(errorInfo).length > 1 && (
                  <div>
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">Additional Info:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-auto bg-white p-2 rounded border border-gray-200">
                      {JSON.stringify(
                        Object.fromEntries(
                          Object.entries(errorInfo).filter(([key]) => key !== 'componentStack')
                        ),
                        null,
                        2
                      )}
                    </pre>
                  </div>
                )}

                {/* Dev Tools Hint */}
                {environment === 'development' && (
                  <div className="text-xs text-gray-500 italic">
                    💡 Tip: Check your browser console for more detailed debugging information.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Route-Specific Error Components

interface RouteErrorProps extends BaseErrorProps {
  onRetry?: () => void
  onGoHome?: () => void
  error?: Error | unknown
  errorInfo?: { componentStack?: string; [key: string]: unknown }
}

export function NotFoundError({ onGoHome, className, testId }: RouteErrorProps) {
  return (
    <ErrorFallback
      title="Page Not Found"
      message="The page you're looking for doesn't exist or may have been moved."
      onGoHome={onGoHome}
      showHomeButton={true}
      showSupportButton={false}
      className={className}
      testId={testId}
      errorCode="404"
    />
  )
}

export function InternalServerError({
  onRetry,
  onGoHome,
  error,
  errorInfo,
  className,
  testId,
}: RouteErrorProps) {
  return (
    <ErrorFallback
      title="Server Error"
      message={getEnvironmentErrorMessage(
        error,
        "We're experiencing technical difficulties. Our team has been notified and is working to resolve this issue."
      )}
      onRetry={onRetry}
      onGoHome={onGoHome}
      showHomeButton={true}
      showBackButton={false}
      retryLabel="Refresh Page"
      className={className}
      testId={testId}
      errorCode="500"
      error={error}
      errorInfo={errorInfo}
    />
  )
}

export function UnauthorizedError({ onGoHome, className, testId }: RouteErrorProps) {
  return (
    <div
      className={`min-h-[400px] flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-yellow-100 p-3">
            <ShieldExclamationIcon className="h-8 w-8 text-yellow-600" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>

        <p className="text-gray-600 mb-6 leading-relaxed">
          You don't have permission to access this page. Please log in or contact your
          administrator.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => (window.location.href = '/login')}
            className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            Sign In
          </button>

          {onGoHome && (
            <button
              onClick={onGoHome}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              <HomeIcon className="h-4 w-4 mr-2" />
              Go Home
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export function NetworkError({ onRetry, className, testId }: RouteErrorProps) {
  return (
    <div
      className={`min-h-[400px] flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-3">
            <WifiIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">Connection Problem</h2>

        <p className="text-gray-600 mb-6 leading-relaxed">
          Unable to connect to our servers. Please check your internet connection and try again.
        </p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

// Form-Specific Error Components

interface FormErrorProps extends BaseErrorProps {
  errors: Record<string, string>
  onRetry?: () => void
  title?: string
  message?: string
}

export function FormValidationError({
  errors,
  onRetry,
  title = 'Form Validation Error',
  message = 'Please correct the following errors and try again:',
  className,
  testId,
}: FormErrorProps) {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
      data-testid={testId}
      role="alert"
      aria-live="polite"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <XCircleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800">{title}</h3>
          <div className="mt-2 text-sm text-red-700">
            <p className="mb-2">{message}</p>
            <ul className="list-disc list-inside space-y-1">
              {Object.entries(errors).map(([field, error]) => (
                <li key={field}>
                  <span className="font-medium capitalize">
                    {field.replace(/([A-Z])/g, ' $1').trim()}:
                  </span>{' '}
                  {error}
                </li>
              ))}
            </ul>
          </div>
          {onRetry && (
            <div className="mt-4">
              <button
                onClick={onRetry}
                className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface FormSubmissionErrorProps extends BaseErrorProps {
  onRetry?: () => void
  message?: string
}

export function FormSubmissionError({
  onRetry,
  message = 'There was an error submitting your form. Please try again.',
  className,
  testId,
}: FormSubmissionErrorProps) {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="flex items-center">
        <XCircleIcon className="h-5 w-5 text-red-400 mr-3" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm text-red-700">{message}</p>
        </div>
        {onRetry && (
          <button
            onClick={onRetry}
            className="ml-3 text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
          >
            Retry
          </button>
        )}
      </div>
    </div>
  )
}

// Payment/Transaction Error Components

interface PaymentErrorProps extends BaseErrorProps {
  errorType:
    | 'card_declined'
    | 'insufficient_funds'
    | 'payment_failed'
    | 'connection_error'
    | 'invalid_card'
  onRetry?: () => void
  onUpdatePaymentMethod?: () => void
  onContactSupport?: () => void
}

export function PaymentError({
  errorType,
  onRetry,
  onUpdatePaymentMethod,
  onContactSupport,
  className,
  testId,
}: PaymentErrorProps) {
  const getErrorContent = () => {
    switch (errorType) {
      case 'card_declined':
        return {
          title: 'Card Declined',
          message:
            'Your card was declined. Please try a different payment method or contact your bank.',
          showUpdatePayment: true,
        }
      case 'insufficient_funds':
        return {
          title: 'Insufficient Funds',
          message: 'Your card has insufficient funds. Please use a different payment method.',
          showUpdatePayment: true,
        }
      case 'invalid_card':
        return {
          title: 'Invalid Card Information',
          message: 'The card information you entered is invalid. Please check and try again.',
          showUpdatePayment: true,
        }
      case 'connection_error':
        return {
          title: 'Connection Error',
          message: 'Unable to process payment due to connection issues. Please try again.',
          showUpdatePayment: false,
        }
      default:
        return {
          title: 'Payment Failed',
          message: 'We were unable to process your payment. Please try again or contact support.',
          showUpdatePayment: true,
        }
    }
  }

  const { title, message, showUpdatePayment } = getErrorContent()

  return (
    <div
      className={`p-6 bg-red-50 border border-red-200 rounded-lg ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="flex">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-red-100 p-2">
            <CreditCardIcon className="h-6 w-6 text-red-600" aria-hidden="true" />
          </div>
        </div>
        <div className="ml-4 flex-1">
          <h3 className="text-lg font-medium text-red-800 mb-2">{title}</h3>
          <p className="text-red-700 mb-4">{message}</p>

          <div className="space-y-2">
            {showUpdatePayment && onUpdatePaymentMethod && (
              <button
                onClick={onUpdatePaymentMethod}
                className="w-full sm:w-auto inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors mr-3"
              >
                <CreditCardIcon className="h-4 w-4 mr-2" />
                Update Payment Method
              </button>
            )}

            {onRetry && (
              <button
                onClick={onRetry}
                className="w-full sm:w-auto inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors mr-3"
              >
                <ArrowPathIcon className="h-4 w-4 mr-2" />
                Try Again
              </button>
            )}

            {onContactSupport && (
              <button
                onClick={onContactSupport}
                className="w-full sm:w-auto inline-flex items-center px-4 py-2 text-red-700 bg-red-100 rounded-lg hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
              >
                <PhoneIcon className="h-4 w-4 mr-2" />
                Contact Support
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// Loading State Error Fallbacks

interface LoadingErrorProps extends BaseErrorProps {
  type: 'data' | 'page' | 'component'
  onRetry?: () => void
  message?: string
}

export function LoadingError({ type, onRetry, message, className, testId }: LoadingErrorProps) {
  const getDefaultMessage = () => {
    switch (type) {
      case 'data':
        return 'Failed to load data. Please try again.'
      case 'page':
        return 'Failed to load page content. Please refresh and try again.'
      case 'component':
        return 'This section failed to load. Please try again.'
      default:
        return 'Loading failed. Please try again.'
    }
  }

  return (
    <div
      className={`flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="text-center">
        <div className="flex justify-center mb-4">
          <div className="rounded-full bg-gray-100 p-3">
            <DocumentTextIcon className="h-6 w-6 text-gray-500" aria-hidden="true" />
          </div>
        </div>

        <p className="text-gray-600 mb-4">{message || getDefaultMessage()}</p>

        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Try Again
          </button>
        )}
      </div>
    </div>
  )
}

// Empty State with Error Context

interface EmptyStateErrorProps extends BaseErrorProps {
  title: string
  message: string
  icon?: React.ComponentType<{ className?: string }>
  actionLabel?: string
  onAction?: () => void
}

export function EmptyStateError({
  title,
  message,
  icon: Icon = EyeSlashIcon,
  actionLabel,
  onAction,
  className,
  testId,
}: EmptyStateErrorProps) {
  return (
    <div className={`flex items-center justify-center p-12 ${className}`} data-testid={testId}>
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-gray-100 p-4">
            <Icon className="h-8 w-8 text-gray-400" aria-hidden="true" />
          </div>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>

        <p className="text-gray-500 mb-6">{message}</p>

        {actionLabel && onAction && (
          <button
            onClick={onAction}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            {actionLabel}
          </button>
        )}
      </div>
    </div>
  )
}

// Timeout Error Component

interface TimeoutErrorProps extends BaseErrorProps {
  onRetry?: () => void
  onCancel?: () => void
  timeoutDuration?: number
}

export function TimeoutError({
  onRetry,
  onCancel,
  timeoutDuration,
  className,
  testId,
}: TimeoutErrorProps) {
  return (
    <div
      className={`flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-yellow-100 p-3">
            <ClockIcon className="h-8 w-8 text-yellow-600" aria-hidden="true" />
          </div>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">Request Timeout</h3>

        <p className="text-gray-600 mb-6">
          The request took too long to complete
          {timeoutDuration && ` (${timeoutDuration}s)`}. Please try again or check your connection.
        </p>

        <div className="space-y-3">
          {onRetry && (
            <button
              onClick={onRetry}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              <ArrowPathIcon className="h-4 w-4 mr-2" />
              Try Again
            </button>
          )}

          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Success State with Action Options

interface SuccessStateProps extends BaseErrorProps {
  title: string
  message: string
  onPrimaryAction?: () => void
  onSecondaryAction?: () => void
  primaryActionLabel?: string
  secondaryActionLabel?: string
}

export function SuccessState({
  title,
  message,
  onPrimaryAction,
  onSecondaryAction,
  primaryActionLabel = 'Continue',
  secondaryActionLabel = 'Done',
  className,
  testId,
}: SuccessStateProps) {
  return (
    <div
      className={`flex items-center justify-center p-6 ${className}`}
      data-testid={testId}
      role="status"
      aria-live="polite"
    >
      <div className="text-center max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-green-100 p-3">
            <CheckCircleIcon className="h-8 w-8 text-green-600" aria-hidden="true" />
          </div>
        </div>

        <h3 className="text-lg font-medium text-gray-900 mb-2">{title}</h3>

        <p className="text-gray-600 mb-6">{message}</p>

        <div className="space-y-3">
          {onPrimaryAction && (
            <button
              onClick={onPrimaryAction}
              className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
            >
              {primaryActionLabel}
            </button>
          )}

          {onSecondaryAction && (
            <button
              onClick={onSecondaryAction}
              className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// Layout-Specific Error Fallback Components

export function PublicLayoutFallbackUI({ className, testId }: BaseErrorProps) {
  return (
    <div
      className={`min-h-[400px] flex items-center justify-center p-6 bg-gray-50 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="max-w-md w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-3">
            <ExclamationTriangleIcon className="h-8 w-8 text-red-600" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-xl font-semibold text-gray-900 mb-2">Page Error</h2>

        <p className="text-gray-600 mb-6 leading-relaxed">
          We're sorry, but this page encountered an error. Please try refreshing the page or return
          to our homepage.
        </p>

        <div className="space-y-3">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors"
          >
            <ArrowPathIcon className="h-4 w-4 mr-2" />
            Refresh Page
          </button>

          <button
            onClick={() => (window.location.href = '/')}
            className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
          >
            <HomeIcon className="h-4 w-4 mr-2" />
            Go to Homepage
          </button>
        </div>
      </div>
    </div>
  )
}

export function AppLayoutSidebarFallbackUI({ className, testId }: BaseErrorProps) {
  return (
    <div
      className={`p-4 bg-red-50 border border-red-200 rounded-lg m-2 ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="flex items-center">
        <div className="flex-shrink-0">
          <ExclamationTriangleIcon className="h-5 w-5 text-red-400" aria-hidden="true" />
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-red-800">Navigation Error</h3>
          <p className="mt-1 text-sm text-red-700">
            The navigation menu encountered an error. Please refresh the page.
          </p>
          <div className="mt-3">
            <button
              onClick={() => window.location.reload()}
              className="text-sm bg-red-100 text-red-800 px-3 py-1 rounded hover:bg-red-200 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 transition-colors"
            >
              Refresh
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export function AppLayoutContentFallbackUI({ className, testId }: BaseErrorProps) {
  return (
    <div
      className={`min-h-[500px] flex items-center justify-center p-6 bg-white ${className}`}
      data-testid={testId}
      role="alert"
    >
      <div className="max-w-lg w-full text-center">
        <div className="flex justify-center mb-6">
          <div className="rounded-full bg-red-100 p-4">
            <ExclamationTriangleIcon className="h-10 w-10 text-red-600" aria-hidden="true" />
          </div>
        </div>

        <h2 className="text-2xl font-semibold text-gray-900 mb-2">Content Error</h2>

        <p className="text-gray-600 mb-8 leading-relaxed">
          The main content area encountered an error and cannot be displayed. This might be a
          temporary issue.
        </p>

        <div className="space-y-4">
          <button
            onClick={() => window.location.reload()}
            className="w-full flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-colors text-base font-medium"
          >
            <ArrowPathIcon className="h-5 w-5 mr-2" />
            Refresh Page
          </button>

          <button
            onClick={() => (window.location.href = '/app/dashboard')}
            className="w-full flex items-center justify-center px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors text-base font-medium"
          >
            <HomeIcon className="h-5 w-5 mr-2" />
            Go to Dashboard
          </button>
        </div>

        <div className="mt-8 text-sm text-gray-500">
          <p>If this problem persists, please contact support.</p>
        </div>
      </div>
    </div>
  )
}

// Export ErrorFallback as FallbackUI for backward compatibility
export { ErrorFallback as FallbackUI }

// Export all error interfaces for external use
export type {
  ErrorFallbackProps,
  BaseErrorProps,
  ErrorActionProps,
  ErrorDetailsProps,
  RouteErrorProps,
  FormErrorProps,
  FormSubmissionErrorProps,
  PaymentErrorProps,
  LoadingErrorProps,
  EmptyStateErrorProps,
  TimeoutErrorProps,
  SuccessStateProps,
}

// Export all components as default
export default {
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
  PublicLayoutFallbackUI,
  AppLayoutSidebarFallbackUI,
  AppLayoutContentFallbackUI,
}
