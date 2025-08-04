/**
 * Base Service Class
 * 
 * Foundation for all DCE services providing:
 * - Standardized error handling with service-specific error codes
 * - Retry logic with exponential backoff
 * - Request caching and deduplication
 * - Performance monitoring and telemetry
 * - Consistent logging and debugging
 * - Store integration patterns
 * 
 * This class serves as the migration foundation for moving logic from stores to services.
 * Initially, services can proxy to existing store methods while gradually adding business logic.
 */

import { DCEError, createError, type ErrorContext } from '../../store/errors/errorTypes'
import { reportError } from '../../store/errors/reporting'
import type { SupabaseClient } from '@supabase/supabase-js'
import { supabase } from '../../lib/supabase'

// Service Configuration Types
// ===========================

export interface ServiceConfig {
  /** Service name for logging and error context */
  name: string
  
  /** Enable request caching */
  enableCaching?: boolean
  
  /** Cache TTL in milliseconds */
  cacheTtl?: number
  
  /** Maximum number of retry attempts */
  maxRetries?: number
  
  /** Base delay for exponential backoff (ms) */
  baseRetryDelay?: number
  
  /** Enable performance monitoring */
  enableMonitoring?: boolean
  
  /** Enable debug logging */
  enableDebugLogging?: boolean
  
  /** Custom error context */
  customContext?: Record<string, unknown>
}

export interface ServiceOperation<T = unknown> {
  /** Operation name for tracking */
  name: string
  
  /** Operation function */
  execute: () => Promise<T>
  
  /** Cache key for this operation */
  cacheKey?: string
  
  /** Override retry configuration */
  retryConfig?: {
    maxAttempts?: number
    baseDelay?: number
    shouldRetry?: (error: Error, attempt: number) => boolean
  }
  
  /** Skip caching for this operation */
  skipCache?: boolean
  
  /** Operation timeout (ms) */
  timeout?: number
}

export interface ServiceMetrics {
  /** Total operations performed */
  operationCount: number
  
  /** Average response time (ms) */
  averageResponseTime: number
  
  /** Error rate (0-1) */
  errorRate: number
  
  /** Cache hit rate (0-1) */
  cacheHitRate: number
  
  /** Last operation timestamp */
  lastOperation: number
}

// Default Configuration
// =====================

const DEFAULT_CONFIG: Required<Omit<ServiceConfig, 'name' | 'customContext'>> = {
  enableCaching: true,
  cacheTtl: 5 * 60 * 1000, // 5 minutes
  maxRetries: 3,
  baseRetryDelay: 1000, // 1 second
  enableMonitoring: true,
  enableDebugLogging: process.env.NODE_ENV === 'development',
}

// Base Service Implementation
// ===========================

export abstract class BaseService {
  protected readonly config: Required<ServiceConfig>
  protected readonly supabase: SupabaseClient
  private readonly cache = new Map<string, CacheEntry>()
  private readonly metrics: ServiceMetrics = {
    operationCount: 0,
    averageResponseTime: 0,
    errorRate: 0,
    cacheHitRate: 0,
    lastOperation: Date.now(),
  }
  private readonly pendingRequests = new Map<string, Promise<unknown>>()

  constructor(config: ServiceConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.supabase = supabase
    
    // Initialize cleanup interval for cache
    if (this.config.enableCaching) {
      setInterval(() => this.cleanupCache(), this.config.cacheTtl)
    }
  }

  /**
   * Execute a service operation with standardized error handling, retries, and caching
   */
  protected async executeOperation<T>(operation: ServiceOperation<T>): Promise<T> {
    const startTime = Date.now()
    const context = this.buildErrorContext(operation.name)

    try {
      // Check for pending request deduplication
      if (operation.cacheKey && this.pendingRequests.has(operation.cacheKey)) {
        this.log('Deduplicating request', { operation: operation.name, cacheKey: operation.cacheKey })
        return await this.pendingRequests.get(operation.cacheKey) as T
      }

      // Check cache first
      if (!operation.skipCache && operation.cacheKey) {
        const cached = this.getFromCache<T>(operation.cacheKey)
        if (cached) {
          this.updateMetrics(startTime, true, false)
          return cached
        }
      }

      // Create promise for deduplication
      let operationPromise: Promise<T>
      
      if (operation.timeout) {
        operationPromise = this.withTimeout(operation.execute(), operation.timeout)
      } else {
        operationPromise = operation.execute()
      }

      // Store pending request for deduplication
      if (operation.cacheKey) {
        this.pendingRequests.set(operation.cacheKey, operationPromise)
      }

      // Execute with retry logic
      const result = await this.withRetry(
        () => operationPromise,
        operation.retryConfig || {},
        context
      )

      // Cache result if applicable
      if (!operation.skipCache && operation.cacheKey && result !== null && result !== undefined) {
        this.setCache(operation.cacheKey, result)
      }

      this.updateMetrics(startTime, false, false)
      return result

    } catch (error) {
      this.updateMetrics(startTime, false, true)
      
      // Convert to service error and report
      const serviceError = this.createServiceError(error, operation.name, context)
      await this.reportServiceError(serviceError, context)
      
      throw serviceError
    } finally {
      // Clean up pending request
      if (operation.cacheKey) {
        this.pendingRequests.delete(operation.cacheKey)
      }
    }
  }

