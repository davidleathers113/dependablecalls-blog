import { Component } from 'react'
import type { ErrorInfo, ReactNode } from 'react'
import {
  shouldShowTechnicalDetails,
  shouldLogToConsole,
  getEnvironmentErrorMessage,
} from '../../utils/environment'

interface Props {
  children: ReactNode
  fallback?: ReactNode | React.ComponentType<ErrorFallbackProps>
  onError?: (error: Error, errorInfo: ErrorInfo) => void
  context?: string
  showTechnicalDetails?: boolean
  level?: 'page' | 'section' | 'component'
  resetKeys?: unknown[]
}

// Interface for error fallback components
export interface ErrorFallbackProps {
  error: Error
  resetError: () => void
  level?: 'page' | 'section' | 'component'
  errorInfo?: ErrorInfo
}

interface State {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
  errorId: number
}

export class ErrorBoundary extends Component<Props, State> {
  private resetTimeoutId: number | null = null

  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, errorId: 0 }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: undefined,
    }
  }

  componentDidUpdate(prevProps: Props) {
    const { resetKeys } = this.props
    const prevResetKeys = prevProps.resetKeys
    
    if (
      this.state.hasError &&
      resetKeys &&
      prevResetKeys &&
      resetKeys.length !== prevResetKeys.length ||
      resetKeys.some((resetKey, idx) => resetKey !== prevResetKeys[idx])
    ) {
      this.resetErrorBoundary()
    }
  }

  componentWillUnmount() {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
  }

  resetErrorBoundary = () => {
    if (this.resetTimeoutId) {
      clearTimeout(this.resetTimeoutId)
    }
    
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      errorId: this.state.errorId + 1
    })
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Update state with error info for development display
    this.setState({ errorInfo })

    // Log error with context only in appropriate environments
    if (shouldLogToConsole()) {
      console.error(
        `ErrorBoundary caught an error${this.props.context ? ` in ${this.props.context}` : ''}:`,
        error,
        errorInfo
      )
    }

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo)
    }
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        const { fallback: FallbackComponent } = this.props
        
        if (typeof FallbackComponent === 'function') {
          return (
            <FallbackComponent
              error={this.state.error!}
              resetError={this.resetErrorBoundary}
              level={this.props.level}
              errorInfo={this.state.errorInfo}
            />
          )
        }
        
        return FallbackComponent
      }

      // Default fallback UI
      const showDetails = this.props.showTechnicalDetails ?? shouldShowTechnicalDetails()
      const error = this.state.error
      const errorInfo = this.state.errorInfo

      return (
        <div className="min-h-[200px] flex items-center justify-center p-8">
          <div className="text-center max-w-2xl">
            <div className="w-16 h-16 mx-auto mb-4 text-red-500">
              <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Something went wrong</h3>
            <p className="text-gray-600 mb-4">
              {getEnvironmentErrorMessage(
                error,
                "We're sorry, but something unexpected happened. Please try refreshing the page."
              )}
            </p>

            {showDetails && error && (
              <details className="mb-4 text-left">
                <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700 mb-2">
                  Technical Details
                </summary>
                <div className="mt-2 p-4 bg-gray-50 rounded-lg overflow-auto">
                  <div className="mb-4">
                    <h4 className="text-xs font-semibold text-gray-700 mb-1">Error Message:</h4>
                    <pre className="text-xs text-gray-600 whitespace-pre-wrap">{error.message}</pre>
                  </div>

                  {error.stack && (
                    <div className="mb-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Stack Trace:</h4>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                        {error.stack}
                      </pre>
                    </div>
                  )}

                  {errorInfo?.componentStack && (
                    <div>
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Component Stack:</h4>
                      <pre className="text-xs text-gray-600 whitespace-pre-wrap overflow-x-auto">
                        {errorInfo.componentStack}
                      </pre>
                    </div>
                  )}

                  {this.props.context && (
                    <div className="mt-4">
                      <h4 className="text-xs font-semibold text-gray-700 mb-1">Error Context:</h4>
                      <p className="text-xs text-gray-600">{this.props.context}</p>
                    </div>
                  )}
                </div>
              </details>
            )}

            <button
              onClick={() => window.location.reload()}
              className="bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-md text-sm font-medium transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

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
) {
  const WrappedComponent = React.forwardRef<unknown, T>((props, ref) => (
    <ErrorBoundary
      level={options.level || 'component'}
      onError={options.onError}
      fallback={options.fallback}
      context={options.context || Component.displayName || Component.name}
      showTechnicalDetails={options.showTechnicalDetails}
    >
      <Component {...props} ref={ref} />
    </ErrorBoundary>
  ))

  WrappedComponent.displayName = `withErrorBoundary(${Component.displayName || Component.name})`

  return WrappedComponent
}

export default ErrorBoundary
