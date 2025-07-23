import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { captureMessage } from '../../lib/monitoring'

interface ErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
  isRoot?: boolean
}

export function ErrorFallback({ error, resetErrorBoundary, isRoot = false }: ErrorFallbackProps) {
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
          {isRoot
            ? 'We apologize for the inconvenience. The application encountered an unexpected error.'
            : 'This section encountered an error, but the rest of the application should work normally.'}
        </p>

        {import.meta.env.DEV && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-left">
            <h3 className="text-sm font-medium text-red-800 mb-2">Error Details (Development)</h3>
            <pre className="text-xs text-red-700 whitespace-pre-wrap break-words">
              {error.message}
            </pre>
            {error.stack && (
              <details className="mt-2">
                <summary className="text-xs text-red-600 cursor-pointer">Stack Trace</summary>
                <pre className="text-xs text-red-600 mt-1 whitespace-pre-wrap break-words">
                  {error.stack}
                </pre>
              </details>
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
          </div>
        )}
      </div>
    </div>
  )
}