  /**
   * Execute operation with retry logic and exponential backoff
   */
  private async withRetry<T>(
    operation: () => Promise<T>,
    retryConfig: ServiceOperation['retryConfig'] = {},
    context: ErrorContext
  ): Promise<T> {
    const maxAttempts = retryConfig.maxAttempts ?? this.config.maxRetries
    const baseDelay = retryConfig.baseDelay ?? this.config.baseRetryDelay
    const shouldRetry = retryConfig.shouldRetry ?? this.defaultShouldRetry

    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await operation()
      } catch (error) {
        lastError = error as Error
        
        if (attempt === maxAttempts) {
          break // Last attempt, don't retry
        }

        if (!shouldRetry(lastError, attempt)) {
          break // Should not retry this error
        }

        // Calculate delay with exponential backoff and jitter
        const delay = baseDelay * Math.pow(2, attempt - 1)
        const jitter = Math.random() * 0.1 * delay
        const totalDelay = delay + jitter

        this.log('Retrying operation', {
          attempt,
          maxAttempts,
          delay: totalDelay,
          error: lastError.message,
        })

        await new Promise(resolve => setTimeout(resolve, totalDelay))
      }
    }

    throw lastError || new Error('Max retry attempts reached')
  }

  /**
   * Add timeout to an operation
   */
  private async withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(
        createError.network('Operation timeout', 408, undefined, 'TIMEOUT', {
          context: { timeout: timeoutMs }
        })
      ), timeoutMs)
    })

    return Promise.race([promise, timeoutPromise])
  }

  /**
   * Default retry logic - retry on network errors and 5xx responses
   */
  private defaultShouldRetry = (error: Error, attempt: number): boolean => {
    if (attempt >= this.config.maxRetries) return false

    // Don't retry validation or business logic errors
    if (error.message.includes('validation') || error.message.includes('business')) {
      return false
    }

    // Retry on network errors
    if (error.message.includes('network') || error.message.includes('timeout')) {
      return true
    }

    // Retry on specific HTTP status codes
    if ('statusCode' in error) {
      const statusCode = (error as { statusCode: number }).statusCode
      return statusCode >= 500 || statusCode === 408 || statusCode === 429
    }

    return false
  }

  /**
   * Create service-specific error with proper context
   */
  private createServiceError(error: unknown, operationName: string, context: ErrorContext): DCEError {
    if (error instanceof DCEError) {
      return error
    }

    if (error instanceof Error) {
      // Classify error type based on message and properties
      if (error.message.includes('validation') || error.message.includes('invalid')) {
        return createError.validation(error.message, undefined, undefined, undefined, {
          cause: error,
          context: { ...context, operation: operationName }
        })
      }

      if (error.message.includes('network') || error.message.includes('fetch')) {
        return createError.network(error.message, undefined, undefined, undefined, {
          cause: error,
          context: { ...context, operation: operationName }
        })
      }

      if (error.message.includes('unauthorized') || error.message.includes('forbidden')) {
        return createError.authentication(error.message, {
          cause: error,
          context: { ...context, operation: operationName }
        })
      }

      // Default to state error for service operations
      return createError.state(
        error.message,
        this.config.name,
        operationName,
        undefined,
        {
          cause: error,
          context: { ...context, operation: operationName }
        }
      )
    }

    // Unknown error type
    return createError.state(
      'Unknown service error occurred',
      this.config.name,
      operationName,
      undefined,
      {
        context: { ...context, operation: operationName, originalError: error }
      }
    )
  }

  /**
   * Report service error to monitoring systems
   */
  private async reportServiceError(error: DCEError, context: ErrorContext): Promise<void> {
    try {
      await reportError(error, {
        ...context,
        serviceName: this.config.name,
        timestamp: Date.now(),
      })
    } catch (reportingError) {
      this.log('Failed to report error', { error: reportingError })
    }
  }

  /**
   * Build error context for service operations
   */
  private buildErrorContext(operationName: string): ErrorContext {
    return {
      serviceName: this.config.name,
      operation: operationName,
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...this.config.customContext,
    }
  }

  /**
   * Cache management
   */
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key)
    if (!entry) return null

    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key)
      return null
    }

    this.log('Cache hit', { key })
    return entry.data as T
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      expiresAt: Date.now() + this.config.cacheTtl,
      createdAt: Date.now(),
    })

    this.log('Cache set', { key, ttl: this.config.cacheTtl })
  }

  private cleanupCache(): void {
    const now = Date.now()
    let cleaned = 0

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key)
        cleaned++
      }
    }

    if (cleaned > 0) {
      this.log('Cache cleanup', { cleaned, remaining: this.cache.size })
    }
  }

  /**
   * Metrics tracking
   */
  private updateMetrics(startTime: number, cacheHit: boolean, isError: boolean): void {
    const responseTime = Date.now() - startTime
    
    this.metrics.operationCount++
    this.metrics.lastOperation = Date.now()
    
    // Update average response time
    this.metrics.averageResponseTime = 
      (this.metrics.averageResponseTime * (this.metrics.operationCount - 1) + responseTime) / 
      this.metrics.operationCount

    // Update error rate
    if (isError) {
      const errorCount = this.metrics.errorRate * (this.metrics.operationCount - 1) + 1
      this.metrics.errorRate = errorCount / this.metrics.operationCount
    } else {
      this.metrics.errorRate = 
        (this.metrics.errorRate * (this.metrics.operationCount - 1)) / 
        this.metrics.operationCount
    }

    // Update cache hit rate
    if (cacheHit) {
      const hitCount = this.metrics.cacheHitRate * (this.metrics.operationCount - 1) + 1
      this.metrics.cacheHitRate = hitCount / this.metrics.operationCount
    } else {
      this.metrics.cacheHitRate = 
        (this.metrics.cacheHitRate * (this.metrics.operationCount - 1)) / 
        this.metrics.operationCount
    }
  }

  /**
   * Logging utility
   */
  protected log(message: string, data?: Record<string, unknown>): void {
    if (!this.config.enableDebugLogging) return

    console.log(`[${this.config.name}] ${message}`, data)
  }

  /**
   * Get service metrics
   */
  public getMetrics(): ServiceMetrics {
    return { ...this.metrics }
  }

  /**
   * Clear service cache
   */
  public clearCache(): void {
    this.cache.clear()
    this.log('Cache cleared')
  }

  /**
   * Health check for service
   */
  public async healthCheck(): Promise<ServiceHealthStatus> {
    const startTime = Date.now()
    
    try {
      // Perform a lightweight operation to test service health
      await this.performHealthCheck()
      
      return {
        status: 'healthy',
        responseTime: Date.now() - startTime,
        metrics: this.getMetrics(),
        cacheSize: this.cache.size,
        timestamp: Date.now(),
      }
    } catch (error) {
      return {
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown error',
        metrics: this.getMetrics(),
        cacheSize: this.cache.size,
        timestamp: Date.now(),
      }
    }
  }

  /**
   * Override this method in derived services for specific health checks
   */
  protected async performHealthCheck(): Promise<void> {
    // Base implementation - just check Supabase connection
    const { error } = await this.supabase.from('users').select('count').limit(0)
    if (error) {
      throw error
    }
  }
}

