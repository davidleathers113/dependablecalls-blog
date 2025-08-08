import React from 'react'
import { ErrorBoundary } from 'react-error-boundary'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'
import { captureError } from '../../lib/monitoring'

interface SearchErrorFallbackProps {
  error: Error
  resetErrorBoundary: () => void
}

function SearchErrorFallback({ error: _error, resetErrorBoundary }: SearchErrorFallbackProps) {
  return (
    <div className="px-4 py-14 text-center sm:px-14" role="alert" aria-live="assertive">
      <ExclamationTriangleIcon
        className="mx-auto h-6 w-6 text-red-400"
        aria-hidden="true"
      />
      <h3 className="mt-4 text-sm font-semibold text-gray-900">
        Search Unavailable
      </h3>
      <p className="mt-2 text-xs text-gray-500">
        We're having trouble loading search results right now.
      </p>
      <div className="mt-4 flex flex-col gap-2">
        <button
          onClick={resetErrorBoundary}
          className="inline-flex items-center justify-center rounded-md bg-primary-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
          aria-label="Retry search functionality"
        >
          Try Again
        </button>
        <button
          onClick={() => window.location.reload()}
          className="inline-flex items-center justify-center rounded-md bg-gray-100 px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-400"
          aria-label="Refresh the page"
        >
          Refresh Page
        </button>
      </div>
    </div>
  )
}

interface SearchErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ComponentType<SearchErrorFallbackProps>
}

export function SearchErrorBoundary({ 
  children, 
  fallback: Fallback = SearchErrorFallback 
}: SearchErrorBoundaryProps) {
  return (
    <ErrorBoundary
      FallbackComponent={Fallback}
      onError={(error, errorInfo) => {
        // Log error to monitoring service
        captureError(error, {
          errorBoundary: 'search-boundary',
          componentStack: errorInfo.componentStack,
          context: 'search-functionality',
          tags: {
            feature: 'global-search',
            severity: 'high'
          }
        })
        
        // Log to console for development
        if (import.meta.env.DEV) {
          console.error('Search Error:', error)
          console.error('Error Info:', errorInfo)
        }
      }}
      onReset={() => {
        // Clear any cached search state if needed
        if (typeof window !== 'undefined' && window.localStorage) {
          try {
            window.localStorage.removeItem('search-cache')
          } catch (_e) {
            // Ignore localStorage errors
          }
        }
      }}
    >
      {children}
    </ErrorBoundary>
  )
}