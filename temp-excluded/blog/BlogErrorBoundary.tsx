import React, { Component, type ReactNode } from 'react'
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { isBlogError, isAuthError } from '../../types/errors'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

/**
 * Blog-specific error boundary that handles blog data loading errors gracefully
 * 
 * Features:
 * - Catches blog service errors and displays appropriate messages
 * - Handles authentication errors for protected blog operations
 * - Provides retry functionality for transient errors
 * - Maintains blog page layout and navigation
 */
export class BlogErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })

    // Log blog errors for monitoring
    console.error('Blog Error Boundary caught an error:', error, errorInfo)
    
    // TODO: Send to error monitoring service (Sentry, etc.)
    // errorReportingService.captureError(error, {
    //   component: 'BlogErrorBoundary',
    //   errorInfo,
    //   context: 'blog'
    // })
  }

  handleRetry = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback
      }

      // Determine error type and message
      const error = this.state.error
      let errorMessage = 'Something went wrong while loading the blog.'
      let errorAction = 'Please try again later.'
      let showRetry = true

      if (error && isBlogError(error)) {
        if (isAuthError(error)) {
          errorMessage = 'Authentication error occurred.'
          errorAction = 'Please refresh the page or contact support if the issue persists.'
          showRetry = false
        } else if (error.statusCode === 404) {
          errorMessage = 'The requested blog content was not found.'
          errorAction = 'Please check the URL or return to the blog homepage.'
          showRetry = false
        } else if (error.statusCode >= 500) {
          errorMessage = 'Our blog service is temporarily unavailable.'
          errorAction = 'We\'re working to fix this. Please try again in a few minutes.'
        } else {
          errorMessage = error.message || 'Unable to load blog content.'
        }
      } else if (error?.message.includes('Failed to fetch')) {
        errorMessage = 'Unable to connect to the blog service.'
        errorAction = 'Please check your internet connection and try again.'
      }

      return (
        <div className="min-h-[400px] flex items-center justify-center p-8">
          <div className="max-w-md w-full text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 mb-6">
              <ExclamationTriangleIcon className="h-8 w-8 text-red-600" />
            </div>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Blog Temporarily Unavailable
            </h2>
            
            <p className="text-gray-600 mb-2">
              {errorMessage}
            </p>
            
            <p className="text-sm text-gray-500 mb-6">
              {errorAction}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              {showRetry && (
                <button
                  onClick={this.handleRetry}
                  className="inline-flex items-center px-4 py-2 bg-primary-600 text-white text-sm font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors"
                >
                  <ArrowPathIcon className="h-4 w-4 mr-2" />
                  Try Again
                </button>
              )}
              
              <button
                onClick={() => window.location.href = '/blog'}
                className="inline-flex items-center px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
              >
                Return to Blog
              </button>
            </div>

            {/* Development error details (only in dev mode) */}
            {import.meta.env.DEV && error && (
              <details className="mt-8 text-left">
                <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-700">
                  Show Error Details (Development)
                </summary>
                <div className="mt-4 p-4 bg-gray-50 rounded-md text-xs text-gray-600 font-mono overflow-auto">
                  <div className="mb-2">
                    <strong>Error:</strong> {error.message}
                  </div>
                  {error.stack && (
                    <div>
                      <strong>Stack:</strong>
                      <pre className="mt-1 whitespace-pre-wrap">{error.stack}</pre>
                    </div>
                  )}
                </div>
              </details>
            )}
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default BlogErrorBoundary