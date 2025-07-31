import * as Sentry from '@sentry/react'

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal'

export interface LogContext {
  userId?: string
  sessionId?: string
  requestId?: string
  component?: string
  action?: string
  paymentIntentId?: string
  chargeId?: string
  accountId?: string
  payoutId?: string
  transferId?: string
  // Additional properties for webhook handler
  type?: string
  id?: string
  eventId?: string
  eventType?: string
  error?: string
  amount?: number
  buyerId?: string
  reason?: string
  chargesEnabled?: boolean
  payoutsEnabled?: boolean
  arrivalDate?: number
  failureCode?: string | null
  failureMessage?: string | null
  destination?: string
  metadata?: Record<string, unknown>
  // Blog analytics specific
  postSlug?: string
  query?: string
  metricType?: string
  testName?: string
  // Allow additional properties
  [key: string]: unknown
}

export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  error?: Error
  stack?: string
}

class Logger {
  private logBuffer: LogEntry[] = []
  private maxBufferSize = 100
  private flushInterval = 5000 // 5 seconds
  private flushTimer?: NodeJS.Timeout
  private endpoint = import.meta.env.VITE_LOG_ENDPOINT || '/api/logs'

  constructor() {
    // Start flush timer
    this.startFlushTimer()

    // Flush logs on page unload
    if (typeof window !== 'undefined') {
      window.addEventListener('beforeunload', () => this.flush())

      // Also handle visibility change for mobile
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') {
          this.flush()
        }
      })
    }
  }

  private startFlushTimer() {
    this.flushTimer = setInterval(() => {
      if (this.logBuffer.length > 0) {
        this.flush()
      }
    }, this.flushInterval)
  }

  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error
  ): LogEntry {
    return {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: {
        ...context,
        userAgent: navigator.userAgent,
        url: window.location.href,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight,
        },
      },
      error: error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : undefined,
    } as LogEntry
  }

  private shouldLog(level: LogLevel): boolean {
    const levels = ['debug', 'info', 'warn', 'error', 'fatal']
    const currentLevel = import.meta.env.VITE_LOG_LEVEL || 'info'
    const currentLevelIndex = levels.indexOf(currentLevel)
    const messageLevelIndex = levels.indexOf(level)

    return messageLevelIndex >= currentLevelIndex
  }

  private addToBuffer(entry: LogEntry) {
    this.logBuffer.push(entry)

    // Flush if buffer is full
    if (this.logBuffer.length >= this.maxBufferSize) {
      this.flush()
    }
  }

  private async flush() {
    if (this.logBuffer.length === 0) return

    const logs = [...this.logBuffer]
    this.logBuffer = []

    try {
      // Send logs to backend
      if (import.meta.env.PROD) {
        await fetch(this.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ logs }),
          keepalive: true, // Ensure request completes even on page unload
        })
      }
    } catch (error) {
      // Failed to send logs, re-add to buffer if not too large
      if (this.logBuffer.length + logs.length < this.maxBufferSize * 2) {
        this.logBuffer = [...logs, ...this.logBuffer]
      }
      console.error('Failed to flush logs:', error)
    }
  }

  debug(message: string, context?: LogContext) {
    if (!this.shouldLog('debug')) return

    const entry = this.createLogEntry('debug', message, context)
    console.debug(message, context)
    this.addToBuffer(entry)
  }

  info(message: string, context?: LogContext) {
    if (!this.shouldLog('info')) return

    const entry = this.createLogEntry('info', message, context)
    console.info(message, context)
    this.addToBuffer(entry)

    // Add breadcrumb to Sentry
    Sentry.addBreadcrumb({
      message,
      level: 'info',
      category: context?.component || 'general',
      data: context?.metadata,
    })
  }

  warn(message: string, context?: LogContext) {
    if (!this.shouldLog('warn')) return

    const entry = this.createLogEntry('warn', message, context)
    console.warn(message, context)
    this.addToBuffer(entry)

    // Add breadcrumb to Sentry
    Sentry.addBreadcrumb({
      message,
      level: 'warning',
      category: context?.component || 'general',
      data: context?.metadata,
    })
  }

  error(message: string, error?: Error, context?: LogContext) {
    if (!this.shouldLog('error')) return

    const entry = this.createLogEntry('error', message, context, error)
    console.error(message, error, context)
    this.addToBuffer(entry)

    // Send to Sentry
    if (error) {
      Sentry.captureException(error, {
        contexts: {
          log: context as Record<string, unknown>,
        },
      })
    } else {
      Sentry.captureMessage(message, 'error')
    }
  }

  fatal(message: string, error?: Error, context?: LogContext) {
    const entry = this.createLogEntry('fatal', message, context, error)
    console.error('FATAL:', message, error, context)
    this.addToBuffer(entry)

    // Immediately flush on fatal errors
    this.flush()

    // Send to Sentry with high priority
    if (error) {
      Sentry.captureException(error, {
        level: 'fatal',
        contexts: {
          log: context as Record<string, unknown>,
        },
      })
    } else {
      Sentry.captureMessage(message, 'fatal')
    }
  }

  // Structured logging for specific events
  logApiCall(endpoint: string, method: string, status: number, duration: number, error?: Error) {
    const context: LogContext = {
      component: 'api',
      action: `${method} ${endpoint}`,
      metadata: {
        endpoint,
        method,
        status,
        duration,
      },
    }

    if (error || status >= 400) {
      this.error(`API call failed: ${method} ${endpoint} - ${status}`, error, context)
    } else if (duration > 1000) {
      this.warn(`Slow API call: ${method} ${endpoint} - ${duration}ms`, context)
    } else {
      this.info(`API call: ${method} ${endpoint} - ${status}`, context)
    }
  }

  logUserAction(action: string, metadata?: Record<string, unknown>) {
    this.info(`User action: ${action}`, {
      component: 'user-interaction',
      action,
      metadata,
    })
  }

  logPerformance(metric: string, value: number, metadata?: Record<string, unknown>) {
    const context: LogContext = {
      component: 'performance',
      action: metric,
      metadata: {
        ...metadata,
        value,
      },
    }

    if (metric === 'page-load' && value > 3000) {
      this.warn(`Slow page load: ${value}ms`, context)
    } else {
      this.info(`Performance metric: ${metric} = ${value}`, context)
    }
  }

  logSecurityEvent(
    event: string,
    severity: 'low' | 'medium' | 'high',
    details?: Record<string, unknown>
  ) {
    const context: LogContext = {
      component: 'security',
      action: event,
      metadata: {
        severity,
        ...details,
      },
    }

    if (severity === 'high') {
      this.error(`Security event: ${event}`, undefined, context)
    } else if (severity === 'medium') {
      this.warn(`Security event: ${event}`, context)
    } else {
      this.info(`Security event: ${event}`, context)
    }
  }

  // Clean up
  destroy() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
    }
    this.flush()
  }
}

// Export singleton instance
export const logger = new Logger()

// Export for use in error boundaries
export function logErrorBoundary(error: Error, errorInfo: React.ErrorInfo) {
  logger.error('React Error Boundary', error, {
    component: 'error-boundary',
    metadata: {
      componentStack: errorInfo.componentStack,
    },
  })
}

// Export for use in async error handlers
export function logUnhandledRejection(event: PromiseRejectionEvent) {
  logger.error('Unhandled Promise Rejection', new Error(event.reason), {
    component: 'global-error-handler',
    metadata: {
      reason: event.reason,
      promise: event.promise,
    },
  })
}

// Set up global error handlers
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', logUnhandledRejection)

  window.addEventListener('error', (event) => {
    logger.error('Global error', event.error || new Error(event.message), {
      component: 'global-error-handler',
      metadata: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
      },
    })
  })
}
