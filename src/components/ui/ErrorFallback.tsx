import {
  ExclamationTriangleIcon,
  ArrowPathIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline'
import { captureMessage } from '../../lib/monitoring'
import {
  shouldShowTechnicalDetails,
  getEnvironmentName,
  getEnvironmentErrorMessage,
  environment,
} from '../../utils/environment'
import { useState } from 'react'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
  isRoot?: boolean
  errorInfo?: { componentStack?: string; [key: string]: unknown }
}

export function ErrorFallback({
  error,
  resetErrorBoundary,
  isRoot = false,
  errorInfo,
}: ErrorFallbackProps) {
  const [showDetails, setShowDetails] = useState(false)
  const shouldShowTechDetails = shouldShowTechnicalDetails()
  const envName = getEnvironmentName()
  const handleReset = () => {
    // Log the recovery attempt
    captureMessage('User initiated error boundary reset', 'info', {
      errorMessage: error.message,
      isRootBoundary: isRoot,
    })

    resetErrorBoundary()
  }

  const handleReload = () => {
    // Log the full reload attempt
    captureMessage('User initiated full page reload from error boundary', 'warning', {
      errorMessage: error.message,
      isRootBoundary: isRoot,
    })

    window.location.reload()
  }

  return (
    <div
      className={`min-h-screen flex items-center justify-center px-4 ${isRoot ? 'bg-gray-50' : 'bg-white'}`}
    >
      <div className="max-w-md w-full text-center">
        <div className="mb-6">
          <ExclamationTriangleIcon className="mx-auto h-16 w-16 text-red-500" />
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          {isRoot ? 'Something went wrong' : 'Error in this section'}
        </h1>

        <p className="text-gray-600 mb-6">
          {getEnvironmentErrorMessage(
            error,
            isRoot
              ? 'We apologize for the inconvenience. The application encountered an unexpected error.'
              : 'This section encountered an error, but the rest of the application should work normally.'
          )}
        </p>

        {shouldShowTechDetails && (
          <div className="mb-6">
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 focus:outline-none focus:underline mx-auto mb-3"
              aria-expanded={showDetails}
              aria-label={showDetails ? 'Hide technical details' : 'Show technical details'}
            >
              Technical Details ({envName})
              {showDetails ? (
                <ChevronUpIcon className="h-4 w-4" />
              ) : (
                <ChevronDownIcon className="h-4 w-4" />
              )}
            </button>

            {showDetails && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-left space-y-3">
                {/* Environment Info */}
                <div className="text-xs text-gray-600 flex items-center justify-between border-b border-red-200 pb-2">
                  <span>
                    Environment: <span className="font-medium">{envName}</span>
                  </span>
                  <span>Time: {new Date().toLocaleString()}</span>
                </div>

                {/* Error Details */}
                <div>
                  <h3 className="text-sm font-medium text-red-800 mb-1">Error Message</h3>
                  <pre className="text-xs text-red-700 whitespace-pre-wrap break-words bg-white p-2 rounded">
                    {error.message}
                  </pre>
                </div>

                {/* Stack Trace */}
                {error.stack && (
                  <div>
                    <h3 className="text-sm font-medium text-red-800 mb-1">Stack Trace</h3>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap break-words bg-white p-2 rounded max-h-48 overflow-auto">
                      {error.stack}
                    </pre>
                  </div>
                )}

                {/* Component Stack */}
                {errorInfo?.componentStack && (
                  <div>
                    <h3 className="text-sm font-medium text-red-800 mb-1">Component Stack</h3>
                    <pre className="text-xs text-red-600 whitespace-pre-wrap break-words bg-white p-2 rounded max-h-48 overflow-auto">
                      {errorInfo.componentStack}
                    </pre>
                  </div>
                )}

                {/* Error Type & Name */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-red-700 font-medium">Error Type:</span>
                    <span className="ml-1 text-red-600">{error.name}</span>
                  </div>
                  <div>
                    <span className="text-red-700 font-medium">Root Boundary:</span>
                    <span className="ml-1 text-red-600">{isRoot ? 'Yes' : 'No'}</span>
                  </div>
                </div>

                {/* Development Hints */}
                {environment.isDevelopment && (
                  <div className="text-xs text-gray-600 italic border-t border-red-200 pt-2">
                    💡 Development Tips:
                    <ul className="list-disc list-inside mt-1 space-y-1">
                      <li>Check browser console for additional debugging info</li>
                      <li>React DevTools can help identify component issues</li>
                      <li>Error boundaries don't catch async errors or event handlers</li>
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div className="space-y-3">
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <ArrowPathIcon className="mr-2 h-4 w-4" />
            Try Again
          </button>

          {isRoot && (
            <button
              onClick={handleReload}
              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Reload Page
            </button>
          )}
        </div>

        {isRoot && (
          <div className="mt-6 text-xs text-gray-500">
            <p>If this problem persists, please contact support.</p>
            <p className="mt-1">
              Error ID: {error.name}-{Date.now()}
            </p>
            {!environment.isProduction && (
              <p className="mt-1 text-orange-600">[{envName.toUpperCase()} MODE]</p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
