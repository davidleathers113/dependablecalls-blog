import * as Sentry from '@sentry/react'
import { Routes, Route } from 'react-router-dom'

/**
 * Initialize Sentry monitoring for error tracking and performance monitoring
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  const environment = import.meta.env.MODE

  if (!dsn) {
    console.warn('Sentry DSN not configured, monitoring disabled')
    return
  }

  Sentry.init({
    dsn,
    environment,
    integrations: [
      Sentry.browserTracingIntegration({
        // Set up automatic route change tracking for React Router
        enableInp: true,
      }),
      Sentry.replayIntegration({
        // Mask sensitive data
        maskAllText: true,
        blockAllMedia: true,
      }),
    ],

    // Performance monitoring
    tracesSampleRate: environment === 'production' ? 0.1 : 1.0,

    // Session replay
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',

    // Error filtering
    beforeSend(event, hint) {
      // Filter out development errors
      if (environment === 'development') {
        console.error('Sentry event:', event, hint)
        return null
      }

      // Filter out network errors that are not actionable
      if (event.exception) {
        const error = hint.originalException
        if (error instanceof TypeError && error.message.includes('NetworkError')) {
          return null
        }
      }

      return event
    },

    // Additional context
    initialScope: {
      tags: {
        component: 'dce-website',
        platform: 'web',
      },
    },
  })
}

/**
 * Set user context for error tracking
 */
export function setSentryUser(user: { id: string; email?: string; role?: string }): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    role: user.role,
  })
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string = 'custom',
  level: Sentry.SeverityLevel = 'info',
  data?: Record<string, unknown>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  })
}

/**
 * Capture exception manually
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('error_context', context)
    }
    Sentry.captureException(error)
  })
}

/**
 * Capture custom message
 */
export function captureMessage(
  message: string,
  level: Sentry.SeverityLevel = 'info',
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    if (context) {
      scope.setContext('message_context', context)
    }
    scope.setLevel(level)
    Sentry.captureMessage(message)
  })
}

/**
 * Performance monitoring for critical operations
 */
export function startTransaction(name: string, operation: string = 'navigation'): unknown {
  return Sentry.startSpan(
    {
      name,
      op: operation,
    },
    () => ({})
  )
}

/**
 * Track API call performance
 */
export function trackApiCall<T>(apiName: string, apiCall: () => Promise<T>): Promise<T> {
  const transaction = startTransaction(apiName, 'http.client')

  return apiCall()
    .then((result) => {
      ;(transaction as { setStatus?: (status: string) => void })?.setStatus?.('ok')
      return result
    })
    .catch((error) => {
      ;(transaction as { setStatus?: (status: string) => void })?.setStatus?.('internal_error')
      captureError(error, { apiName })
      throw error
    })
    .finally(() => {
      ;(transaction as { finish?: () => void })?.finish?.()
    })
}

// React integration components
export const SentryRoutes = Sentry.withSentryRouting(Routes)
export const SentryRoute = Sentry.withSentryRouting(Route)
export const SentryErrorBoundary = Sentry.ErrorBoundary
