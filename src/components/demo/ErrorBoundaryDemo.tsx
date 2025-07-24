/**
 * Error Boundary Demo Component
 * This component demonstrates the environment-aware error handling
 * Use this for testing error boundary behavior in different environments
 */

import { useState } from 'react'
import ErrorBoundary from '../common/ErrorBoundary'
import { ErrorFallback } from '../common/FallbackUI'
import { environment, getEnvironmentName } from '../../utils/environment'

// Component that throws different types of errors
function ErrorTrigger({ errorType }: { errorType: string }) {
  if (errorType === 'render') {
    throw new Error('Render Error: Component failed to render properly')
  }

  if (errorType === 'async') {
    setTimeout(() => {
      throw new Error('Async Error: This will not be caught by error boundary')
    }, 100)
  }

  if (errorType === 'type') {
    // This will cause a TypeError
    const obj: unknown = null
    const typedObj = obj as { nonExistent: { property: string } }
    return <div>{typedObj.nonExistent.property}</div>
  }

  if (errorType === 'reference') {
    // This will cause a ReferenceError
    // @ts-expect-error - Intentional error for demo
    return <div>{undefinedVariable}</div>
  }

  return <div>Component rendered successfully</div>
}

export function ErrorBoundaryDemo() {
  const [errorType, setErrorType] = useState<string | null>(null)
  const [showError, setShowError] = useState(false)

  const triggerError = (type: string) => {
    setErrorType(type)
    setShowError(true)
  }

  const resetDemo = () => {
    setErrorType(null)
    setShowError(false)
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">Error Boundary Demo</h1>

      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h2 className="text-lg font-semibold mb-2">Current Environment</h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="font-medium">Environment:</span> {getEnvironmentName()}
          </div>
          <div>
            <span className="font-medium">Technical Details:</span>{' '}
            {environment.showTechnicalDetails ? 'Enabled' : 'Disabled'}
          </div>
          <div>
            <span className="font-medium">Error Display Level:</span>{' '}
            {environment.errorDisplayLevel}
          </div>
          <div>
            <span className="font-medium">Console Logging:</span>{' '}
            {environment.logToConsole ? 'Enabled' : 'Disabled'}
          </div>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="text-lg font-semibold mb-3">Trigger Error Types</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button
            onClick={() => triggerError('render')}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
          >
            Render Error
          </button>
          <button
            onClick={() => triggerError('type')}
            className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 transition-colors"
          >
            Type Error
          </button>
          <button
            onClick={() => triggerError('reference')}
            className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
          >
            Reference Error
          </button>
          <button
            onClick={() => triggerError('async')}
            className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
          >
            Async Error
          </button>
        </div>
        <p className="mt-2 text-sm text-gray-600">
          Note: Async errors cannot be caught by React error boundaries
        </p>
      </div>

      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 min-h-[300px]">
        <h3 className="text-lg font-medium mb-4">Error Boundary Container</h3>

        <ErrorBoundary
          context="ErrorBoundaryDemo Component"
          onError={(error, errorInfo) => {
            console.log('Demo: Error caught by boundary', { error, errorInfo })
          }}
          fallback={
            <ErrorFallback
              title="Demo Error Caught"
              message="This error was caught by the demo error boundary"
              details={errorType ? `Error Type: ${errorType}` : undefined}
              errorCode="DEMO-001"
              onRetry={resetDemo}
              onGoHome={() => (window.location.href = '/')}
              showHomeButton={true}
              retryLabel="Reset Demo"
            />
          }
        >
          {showError && errorType ? (
            <ErrorTrigger errorType={errorType} />
          ) : (
            <div className="text-center text-gray-600">
              <p className="mb-4">Click a button above to trigger an error</p>
              <div className="inline-flex items-center px-4 py-2 bg-green-100 text-green-800 rounded">
                ✓ No errors - Component rendering normally
              </div>
            </div>
          )}
        </ErrorBoundary>
      </div>

      {showError && (
        <div className="mt-4">
          <button
            onClick={resetDemo}
            className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors"
          >
            Reset Demo
          </button>
        </div>
      )}

      <div className="mt-8 p-4 bg-gray-50 rounded-lg">
        <h3 className="font-semibold mb-2">How Error Display Changes by Environment:</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start">
            <span className="font-medium mr-2">Development:</span>
            <span>Full stack traces, component stacks, and debugging hints are shown</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">Staging:</span>
            <span>Error messages are shown but stack traces may be hidden</span>
          </li>
          <li className="flex items-start">
            <span className="font-medium mr-2">Production:</span>
            <span>Only user-friendly messages are shown, no technical details</span>
          </li>
        </ul>
      </div>
    </div>
  )
}

export default ErrorBoundaryDemo
