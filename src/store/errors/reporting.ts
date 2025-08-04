/**
 * DCE Error Reporting System
 * 
 * Integrates error handling with monitoring systems, providing:
 * - Error aggregation and deduplication
 * - Integration with Sentry and other monitoring services
 * - Real-time error tracking and alerting
 * - Performance impact analysis
 * - User impact assessment
 */

import { DCEError, MonitoringError, ErrorContext, ErrorSeverity } from './errorTypes'
import { ErrorHandlingContext, ErrorHandlingConfig } from '../middleware/errorHandling'
import { RecoveryManager } from './recovery'

// Sentry Integration Types
// =======================

interface SentryBrowserIntegration {
  captureException: (error: Error, context?: {
    tags?: Record<string, string>
    extra?: Record<string, unknown>
  }) => void
}

interface WindowWithSentry extends Window {
  Sentry?: SentryBrowserIntegration
}

// Reporting Configuration
// ======================

export interface ErrorReportingConfig {
  /** Enable error reporting */
  enabled: boolean
  
  /** Sentry DSN for error reporting */
  sentryDsn?: string
  
  /** Enable console logging in development */
  enableConsoleLogging: boolean
  
  /** Enable performance impact tracking */
  enablePerformanceTracking: boolean
  
  /** Sample rate for error reporting (0-1) */
  sampleRate: number
  
  /** Maximum number of errors to cache locally */
  maxCachedErrors: number
  
  /** Batch size for sending errors */
  batchSize: number
  
  /** Batch timeout in milliseconds */
  batchTimeout: number
  
  /** Custom error filters */
  filters: ErrorFilter[]
  
  /** Custom error transformers */
  transformers: ErrorTransformer[]
  
  /** Integration endpoints */
  endpoints: {
    sentry?: string
    webhook?: string
    analytics?: string
  }
}

export interface ErrorFilter {
  name: string
  predicate: (error: DCEError, context: ErrorContext) => boolean
}

export interface ErrorTransformer {
  name: string
  transform: (error: DCEError, context: ErrorContext) => Partial<MonitoringError>
}

export interface ErrorReport {
  errors: MonitoringError[]
  summary: ErrorSummary
  trends: ErrorTrends
  userImpact: UserImpactAnalysis
  performanceImpact: PerformanceImpactAnalysis
}

export interface ErrorSummary {
  total: number
  byType: Record<string, number>
  bySeverity: Record<ErrorSeverity, number>
  byStore: Record<string, number>
  resolved: number
  unresolved: number
  timeRange: {
    start: number
    end: number
  }
}

export interface ErrorTrends {
  hourly: number[]
  daily: number[]
  weekly: number[]
  topErrors: Array<{
    error: MonitoringError
    count: number
    trend: 'increasing' | 'decreasing' | 'stable'
  }>
}

export interface UserImpactAnalysis {
  affectedUsers: number
  totalUsers: number
  impactPercentage: number
  criticalPathsAffected: string[]
  recoveryRate: number
}

export interface PerformanceImpactAnalysis {
  averageResponseTime: number
  responseTimeIncrease: number
  errorRate: number
  throughputImpact: number
  resourceUsageImpact: number
}

// Default Configuration
// ====================

const DEFAULT_REPORTING_CONFIG: ErrorReportingConfig = {
  enabled: true,
  enableConsoleLogging: process.env.NODE_ENV === 'development',
  enablePerformanceTracking: true,
  sampleRate: 1.0,
  maxCachedErrors: 1000,
  batchSize: 10,
  batchTimeout: 5000,
  filters: [],
  transformers: [],
  endpoints: {},
}

// Error Reporter
// =============

export class ErrorReporter {
  private config: ErrorReportingConfig
  private errorQueue: MonitoringError[] = []
  private batchTimer: NodeJS.Timeout | null = null
  private errorCache = new Map<string, CachedErrorInfo>()
  private metricsCollector?: MetricsCollector

  constructor(private errorHandlingConfig: ErrorHandlingConfig) {
    this.config = {
      ...DEFAULT_REPORTING_CONFIG,
      ...this.extractReportingConfig(errorHandlingConfig),
    }

    if (this.config.enablePerformanceTracking) {
      this.metricsCollector = new MetricsCollector()
    }

    // Initialize external integrations
    this.initializeIntegrations()
  }