// Supporting Types
// ================

interface CacheEntry {
  data: unknown
  expiresAt: number
  createdAt: number
}

export interface ServiceHealthStatus {
  status: 'healthy' | 'unhealthy'
  responseTime: number
  error?: string
  metrics: ServiceMetrics
  cacheSize: number
  timestamp: number
}

// Store Integration Helpers
// =========================

/**
 * Helper to create store-compatible service methods
 * This enables gradual migration from store methods to service methods
 */
export function createStoreProxy<T extends BaseService, K extends keyof T>(
  service: T,
  method: K
): T[K] extends (...args: infer A) => infer R ? (...args: A) => R : never {
  return ((...args: unknown[]) => {
    const serviceMethod = service[method]
    if (typeof serviceMethod === 'function') {
      return serviceMethod.apply(service, args)
    }
    throw new Error(`Method ${String(method)} is not a function`)
  }) as T[K] extends (...args: infer A) => infer R ? (...args: A) => R : never
}

/**
 * Wrapper for async operations that provides consistent error handling
 * Use this in stores when calling service methods during migration
 */
export async function executeServiceOperation<T>(
  operation: () => Promise<T>,
  context: { storeName: string; actionName: string }
): Promise<T> {
  try {
    return await operation()
  } catch (error) {
    // Log service error in store context
    console.error(`[${context.storeName}] Service operation failed in ${context.actionName}:`, error)
    
    // Re-throw as-is since service already created proper DCEError
    throw error
  }
}

export type { ServiceConfig, ServiceOperation, ServiceMetrics }