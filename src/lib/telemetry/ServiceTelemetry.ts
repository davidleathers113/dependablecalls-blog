/**
 * Service Layer Telemetry Integration
 * 
 * Provides comprehensive telemetry and performance monitoring for service operations:
 * - Operation timing and performance metrics
 * - Error tracking and classification
 * - Cache hit/miss ratios
 * - Business metric tracking
 * - Integration with monitoring systems (Sentry, DataDog, etc.)
 * - Custom dashboards and alerting
 */

import { StoreError, type StoreErrorCode } from '../errors/StoreError'
import type { ServiceMetrics } from '../../services/base/BaseService'

// Telemetry Configuration
// =======================

export interface TelemetryConfig {
  /** Enable telemetry collection */
  enabled: boolean
  
  /** Service name for metric namespacing */
  serviceName: string
  
  /** Sample rate for telemetry (0-1) */
  sampleRate: number
  
  /** Enable performance timing */
  enablePerformanceTracking: boolean
  
  /** Enable business metrics */
  enableBusinessMetrics: boolean
  
  /** Buffer size for batching telemetry events */
  bufferSize: number
  
  /** Flush interval in milliseconds */
  flushInterval: number
  
  /** Custom tags for all metrics */
  defaultTags: Record<string, string>
  
  /** Endpoints for telemetry data */
  endpoints: {
    metrics?: string
    events?: string
    errors?: string
    performance?: string
  }
  
  /** Custom metric transformers */
  transformers: TelemetryTransformer[]
}

export interface TelemetryEvent {
  /** Event name */
  name: string
  
  /** Event type */
  type: 'operation' | 'error' | 'performance' | 'business' | 'cache'
  
  /** Service name */
  service: string
  
  /** Operation name */
  operation?: string
  
  /** Event timestamp */
  timestamp: number
  
  /** Event duration in milliseconds */
  duration?: number
  
  /** Event success status */
  success: boolean
  
  /** Error information */
  error?: {
    code: StoreErrorCode
    message: string
    severity: string
    recoverable: boolean
  }
  
  /** Performance metrics */
  performance?: {
    responseTime: number
    cacheHit: boolean
    retryAttempts: number
    queueTime?: number
    processingTime?: number
  }
  
  /** Business metrics */
  business?: {
    userId?: string
    userType?: string
    feature?: string
    value?: number
    metadata?: Record<string, unknown>
  }
  
  /** Custom tags */
  tags: Record<string, string>
  
  /** Additional context */
  context?: Record<string, unknown>
}

export interface TelemetryTransformer {
  name: string
  transform: (event: TelemetryEvent) => TelemetryEvent | null
}

export interface PerformanceMetrics {
  /** Average response time */
  averageResponseTime: number
  
  /** 95th percentile response time */
  p95ResponseTime: number
  
  /** 99th percentile response time */
  p99ResponseTime: number
  
  /** Error rate */
  errorRate: number
  
  /** Cache hit rate */
  cacheHitRate: number
  
  /** Operations per second */
  operationsPerSecond: number
  
  /** Total operations */
  totalOperations: number
  
  /** Time window for metrics */
  timeWindow: {
    start: number
    end: number
  }
}

// Default Configuration
// =====================

const DEFAULT_CONFIG: TelemetryConfig = {
  enabled: true,
  serviceName: 'unknown',
  sampleRate: 1.0,
  enablePerformanceTracking: true,
  enableBusinessMetrics: true,
  bufferSize: 100,
  flushInterval: 10000, // 10 seconds
  defaultTags: {},
  endpoints: {},
  transformers: [],
}

// Service Telemetry Collector
// ============================

export class ServiceTelemetryCollector {
  private config: TelemetryConfig
  private eventBuffer: TelemetryEvent[] = []
  private performanceBuffer: PerformanceMetrics[] = []
  private flushTimer: NodeJS.Timeout | null = null
  private operationTimings = new Map<string, number[]>()
  private operationCounts = new Map<string, { success: number; failure: number }>()
  private cacheStats = new Map<string, { hits: number; misses: number }>()

  constructor(config: Partial<TelemetryConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    
    if (this.config.enabled) {
      this.startPeriodicFlush()
    }
  }