  async report(error: DCEError, context: ErrorHandlingContext): Promise<void> {
    if (!this.config.enabled) return

    const monitoringError = error.toMonitoringError()
    
    // Apply filters
    if (!this.shouldReport(error, context)) {
      return
    }

    // Apply transformers
    const transformedError = this.applyTransformers(error, monitoringError, context)

    // Add to cache for deduplication
    const errorKey = this.generateErrorKey(transformedError)
    const cachedInfo = this.errorCache.get(errorKey)
    
    if (cachedInfo) {
      cachedInfo.count++
      cachedInfo.lastOccurrence = Date.now()
      cachedInfo.contexts.push(context)
      
      // Update the cached error with latest context
      transformedError.context = {
        ...transformedError.context,
        occurrenceCount: cachedInfo.count,
        firstOccurrence: cachedInfo.firstOccurrence,
        lastOccurrence: cachedInfo.lastOccurrence,
      }
    } else {
      this.errorCache.set(errorKey, {
        error: transformedError,
        count: 1,
        firstOccurrence: Date.now(),
        lastOccurrence: Date.now(),
        contexts: [context],
      })
    }

    // Add to queue for batch processing
    this.errorQueue.push(transformedError)

    // Track performance impact
    if (this.metricsCollector) {
      this.metricsCollector.recordError(transformedError, context)
    }

    // Console logging in development
    if (this.config.enableConsoleLogging) {
      this.logToConsole(error, transformedError, context)
    }

    // Process queue if batch size reached or start timer
    if (this.errorQueue.length >= this.config.batchSize) {
      await this.processBatch()
    } else if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.processBatch(), this.config.batchTimeout)
    }

    // Cleanup old cached errors
    this.cleanupCache()
  }

  async generateReport(timeRange?: { start: number; end: number }): Promise<ErrorReport> {
    const errors = Array.from(this.errorCache.values()).map(cached => cached.error)
    const filteredErrors = timeRange 
      ? errors.filter(e => e.timestamp >= timeRange.start && e.timestamp <= timeRange.end)
      : errors

    return {
      errors: filteredErrors,
      summary: this.generateSummary(filteredErrors, timeRange),
      trends: this.analyzeTrends(filteredErrors),
      userImpact: this.analyzeUserImpact(filteredErrors),
      performanceImpact: this.analyzePerformanceImpact(filteredErrors),
    }
  }

  private shouldReport(error: DCEError, context: ErrorHandlingContext): boolean {
    // Sample rate check
    if (Math.random() > this.config.sampleRate) return false

    // Apply custom filters
    for (const filter of this.config.filters) {
      if (!filter.predicate(error, context)) return false
    }

    return true
  }

  private applyTransformers(
    originalError: DCEError, 
    monitoringError: MonitoringError, 
    context: ErrorHandlingContext
  ): MonitoringError {
    let transformedError = { ...monitoringError }

    for (const transformer of this.config.transformers) {
      const transformation = transformer.transform(originalError, context)
      transformedError = { ...transformedError, ...transformation }
    }

    return transformedError
  }

  private generateErrorKey(error: MonitoringError): string {
    // Create a key for deduplication based on error type, message, and location
    const keyComponents = [
      error.type,
      error.message,
      error.context.storeName,
      error.context.actionType,
      error.stack?.split('\n')[0] || '',
    ]
    
    return keyComponents.filter(Boolean).join('|')
  }

  private async processBatch(): Promise<void> {
    if (this.errorQueue.length === 0) return

    const batch = this.errorQueue.splice(0, this.config.batchSize)
    
    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer)
      this.batchTimer = null
    }

    try {
      // Send to all configured endpoints
      await Promise.allSettled([
        this.sendToSentry(batch),
        this.sendToWebhook(batch),
        this.sendToAnalytics(batch),
      ])
    } catch (error) {
      console.warn('Error reporting batch failed:', error)
      
      // Re-queue errors if sending failed (with limit)
      if (this.errorQueue.length < this.config.maxCachedErrors) {
        this.errorQueue.unshift(...batch)
      }
    }
  }

  private async sendToSentry(errors: MonitoringError[]): Promise<void> {
    if (!this.config.sentryDsn && !this.config.endpoints.sentry) return

    // In a real implementation, this would use the Sentry SDK
    console.log('Sending to Sentry:', errors.length, 'errors')

    const windowWithSentry = window as WindowWithSentry
    if (typeof window !== 'undefined' && windowWithSentry.Sentry) {
      for (const error of errors) {
        windowWithSentry.Sentry.captureException(new Error(error.message), {
          tags: {
            storeName: error.context.storeName,
            errorType: error.type,
            severity: error.severity,
          },
          extra: error.context,
        })
      }
    }
  }

  private async sendToWebhook(errors: MonitoringError[]): Promise<void> {
    if (!this.config.endpoints.webhook) return

    try {
      await fetch(this.config.endpoints.webhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors,
          timestamp: Date.now(),
          source: 'dce-frontend',
        }),
      })
    } catch (error) {
      console.warn('Webhook error reporting failed:', error)
    }
  }

  private async sendToAnalytics(errors: MonitoringError[]): Promise<void> {
    if (!this.config.endpoints.analytics) return

    // Send to analytics platform (e.g., Google Analytics, Mixpanel)
    const analyticsEvents = errors.map(error => ({
      event: 'error_occurred',
      properties: {
        error_type: error.type,
        error_severity: error.severity,
        store_name: error.context.storeName,
        action_type: error.context.actionType,
        timestamp: error.timestamp,
      },
    }))

    try {
      await fetch(this.config.endpoints.analytics, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: analyticsEvents }),
      })
    } catch (error) {
      console.warn('Analytics error reporting failed:', error)
    }
  }

  private logToConsole(
    originalError: DCEError, 
    monitoringError: MonitoringError, 
    context: ErrorHandlingContext
  ): void {
    const logLevel = this.getConsoleLogLevel(monitoringError.severity)
    const logMethod = console[logLevel] || console.error

    logMethod.call(console, 
      `[DCE Error] ${monitoringError.type.toUpperCase()}:`,
      {
        message: monitoringError.message,
        store: context.storeName,
        action: context.actionName,
        severity: monitoringError.severity,
        recoverable: originalError.recoverable,
        retryable: originalError.retryable,
        context: monitoringError.context,
        stack: monitoringError.stack,
      }
    )
  }

  private getConsoleLogLevel(severity: ErrorSeverity): 'log' | 'warn' | 'error' {
    switch (severity) {
      case 'low': return 'log'
      case 'medium': return 'warn'
      case 'high':
      case 'critical': return 'error'
    }
  }

  private generateSummary(errors: MonitoringError[], timeRange?: { start: number; end: number }): ErrorSummary {
    const byType: Record<string, number> = {}
    const bySeverity: Record<ErrorSeverity, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    const byStore: Record<string, number> = {}
    let resolved = 0

    for (const error of errors) {
      byType[error.type] = (byType[error.type] || 0) + 1
      bySeverity[error.severity]++
      
      if (error.context.storeName) {
        byStore[error.context.storeName] = (byStore[error.context.storeName] || 0) + 1
      }
      
      if (error.resolved) resolved++
    }

    return {
      total: errors.length,
      byType,
      bySeverity,
      byStore,
      resolved,
      unresolved: errors.length - resolved,
      timeRange: timeRange || {
        start: Math.min(...errors.map(e => e.timestamp)),
        end: Math.max(...errors.map(e => e.timestamp)),
      },
    }
  }

  private analyzeTrends(errors: MonitoringError[]): ErrorTrends {
    // Simplified trend analysis - in production this would be more sophisticated
    const now = Date.now()
    const oneHour = 60 * 60 * 1000
    const oneDay = 24 * oneHour
    const oneWeek = 7 * oneDay

    const hourly = Array(24).fill(0)
    const daily = Array(7).fill(0)
    const weekly = Array(4).fill(0)

    for (const error of errors) {
      const age = now - error.timestamp
      
      if (age < 24 * oneHour) {
        const hourIndex = Math.floor(age / oneHour)
        if (hourIndex < hourly.length) hourly[hourIndex]++
      }
      
      if (age < 7 * oneDay) {
        const dayIndex = Math.floor(age / oneDay)
        if (dayIndex < daily.length) daily[dayIndex]++
      }
      
      if (age < 4 * oneWeek) {
        const weekIndex = Math.floor(age / oneWeek)
        if (weekIndex < weekly.length) weekly[weekIndex]++
      }
    }

    const topErrors = this.findTopErrors(errors)

    return { hourly, daily, weekly, topErrors }
  }

  private findTopErrors(errors: MonitoringError[]): ErrorTrends['topErrors'] {
    const errorCounts = new Map<string, { error: MonitoringError; count: number }>()
    
    for (const error of errors) {
      const key = this.generateErrorKey(error)
      const existing = errorCounts.get(key)
      if (existing) {
        existing.count++
      } else {
        errorCounts.set(key, { error, count: 1 })
      }
    }

    return Array.from(errorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(({ error, count }) => ({
        error,
        count,
        trend: 'stable' as const, // Simplified - would calculate actual trend
      }))
  }

  private analyzeUserImpact(errors: MonitoringError[]): UserImpactAnalysis {
    const affectedUsers = new Set(errors.map(e => e.context.userId).filter(Boolean)).size
    const criticalPathsAffected = errors
      .filter(e => e.severity === 'high' || e.severity === 'critical')
      .map(e => e.context.actionType)
      .filter(Boolean)
      .filter((action, index, array) => array.indexOf(action) === index) as string[]

    const recoveryRate = errors.length > 0 
      ? errors.filter(e => e.resolved).length / errors.length 
      : 1

    return {
      affectedUsers,
      totalUsers: 1000, // Would be tracked from analytics
      impactPercentage: affectedUsers / 1000 * 100,
      criticalPathsAffected,
      recoveryRate,
    }
  }

  private analyzePerformanceImpact(_errors: MonitoringError[]): PerformanceImpactAnalysis {  
    // Would integrate with performance monitoring data
    return {
      averageResponseTime: 0,
      responseTimeIncrease: 0,
      errorRate: 0,
      throughputImpact: 0,
      resourceUsageImpact: 0,
    }
  }

  private cleanupCache(): void {
    if (this.errorCache.size <= this.config.maxCachedErrors) return

    // Remove oldest entries
    const entries = Array.from(this.errorCache.entries())
    entries.sort((a, b) => a[1].lastOccurrence - b[1].lastOccurrence)
    
    const toRemove = entries.slice(0, entries.length - this.config.maxCachedErrors)
    for (const [key] of toRemove) {
      this.errorCache.delete(key)
    }
  }

  private extractReportingConfig(config: ErrorHandlingConfig): Partial<ErrorReportingConfig> {
    return {
      enabled: config.enableReporting,
      enableConsoleLogging: config.development?.logErrors,
    }
  }

  private initializeIntegrations(): void {
    // Initialize Sentry if configured
    if (this.config.sentryDsn && typeof window !== 'undefined') {
      // In a real implementation, this would initialize Sentry SDK
      console.log('Sentry integration initialized')
    }
  }
}

