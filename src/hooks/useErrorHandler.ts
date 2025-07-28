import { useCallback } from 'react'
import { captureError, addBreadcrumb } from '../lib/monitoring'

export function useErrorHandler() {
  return useCallback((error: Error, context?: string) => {
    // Add breadcrumb for debugging
    addBreadcrumb(
      'Error handler triggered',
      'error',
      'error',
      { context: context || 'useErrorHandler' }
    )

    // Capture the error
    captureError(error, {
      context: context || 'useErrorHandler',
      timestamp: new Date().toISOString()
    })
  }, [])
}