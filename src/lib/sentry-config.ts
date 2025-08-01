import * as Sentry from '@sentry/react'
import React from 'react'
import {
  useLocation,
  useNavigationType,
  createRoutesFromChildren,
  matchRoutes,
} from 'react-router-dom'

/**
 * Initialize Sentry with React Router v6 integration and advanced error filtering
 * 
 * This configuration includes:
 * - BrowserTracing for React Router v6
 * - Replay sessions for debugging
 * - Environment-specific sample rates
 * - Filtering of non-actionable errors (ad blockers, network failures)
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN

  if (!dsn) {
    console.warn('Sentry DSN not configured, monitoring disabled')
    return
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    
    integrations: [
      // React Router v6 integration for performance monitoring
      Sentry.reactRouterV6BrowserTracingIntegration({
        useEffect: React.useEffect,
        useLocation,
        useNavigationType,
        createRoutesFromChildren,
        matchRoutes,
      }),
      
      // Session replay for debugging
      Sentry.replayIntegration({
        maskAllText: false, // Show text content in replays
        blockAllMedia: false, // Show media content in replays
      }),
    ],
    
    // Performance monitoring sample rates
    tracesSampleRate: import.meta.env.MODE === 'production' ? 0.1 : 1.0,
    
    // Session replay sample rates
    replaysSessionSampleRate: 0.1, // 10% of sessions
    replaysOnErrorSampleRate: 1.0, // 100% of sessions with errors
    
    // Release tracking
    release: import.meta.env.VITE_APP_VERSION || 'unknown',
    
    // Error filtering
    beforeSend(event, hint) {
      // Filter out non-actionable errors
      if (event.exception) {
        const error = hint.originalException as Error | undefined
        
        // Filter out network errors from ad blockers
        if (error?.message?.includes('Failed to fetch')) {
          return null
        }
        
        // Filter out browser extension errors
        if (
          error?.message?.includes('chrome-extension://') ||
          error?.message?.includes('moz-extension://') ||
          error?.message?.includes('safari-extension://')
        ) {
          return null
        }
        
        // Filter out ResizeObserver errors (common and non-actionable)
        if (error?.message?.includes('ResizeObserver loop limit exceeded')) {
          return null
        }
        
        // Filter out canceled requests
        if (error?.name === 'AbortError') {
          return null
        }
        
        // Filter out common third-party script errors
        const thirdPartyPatterns = [
          'Script error',
          'Non-Error promise rejection captured',
          'Network request failed',
          'Load failed',
          'NetworkError',
        ]
        
        if (
          thirdPartyPatterns.some(pattern => 
            error?.message?.includes(pattern) || 
            event.exception?.values?.[0]?.value?.includes(pattern)
          )
        ) {
          // Log to console in development for debugging
          if (import.meta.env.MODE === 'development') {
            console.warn('Filtered third-party error:', error)
          }
          return null
        }
      }
      
      // Add additional context for better debugging
      if (event.request) {
        event.request.headers = {
          ...event.request.headers,
          'X-App-Version': import.meta.env.VITE_APP_VERSION || 'unknown',
          'X-Environment': import.meta.env.MODE,
        }
      }
      
      return event
    },
    
    // Transaction filtering
    beforeSendTransaction(transaction) {
      // Filter out health check endpoints
      if (transaction.transaction?.includes('/health') || 
          transaction.transaction?.includes('/ping')) {
        return null
      }
      
      return transaction
    },
    
    // Additional configuration
    ignoreErrors: [
      // Browser-specific errors to ignore
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Network errors
      'NetworkError',
      'Failed to fetch',
      // Browser extension errors
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
    ],
    
    // Don't send default PII
    sendDefaultPii: false,
    
    // Sampling configuration
    sampleRate: 1.0, // Capture 100% of errors
    
    // Set initial scope
    initialScope: {
      tags: {
        component: 'dce-website',
        platform: 'web',
        framework: 'react',
        bundler: 'vite',
      },
      user: {
        // Will be populated after authentication
        id: 'anonymous',
      },
    },
  })
}

/**
 * Set authenticated user context for better error tracking
 */
export function setSentryUser(user: {
  id: string
  email?: string
  role?: string
  organizationId?: string
}): void {
  Sentry.setUser({
    id: user.id,
    email: user.email,
    // Custom attributes
    role: user.role,
    organization_id: user.organizationId,
  })
}

/**
 * Clear user context on logout
 */
export function clearSentryUser(): void {
  Sentry.setUser(null)
}

/**
 * Add custom breadcrumb for debugging
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
 * Capture exception with additional context
 */
export function captureError(
  error: Error | unknown,
  context?: Record<string, unknown>
): void {
  Sentry.withScope(scope => {
    if (context) {
      scope.setContext('error_details', context)
    }
    
    // Add user agent info
    scope.setContext('browser', {
      userAgent: navigator.userAgent,
      language: navigator.language,
      platform: navigator.platform,
      cookieEnabled: navigator.cookieEnabled,
      onLine: navigator.onLine,
    })
    
    // Add app state
    scope.setContext('app_state', {
      url: window.location.href,
      referrer: document.referrer,
      timestamp: new Date().toISOString(),
    })
    
    Sentry.captureException(error)
  })
}

/**
 * Track custom events for analytics
 */
export function trackEvent(
  eventName: string,
  data?: Record<string, unknown>
): void {
  addBreadcrumb(`Event: ${eventName}`, 'event', 'info', data)
  
  // Also send to Sentry as a custom event if important
  if (data?.important) {
    Sentry.captureMessage(`Custom Event: ${eventName}`, 'info')
  }
}

/**
 * Performance monitoring wrapper for async operations
 */
export async function withPerformanceMonitoring<T>(
  transactionName: string,
  operation: () => Promise<T>,
  context?: Record<string, unknown>
): Promise<T> {
  return await Sentry.startSpan(
    {
      name: transactionName,
      op: 'function',
      attributes: context ? (Object.fromEntries(
        Object.entries(context).map(([k, v]) => [k, String(v)])
      ) as Record<string, string>) : undefined,
    },
    async () => {
      try {
        return await operation()
      } catch (error) {
        captureError(error, { transaction: transactionName, ...context })
        throw error
      }
    }
  )
}

/**
 * React component performance profiler
 */
export function withComponentProfiling<P extends object>(
  Component: React.ComponentType<P>,
  componentName: string
): React.ComponentType<P> {
  return Sentry.withProfiler(Component, { name: componentName })
}

// Export Sentry React components for use in the app
export const SentryErrorBoundary = Sentry.ErrorBoundary
export const SentryProfiler = Sentry.Profiler
export const SentryWithProfiler = Sentry.withProfiler