// Metrics Collector for Performance Impact
// =======================================

class MetricsCollector {
  private errorMetrics = new Map<string, ErrorMetrics>()

  recordError(error: MonitoringError, context: ErrorHandlingContext): void {
    const key = `${context.storeName}:${error.type}`
    const metrics = this.errorMetrics.get(key) || {
      count: 0,
      totalResponseTime: 0,
      averageResponseTime: 0,
      lastRecorded: Date.now(),
    }

    metrics.count++
    metrics.lastRecorded = Date.now()
    
    this.errorMetrics.set(key, metrics)
  }

  getMetrics(): Map<string, ErrorMetrics> {
    return new Map(this.errorMetrics)
  }
}

// Supporting Types
// ===============

interface CachedErrorInfo {
  error: MonitoringError
  count: number
  firstOccurrence: number
  lastOccurrence: number
  contexts: ErrorHandlingContext[]
}

interface ErrorMetrics {
  count: number
  totalResponseTime: number
  averageResponseTime: number
  lastRecorded: number
}

// Utility Functions
// ================

export async function reportError(
  error: DCEError, 
  context: Partial<ErrorContext> = {}
): Promise<void> {
  // Global error reporting function
  const reporter = getGlobalErrorReporter()
  if (reporter) {
    const handlingContext: ErrorHandlingContext = {
      storeName: context.storeName || 'global',
      actionName: context.actionType,
      attempt: 0,
      recoveryManager: new RecoveryManager({
        maxAttempts: 3,
        baseDelay: 1000,
      }),
      reporter,
    }
    
    await reporter.report(error, handlingContext)
  }
}

let globalReporter: ErrorReporter | null = null

export function setGlobalErrorReporter(reporter: ErrorReporter): void {
  globalReporter = reporter
}

export function getGlobalErrorReporter(): ErrorReporter | null {
  return globalReporter
}

// Default error filters and transformers
// =====================================

export const DEFAULT_ERROR_FILTERS: ErrorFilter[] = [
  {
    name: 'excludeValidationErrors',
    predicate: (error) => !error.message.includes('validation'),
  },
  {
    name: 'excludeNetworkTimeouts',
    predicate: (error) => !error.message.includes('timeout'),
  },
]

export const DEFAULT_ERROR_TRANSFORMERS: ErrorTransformer[] = [
  {
    name: 'addUserAgent',
    transform: (error, context) => ({
      context: {
        ...context,
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      },
    }),
  },
  {
    name: 'addTimestamp',
    transform: () => ({
      timestamp: Date.now(),
    }),
  },
]

// Export types
export type {
  ErrorReportingConfig,
  ErrorFilter,
  ErrorTransformer,
  ErrorReport,
  ErrorSummary,
  ErrorTrends,
  UserImpactAnalysis,
  PerformanceImpactAnalysis,
}