  /**
   * Track service operation
   */
  trackOperation(params: {
    operationName: string
    duration: number
    success: boolean
    error?: StoreError
    cacheHit?: boolean
    retryAttempts?: number
    context?: Record<string, unknown>
  }): void {
    if (!this.config.enabled || Math.random() > this.config.sampleRate) {
      return
    }

    const { operationName, duration, success, error, cacheHit, retryAttempts, context } = params

    // Update operation statistics
    this.updateOperationStats(operationName, duration, success, cacheHit)

    // Create telemetry event
    const event: TelemetryEvent = {
      name: `service.operation.${operationName}`,
      type: 'operation',
      service: this.config.serviceName,
      operation: operationName,
      timestamp: Date.now(),
      duration,
      success,
      error: error ? {
        code: error.code,
        message: error.message,
        severity: error.severity,
        recoverable: error.recoverable,
      } : undefined,
      performance: this.config.enablePerformanceTracking ? {
        responseTime: duration,
        cacheHit: cacheHit || false,
        retryAttempts: retryAttempts || 0,
      } : undefined,
      tags: {
        ...this.config.defaultTags,
        service: this.config.serviceName,
        operation: operationName,
        success: success.toString(),
      },
      context,
    }

    this.addEvent(event)
  }

  /**
   * Track service error
   */
  trackError(params: {
    operationName: string
    error: StoreError
    context?: Record<string, unknown>
  }): void {
    if (!this.config.enabled) return

    const { operationName, error, context } = params

    const event: TelemetryEvent = {
      name: `service.error.${error.code}`,
      type: 'error',
      service: this.config.serviceName,
      operation: operationName,
      timestamp: Date.now(),
      success: false,
      error: {
        code: error.code,
        message: error.message,
        severity: error.severity,
        recoverable: error.recoverable,
      },
      tags: {
        ...this.config.defaultTags,
        service: this.config.serviceName,
        operation: operationName,
        errorCode: error.code,
        severity: error.severity,
      },
      context,
    }

    this.addEvent(event)
  }

  /**
   * Track business metrics
   */
  trackBusinessMetric(params: {
    metricName: string
    value?: number
    userId?: string
    userType?: string
    feature?: string
    metadata?: Record<string, unknown>
    context?: Record<string, unknown>
  }): void {
    if (!this.config.enabled || !this.config.enableBusinessMetrics) return

    const { metricName, value, userId, userType, feature, metadata, context } = params

    const event: TelemetryEvent = {
      name: `business.${metricName}`,
      type: 'business',
      service: this.config.serviceName,
      timestamp: Date.now(),
      success: true,
      business: {
        userId,
        userType,
        feature,
        value,
        metadata,
      },
      tags: {
        ...this.config.defaultTags,
        service: this.config.serviceName,
        metric: metricName,
        userType: userType || 'unknown',
      },
      context,
    }

    this.addEvent(event)
  }

  /**
   * Track cache operations
   */
  trackCacheOperation(params: {
    operation: 'hit' | 'miss' | 'set' | 'invalidate'
    key: string
    size?: number
    ttl?: number
  }): void {
    if (!this.config.enabled) return

    const { operation, key, size, ttl } = params

    // Update cache statistics
    this.updateCacheStats(key, operation === 'hit')

    const event: TelemetryEvent = {
      name: `cache.${operation}`,
      type: 'cache',
      service: this.config.serviceName,
      timestamp: Date.now(),
      success: true,
      tags: {
        ...this.config.defaultTags,
        service: this.config.serviceName,
        operation,
        hasSize: size !== undefined ? 'true' : 'false',
      },
      context: {
        key: this.sanitizeCacheKey(key),
        size,
        ttl,
      },
    }

    this.addEvent(event)
  }

  /**
   * Get current performance metrics
   */
  getPerformanceMetrics(timeWindow?: { start: number; end: number }): PerformanceMetrics {
    const now = Date.now()
    const windowStart = timeWindow?.start || (now - 5 * 60 * 1000) // Default 5 minutes
    const windowEnd = timeWindow?.end || now

    // Calculate metrics from operation data
    const allTimings: number[] = []
    let totalOperations = 0
    let totalErrors = 0
    let totalCacheHits = 0
    let totalCacheRequests = 0

    // Aggregate operation statistics
    for (const [operation, timings] of this.operationTimings.entries()) {
      allTimings.push(...timings)
      
      const counts = this.operationCounts.get(operation)
      if (counts) {
        totalOperations += counts.success + counts.failure
        totalErrors += counts.failure
      }

      const cacheStats = this.cacheStats.get(operation)
      if (cacheStats) {
        totalCacheHits += cacheStats.hits
        totalCacheRequests += cacheStats.hits + cacheStats.misses
      }
    }

    // Calculate percentiles
    const sortedTimings = allTimings.sort((a, b) => a - b)
    const p95Index = Math.floor(sortedTimings.length * 0.95)
    const p99Index = Math.floor(sortedTimings.length * 0.99)

    return {
      averageResponseTime: allTimings.length > 0 
        ? allTimings.reduce((sum, time) => sum + time, 0) / allTimings.length 
        : 0,
      p95ResponseTime: sortedTimings[p95Index] || 0,
      p99ResponseTime: sortedTimings[p99Index] || 0,
      errorRate: totalOperations > 0 ? totalErrors / totalOperations : 0,
      cacheHitRate: totalCacheRequests > 0 ? totalCacheHits / totalCacheRequests : 0,
      operationsPerSecond: totalOperations / ((windowEnd - windowStart) / 1000),
      totalOperations,
      timeWindow: {
        start: windowStart,
        end: windowEnd,
      },
    }
  }

