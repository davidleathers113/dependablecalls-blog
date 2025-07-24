import React, { useState } from 'react'
import ErrorBoundary from './ErrorBoundary'
import type { ErrorFallbackProps } from './ErrorBoundary'
import { withErrorBoundary } from './withErrorBoundary'

/**
 * Custom error fallback component example
 */
const CustomErrorFallback: React.FC<ErrorFallbackProps> = ({ error, resetError, level }) => (
  <div className="p-6 bg-red-50 border border-red-200 rounded-lg">
    <h3 className="text-lg font-semibold text-red-900 mb-2">Custom Error Handler ({level})</h3>
    <p className="text-red-700 mb-4">Something went wrong: {error.message}</p>
    <button
      onClick={resetError}
      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
      type="button"
    >
      Reset
    </button>
  </div>
)

/**
 * Component that intentionally throws an error for testing
 */
const ProblematicComponent: React.FC<{ shouldThrow: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('This is a test error from ProblematicComponent')
  }

  return (
    <div className="p-4 bg-green-50 border border-green-200 rounded">
      <p className="text-green-800">This component is working fine!</p>
    </div>
  )
}

/**
 * Component wrapped with HOC error boundary
 */
const ComponentWithHOC = withErrorBoundary(
  ({ message }: { message: string }) => (
    <div className="p-4 bg-blue-50 border border-blue-200 rounded">
      <p className="text-blue-800">{message}</p>
    </div>
  ),
  {
    level: 'component',
    onError: (error, errorInfo) => {
      console.log('HOC Error Handler:', error.message, errorInfo)
    },
  }
)

/**
 * Example component demonstrating various ErrorBoundary usage patterns
 */
export const ErrorBoundaryExample: React.FC = () => {
  const [shouldThrow, setShouldThrow] = useState(false)
  const [resetKey, setResetKey] = useState(0)

  const triggerError = () => setShouldThrow(true)
  const resetError = () => {
    setShouldThrow(false)
    setResetKey((prev) => prev + 1)
  }

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-4">
        <h2 className="text-2xl font-bold">Error Boundary Examples</h2>

        <div className="flex gap-2">
          <button
            onClick={triggerError}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            type="button"
          >
            Trigger Error
          </button>
          <button
            onClick={resetError}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            type="button"
          >
            Reset All
          </button>
        </div>
      </div>

      {/* Example 1: Default Error Boundary */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">1. Default Error Boundary</h3>
        <ErrorBoundary level="section" resetKeys={[resetKey]}>
          <ProblematicComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>

      {/* Example 2: Custom Fallback Component */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">2. Custom Fallback Component</h3>
        <ErrorBoundary
          level="section"
          fallback={CustomErrorFallback}
          resetKeys={[resetKey]}
          onError={(error) => console.log('Custom handler:', error.message)}
        >
          <ProblematicComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>

      {/* Example 3: Component-level Error Boundary */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">3. Component-level Boundary</h3>
        <ErrorBoundary level="component" resetKeys={[resetKey]}>
          <ProblematicComponent shouldThrow={shouldThrow} />
        </ErrorBoundary>
      </div>

      {/* Example 4: HOC Pattern */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">4. Higher-Order Component Pattern</h3>
        <ComponentWithHOC message="This component is wrapped with withErrorBoundary HOC" />
      </div>

      {/* Example 5: Nested Error Boundaries */}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold">5. Nested Error Boundaries</h3>
        <ErrorBoundary level="page" resetKeys={[resetKey]}>
          <div className="p-4 border rounded">
            <p className="mb-4">Page-level boundary</p>
            <ErrorBoundary level="section" resetKeys={[resetKey]}>
              <div className="p-4 bg-gray-50 border rounded">
                <p className="mb-4">Section-level boundary</p>
                <ErrorBoundary level="component" resetKeys={[resetKey]}>
                  <ProblematicComponent shouldThrow={shouldThrow} />
                </ErrorBoundary>
              </div>
            </ErrorBoundary>
          </div>
        </ErrorBoundary>
      </div>
    </div>
  )
}

export default ErrorBoundaryExample
