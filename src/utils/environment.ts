/**
 * Environment detection utilities for the DCE Platform
 * Provides helper functions to determine the current environment
 * and control feature visibility based on environment
 */

/**
 * Check if the application is running in development mode
 * @returns true if in development mode
 */
export function isDevelopment(): boolean {
  return import.meta.env.DEV
}

/**
 * Check if the application is running in production mode
 * @returns true if in production mode
 */
export function isProduction(): boolean {
  return import.meta.env.PROD
}

/**
 * Check if the application is running in test mode
 * @returns true if in test mode
 */
export function isTest(): boolean {
  return import.meta.env.MODE === 'test'
}

/**
 * Check if the application is running in staging mode
 * @returns true if in staging mode
 */
export function isStaging(): boolean {
  return import.meta.env.VITE_ENV === 'staging'
}

/**
 * Determine if technical error details should be shown
 * @returns true if technical details should be displayed
 */
export function shouldShowTechnicalDetails(): boolean {
  // Show technical details in development and staging, hide in production
  return isDevelopment() || isStaging()
}

/**
 * Get the appropriate error display level based on environment
 * @returns 'full' | 'minimal' | 'user-friendly'
 */
export function getErrorDisplayLevel(): 'full' | 'minimal' | 'user-friendly' {
  if (isDevelopment()) {
    return 'full' // Show everything: stack traces, component stacks, etc.
  }

  if (isStaging()) {
    return 'minimal' // Show error messages but not full stack traces
  }

  return 'user-friendly' // Production: show only user-friendly messages
}

/**
 * Check if debug mode is enabled
 * @returns true if debug mode is enabled
 */
export function isDebugEnabled(): boolean {
  return import.meta.env.VITE_DEBUG === 'true' || isDevelopment()
}

/**
 * Get the current environment name
 * @returns environment name as string
 */
export function getEnvironmentName(): string {
  if (isDevelopment()) return 'development'
  if (isStaging()) return 'staging'
  if (isProduction()) return 'production'
  if (isTest()) return 'test'
  return 'unknown'
}

/**
 * Check if we should log errors to console
 * @returns true if errors should be logged to console
 */
export function shouldLogToConsole(): boolean {
  // Always log in development, optionally in staging based on debug flag
  return isDevelopment() || (isStaging() && isDebugEnabled())
}

/**
 * Check if we should send errors to monitoring service (e.g., Sentry)
 * @returns true if errors should be sent to monitoring
 */
export function shouldSendToMonitoring(): boolean {
  // Send to monitoring in production and staging, not in development
  return isProduction() || isStaging()
}

/**
 * Get environment-specific error message
 * @param error - The error object
 * @param fallbackMessage - Fallback message for production
 * @returns Appropriate error message based on environment
 */
export function getEnvironmentErrorMessage(
  error: Error | unknown,
  fallbackMessage = 'An unexpected error occurred. Please try again.'
): string {
  if (shouldShowTechnicalDetails() && error instanceof Error) {
    return error.message
  }
  return fallbackMessage
}

/**
 * Environment configuration object
 */
export const environment = {
  isDevelopment: isDevelopment(),
  isProduction: isProduction(),
  isTest: isTest(),
  isStaging: isStaging(),
  showTechnicalDetails: shouldShowTechnicalDetails(),
  errorDisplayLevel: getErrorDisplayLevel(),
  debugEnabled: isDebugEnabled(),
  name: getEnvironmentName(),
  logToConsole: shouldLogToConsole(),
  sendToMonitoring: shouldSendToMonitoring(),
} as const

export default environment