  /**
   * Get service health status
   */
  getHealthStatus(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    metrics: PerformanceMetrics
    issues: string[]
  } {
    const metrics = this.getPerformanceMetrics()
    const issues: string[] = []
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    // Check error rate
    if (metrics.errorRate > 0.1) {
      issues.push(`High error rate: ${(metrics.errorRate * 100).toFixed(1)}%`)
      status = 'unhealthy'
    } else if (metrics.errorRate > 0.05) {
      issues.push(`Elevated error rate: ${(metrics.errorRate * 100).toFixed(1)}%`)
      status = 'degraded'
    }

    // Check response time
    if (metrics.p95ResponseTime > 5000) {
      issues.push(`High response time: ${metrics.p95ResponseTime}ms (p95)`)
      status = 'unhealthy'
    } else if (metrics.p95ResponseTime > 2000) {
      issues.push(`Elevated response time: ${metrics.p95ResponseTime}ms (p95)`)
      if (status === 'healthy') status = 'degraded'
    }

    // Check cache performance
    if (metrics.cacheHitRate < 0.5 && metrics.totalOperations > 100) {
      issues.push(`Low cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`)
      if (status === 'healthy') status = 'degraded'
    }

    return { status, metrics, issues }
  }

  /**
   * Flush telemetry data to endpoints
   */
  async flush(): Promise<void> {
    if (this.eventBuffer.length === 0) return

    const events = [...this.eventBuffer]
    this.eventBuffer = []

    try {
      // Apply transformers
      const transformedEvents = events
        .map(event => this.applyTransformers(event))
        .filter(Boolean) as TelemetryEvent[]

      // Send to endpoints
      await Promise.allSettled([
        this.sendToMetricsEndpoint(transformedEvents),
        this.sendToEventsEndpoint(transformedEvents),
        this.sendToPerformanceEndpoint(transformedEvents),
      ])

    } catch (error) {
      console.warn('Failed to flush telemetry data:', error)
      
      // Re-queue events on failure (with limit to prevent memory issues)
      if (this.eventBuffer.length < this.config.bufferSize) {
        this.eventBuffer.unshift(...events.slice(0, this.config.bufferSize - this.eventBuffer.length))
      }
    }
  }

  /**
   * Clear all telemetry data
   */
  clear(): void {
    this.eventBuffer = []
    this.operationTimings.clear()
    this.operationCounts.clear()
    this.cacheStats.clear()
  }

  /**
   * Stop telemetry collection
   */
  stop(): void {
    this.config.enabled = false
    
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = null
    }

    // Final flush
    this.flush()
  }

  // Private Methods
  // ===============

  private addEvent(event: TelemetryEvent): void {
    this.eventBuffer.push(event)

    if (this.eventBuffer.length >= this.config.bufferSize) {
      this.flush()
    }
  }

  private updateOperationStats(
    operation: string, 
    duration: number, 
    success: boolean, 
    cacheHit?: boolean
  ): void {
    // Update timing data
    const timings = this.operationTimings.get(operation) || []
    timings.push(duration)
    
    // Keep only recent timings (last 1000)
    if (timings.length > 1000) {
      timings.splice(0, timings.length - 1000)
    }
    
    this.operationTimings.set(operation, timings)

    // Update success/failure counts
    const counts = this.operationCounts.get(operation) || { success: 0, failure: 0 }
    if (success) {
      counts.success++
    } else {
      counts.failure++
    }
    this.operationCounts.set(operation, counts)

    // Update cache stats
    if (cacheHit !== undefined) {
      this.updateCacheStats(operation, cacheHit)
    }
  }

  private updateCacheStats(key: string, hit: boolean): void {
    const stats = this.cacheStats.get(key) || { hits: 0, misses: 0 }
    if (hit) {
      stats.hits++
    } else {
      stats.misses++
    }
    this.cacheStats.set(key, stats)
  }

  private sanitizeCacheKey(key: string): string {
    // Remove sensitive data from cache keys for telemetry
    return key.replace(/\b\d{10,}\b/g, '[ID]').replace(/\b[a-f0-9-]{36}\b/g, '[UUID]')
  }

  private applyTransformers(event: TelemetryEvent): TelemetryEvent | null {
    let transformedEvent = event

    for (const transformer of this.config.transformers) {
      const result = transformer.transform(transformedEvent)
      if (result === null) {
        return null // Event filtered out
      }
      transformedEvent = result
    }

    return transformedEvent
  }

  private startPeriodicFlush(): void {
    this.flushTimer = setInterval(() => {
      this.flush()
    }, this.config.flushInterval)
  }

  private async sendToMetricsEndpoint(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoints.metrics) return

    const metricsEvents = events.filter(e => e.type === 'operation' || e.type === 'performance')
    if (metricsEvents.length === 0) return

    await fetch(this.config.endpoints.metrics, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: metricsEvents }),
    })
  }

  private async sendToEventsEndpoint(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoints.events) return

    const businessEvents = events.filter(e => e.type === 'business')
    if (businessEvents.length === 0) return

    await fetch(this.config.endpoints.events, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: businessEvents }),
    })
  }

  private async sendToPerformanceEndpoint(events: TelemetryEvent[]): Promise<void> {
    if (!this.config.endpoints.performance) return

    const performanceData = {
      service: this.config.serviceName,
      timestamp: Date.now(),
      metrics: this.getPerformanceMetrics(),
      events: events.filter(e => e.type === 'operation'),
    }

    await fetch(this.config.endpoints.performance, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(performanceData),
    })
  }
}

