/**
 * Utility functions for safe error handling and type guards
 */

/**
 * Type guard to check if a value is an Error
 */
export function isError(error: unknown): error is Error {
  return error instanceof Error
}

/**
 * Safely converts unknown error to Error instance
 */
export function toError(error: unknown): Error {
  if (isError(error)) {
    return error
  }

  if (typeof error === 'string') {
    return new Error(error)
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return new Error(String(error.message))
  }

  return new Error('Unknown error occurred')
}

/**
 * Safely extracts error message from unknown error
 */
export function getErrorMessage(error: unknown): string {
  if (isError(error)) {
    return error.message
  }

  if (typeof error === 'string') {
    return error
  }

  if (error && typeof error === 'object' && 'message' in error) {
    return String(error.message)
  }

  return 'Unknown error occurred'
}

/**
 * Creates a standardized error context for logging
 */
export function createErrorContext(error: unknown): {
  error: Error
  message: string
} {
  const errorInstance = toError(error)
  return {
    error: errorInstance,
    message: errorInstance.message,
  }
}