// Global Telemetry Manager
// ========================

class TelemetryManager {
  private collectors = new Map<string, ServiceTelemetryCollector>()

  getCollector(serviceName: string, config?: Partial<TelemetryConfig>): ServiceTelemetryCollector {
    if (!this.collectors.has(serviceName)) {
      this.collectors.set(serviceName, new ServiceTelemetryCollector({
        ...config,
        serviceName,
      }))
    }
    return this.collectors.get(serviceName)!
  }

  getAllMetrics(): Record<string, PerformanceMetrics> {
    const metrics: Record<string, PerformanceMetrics> = {}
    
    for (const [serviceName, collector] of this.collectors.entries()) {
      metrics[serviceName] = collector.getPerformanceMetrics()
    }
    
    return metrics
  }

  getSystemHealth(): {
    status: 'healthy' | 'degraded' | 'unhealthy'
    services: Record<string, ReturnType<ServiceTelemetryCollector['getHealthStatus']>>
  } {
    const services: Record<string, ReturnType<ServiceTelemetryCollector['getHealthStatus']>> = {}
    let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy'

    for (const [serviceName, collector] of this.collectors.entries()) {
      const health = collector.getHealthStatus()
      services[serviceName] = health

      if (health.status === 'unhealthy') {
        overallStatus = 'unhealthy'
      } else if (health.status === 'degraded' && overallStatus === 'healthy') {
        overallStatus = 'degraded'
      }
    }

    return { status: overallStatus, services }
  }

  async flushAll(): Promise<void> {
    await Promise.all(
      Array.from(this.collectors.values()).map(collector => collector.flush())
    )
  }

  stopAll(): void {
    for (const collector of this.collectors.values()) {
      collector.stop()
    }
    this.collectors.clear()
  }
}

// Export singleton instance
export const telemetryManager = new TelemetryManager()

// Convenience functions
export function createServiceTelemetry(serviceName: string, config?: Partial<TelemetryConfig>) {
  return telemetryManager.getCollector(serviceName, config)
}

export function trackServiceOperation(
  serviceName: string,
  operationName: string,
  duration: number,
  success: boolean,
  error?: StoreError,
  context?: Record<string, unknown>
) {
  const collector = telemetryManager.getCollector(serviceName)
  collector.trackOperation({ operationName, duration, success, error, context })
}

export function trackBusinessMetric(
  serviceName: string,
  metricName: string,
  params: {
    value?: number
    userId?: string
    userType?: string
    feature?: string
    metadata?: Record<string, unknown>
  }
) {
  const collector = telemetryManager.getCollector(serviceName)
  collector.trackBusinessMetric({ metricName, ...params })
}

// Default transformers
export const DEFAULT_TRANSFORMERS: TelemetryTransformer[] = [
  {
    name: 'sanitizeUserData',
    transform: (event) => ({
      ...event,
      context: event.context ? {
        ...event.context,
        // Remove sensitive data
        email: event.context.email ? '[REDACTED]' : undefined,
        password: undefined,
        token: undefined,
      } : undefined,
    }),
  },
  {
    name: 'addEnvironmentInfo',
    transform: (event) => ({
      ...event,
      tags: {
        ...event.tags,
        environment: process.env.NODE_ENV || 'unknown',
        version: process.env.APP_VERSION || 'unknown',
      },
    }),
  },
]

export type {
  TelemetryConfig,
  TelemetryEvent,
  TelemetryTransformer,
  PerformanceMetrics,
}