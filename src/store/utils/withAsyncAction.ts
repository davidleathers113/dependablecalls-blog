/**
 * withAsyncAction Middleware Helper
 * 
 * Reduces boilerplate for async store operations by providing:
 * - Automatic loading state management
 * - Standardized error handling with StoreError integration
 * - Telemetry and performance tracking
 * - Service integration patterns
 * - Recovery strategy execution
 * 
 * This utility standardizes the pattern of calling service methods from stores
 * during the migration from direct Supabase calls to service layer architecture.
 */

import { StoreApi } from 'zustand'
import { StoreError, createStoreError, migrateError, type StoreErrorCode } from '../../lib/errors/StoreError'
import { reportError } from '../errors/reporting'
import type { ErrorContext } from '../errors/errorTypes'

// Types and Interfaces
// ===================

export interface AsyncActionConfig<TParams = unknown, TResult = unknown> {
  /** Action name for logging and error context */
  actionName: string
  
  /** Store name for error context */
  storeName: string
  
  /** Service name if calling service method */
  serviceName?: string
  
  /** Enable loading state management */
  enableLoadingState?: boolean
  
  /** Loading state property name (default: 'loading') */
  loadingStateProp?: string
  
  /** Error state property name (default: 'error') */
  errorStateProp?: string
  
  /** Enable automatic error recovery */
  enableRecovery?: boolean
  
  /** Maximum recovery attempts */
  maxRecoveryAttempts?: number
  
  /** Enable telemetry tracking */
  enableTelemetry?: boolean
  
  /** Custom error mapping function */
  mapError?: (error: unknown, params: TParams) => StoreError
  
  /** Custom success callback */
  onSuccess?: (result: TResult, params: TParams) => void
  
  /** Custom error callback */
  onError?: (error: StoreError, params: TParams) => void
  
  /** Validation function for parameters */
  validateParams?: (params: TParams) => boolean | string
  
  /** Validation function for result */
  validateResult?: (result: TResult) => boolean | string
  
  /** Transform result before returning */
  transformResult?: (result: TResult, params: TParams) => TResult
  
  /** Cache configuration */
  cache?: {
    enabled: boolean
    key: (params: TParams) => string
    ttl?: number
  }
  
  /** Retry configuration */
  retry?: {
    enabled: boolean
    maxAttempts: number
    baseDelay: number
    shouldRetry?: (error: StoreError, attempt: number) => boolean
  }
}

export interface AsyncActionState {
  loading: boolean
  error: StoreError | null
  lastAction?: string
  lastActionTime?: number
  actionHistory: ActionHistoryEntry[]
}

export interface AsyncActionMethods {
  clearError: () => void
  retryLastAction: () => Promise<void>
  getActionHistory: () => ActionHistoryEntry[]
  clearActionHistory: () => void
}

interface ActionHistoryEntry {
  actionName: string
  timestamp: number
  success: boolean
  duration: number
  error?: StoreError
  params?: unknown
}

interface AsyncActionContext<TParams, TResult> {
  config: AsyncActionConfig<TParams, TResult>
  startTime: number
  attempt: number
  cache: Map<string, CacheEntry>
  lastAction: { name: string, params: TParams } | null
}

interface CacheEntry {
  data: unknown
  expiresAt: number
  createdAt: number
}

// Default Configuration
// =====================

const DEFAULT_CONFIG: Required<Omit<AsyncActionConfig, 'actionName' | 'storeName' | 'serviceName' | 'mapError' | 'onSuccess' | 'onError' | 'validateParams' | 'validateResult' | 'transformResult' | 'cache' | 'retry'>> = {
  enableLoadingState: true,
  loadingStateProp: 'loading',
  errorStateProp: 'error',
  enableRecovery: true,
  maxRecoveryAttempts: 3,
  enableTelemetry: true,
}

// Main withAsyncAction Function
// =============================

/**
 * Creates an async action handler with standardized error handling and state management
 */
export function withAsyncAction<TState, TParams = void, TResult = unknown>(
  config: AsyncActionConfig<TParams, TResult>
) {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const cache = new Map<string, CacheEntry>()
  const actionHistory: ActionHistoryEntry[] = []
  let lastAction: { name: string, params: TParams } | null = null

  return function createAsyncAction(
    operation: (params: TParams, context: AsyncActionExecutionContext<TState>) => Promise<TResult>
  ) {
    return async function executeAsyncAction(
      this: StoreApi<TState>,
      params: TParams
    ): Promise<TResult> {
      const startTime = Date.now()
      const context: AsyncActionContext<TParams, TResult> = {
        config: fullConfig,
        startTime,
        attempt: 1,
        cache,
        lastAction,
      }

      // Store last action for retry functionality
      lastAction = { name: fullConfig.actionName, params }

      try {
        // Parameter validation
        if (fullConfig.validateParams) {
          const validation = fullConfig.validateParams(params)
          if (validation !== true) {
            throw createStoreError.validationFailed(
              'params',
              typeof validation === 'string' ? validation : 'Invalid parameters',
              params,
              fullConfig.serviceName
            )
          }
        }

        // Check cache if enabled
        if (fullConfig.cache?.enabled) {
          const cacheKey = fullConfig.cache.key(params)
          const cached = getFromCache<TResult>(cache, cacheKey, fullConfig.cache.ttl)
          if (cached) {
            recordActionHistory(actionHistory, fullConfig.actionName, startTime, true, params)
            return cached
          }
        }

        // Set loading state
        if (fullConfig.enableLoadingState) {
          this.setState((state: TState) => ({
            ...state,
            [fullConfig.loadingStateProp]: true,
            [fullConfig.errorStateProp]: null,
          }))
        }

        // Execute operation with retry logic
        const result = await executeWithRetry(
          () => operation(params, {
            state: this.getState(),
            setState: this.setState.bind(this),
            config: fullConfig,
            attempt: context.attempt,
          }),
          fullConfig,
          context
        )

        // Result validation
        if (fullConfig.validateResult) {
          const validation = fullConfig.validateResult(result)
          if (validation !== true) {
            throw createStoreError.validationFailed(
              'result',
              typeof validation === 'string' ? validation : 'Invalid result',
              result,
              fullConfig.serviceName
            )
          }
        }

        // Transform result if needed
        const finalResult = fullConfig.transformResult 
          ? fullConfig.transformResult(result, params)
          : result

        // Cache result if enabled
        if (fullConfig.cache?.enabled && finalResult !== null && finalResult !== undefined) {
          const cacheKey = fullConfig.cache.key(params)
          setCache(cache, cacheKey, finalResult, fullConfig.cache.ttl)
        }

        // Clear loading and error states
        if (fullConfig.enableLoadingState) {
          this.setState((state: TState) => ({
            ...state,
            [fullConfig.loadingStateProp]: false,
            [fullConfig.errorStateProp]: null,
            lastAction: fullConfig.actionName,
            lastActionTime: Date.now(),
          }))
        }

        // Success callback
        if (fullConfig.onSuccess) {
          fullConfig.onSuccess(finalResult, params)
        }

        // Record success in history
        const duration = Date.now() - startTime
        recordActionHistory(actionHistory, fullConfig.actionName, startTime, true, params, undefined, duration)

        // Send telemetry
        if (fullConfig.enableTelemetry) {
          sendTelemetry(fullConfig, params, finalResult, duration, null)
        }

        return finalResult

      } catch (error) {
        const storeError = fullConfig.mapError 
          ? fullConfig.mapError(error, params)
          : migrateError(error, { 
              serviceName: fullConfig.serviceName, 
              operation: fullConfig.actionName 
            })

        // Set error state
        if (fullConfig.enableLoadingState) {
          this.setState((state: TState) => ({
            ...state,
            [fullConfig.loadingStateProp]: false,
            [fullConfig.errorStateProp]: storeError,
            lastAction: fullConfig.actionName,
            lastActionTime: Date.now(),
          }))
        }

        // Error callback
        if (fullConfig.onError) {
          fullConfig.onError(storeError, params)
        }

        // Record error in history
        const duration = Date.now() - startTime
        recordActionHistory(actionHistory, fullConfig.actionName, startTime, false, params, storeError, duration)

        // Send telemetry
        if (fullConfig.enableTelemetry) {
          sendTelemetry(fullConfig, params, null, duration, storeError)
        }

        // Report error
        await reportError(storeError, {
          storeName: fullConfig.storeName,
          serviceName: fullConfig.serviceName,
          actionType: fullConfig.actionName,
          timestamp: Date.now(),
        })

        throw storeError
      }
    }
  }
}

// Execution Context for Operations
// ================================

export interface AsyncActionExecutionContext<TState> {
  /** Current store state */
  state: TState
  
  /** setState function for updating store */
  setState: (partial: TState | Partial<TState> | ((state: TState) => TState | Partial<TState>)) => void
  
  /** Action configuration */
  config: AsyncActionConfig
  
  /** Current attempt number */
  attempt: number
}

// Retry Logic Implementation
// ==========================

async function executeWithRetry<TParams, TResult>(
  operation: () => Promise<TResult>,
  config: AsyncActionConfig<TParams, TResult>,
  context: AsyncActionContext<TParams, TResult>
): Promise<TResult> {
  const retryConfig = config.retry
  if (!retryConfig?.enabled) {
    return await operation()
  }

  let lastError: StoreError | null = null

  for (let attempt = 1; attempt <= retryConfig.maxAttempts; attempt++) {
    context.attempt = attempt

    try {
      return await operation()
    } catch (error) {
      const storeError = error instanceof StoreError 
        ? error 
        : migrateError(error, { serviceName: config.serviceName, operation: config.actionName })
      
      lastError = storeError

      if (attempt === retryConfig.maxAttempts) {
        break // Last attempt
      }

      if (retryConfig.shouldRetry && !retryConfig.shouldRetry(storeError, attempt)) {
        break // Should not retry
      }

      // Calculate delay with exponential backoff
      const delay = retryConfig.baseDelay * Math.pow(2, attempt - 1)
      const jitter = Math.random() * 0.1 * delay
      const totalDelay = delay + jitter

      await new Promise(resolve => setTimeout(resolve, totalDelay))
    }
  }

  throw lastError || createStoreError.fetchFailed('retry', 'Max attempts reached', config.serviceName)
}

// Cache Management
// ================

function getFromCache<T>(cache: Map<string, CacheEntry>, key: string, ttl?: number): T | null {
  const entry = cache.get(key)
  if (!entry) return null

  const isExpired = ttl ? Date.now() > entry.expiresAt : false
  if (isExpired) {
    cache.delete(key)
    return null
  }

  return entry.data as T
}

function setCache<T>(cache: Map<string, CacheEntry>, key: string, data: T, ttl?: number): void {
  const expiresAt = ttl ? Date.now() + ttl : Date.now() + (5 * 60 * 1000) // Default 5 minutes
  
  cache.set(key, {
    data,
    expiresAt,
    createdAt: Date.now(),
  })
}

// Action History Management
// =========================

function recordActionHistory(
  history: ActionHistoryEntry[],
  actionName: string,
  startTime: number,
  success: boolean,
  params?: unknown,
  error?: StoreError,
  duration?: number
): void {
  const entry: ActionHistoryEntry = {
    actionName,
    timestamp: startTime,
    success,
    duration: duration || Date.now() - startTime,
    error,
    params,
  }

  history.push(entry)

  // Keep only last 100 entries
  if (history.length > 100) {
    history.splice(0, history.length - 100)
  }
}

// Telemetry Integration
// ====================

async function sendTelemetry<TParams, TResult>(
  config: AsyncActionConfig<TParams, TResult>,
  params: TParams,
  result: TResult | null,
  duration: number,
  error: StoreError | null
): Promise<void> {
  try {
    const telemetryData = {
      actionName: config.actionName,
      storeName: config.storeName,
      serviceName: config.serviceName,
      duration,
      success: !error,
      error: error ? {
        code: error.code,
        message: error.message,
        severity: error.severity,
      } : null,
      timestamp: Date.now(),
      // Don't send sensitive parameter data
      hasParams: params !== undefined && params !== null,
      hasResult: result !== undefined && result !== null,
    }

    // Send to monitoring endpoint (placeholder - would integrate with actual service)
    if (typeof window !== 'undefined' && 'fetch' in window) {
      await fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(telemetryData),
      }).catch(() => {
        // Ignore telemetry errors
      })
    }
  } catch {
    // Ignore telemetry errors
  }
}

// Store Extension Helpers
// =======================

/**
 * Adds async action methods to a store
 */
export function addAsyncActionMethods<TState extends AsyncActionState>(
  actionHistory: ActionHistoryEntry[],
  lastAction: { name: string, params: unknown } | null,
  cache: Map<string, CacheEntry>
) {
  return {
    clearError: function(this: StoreApi<TState>) {
      this.setState((state: TState) => ({
        ...state,
        error: null,
      }))
    },

    retryLastAction: async function(this: StoreApi<TState>) {
      if (!lastAction) {
        throw createStoreError.fetchFailed('retry', 'No action to retry')
      }
      
      // This would need to be implemented per store based on available actions
      throw createStoreError.fetchFailed('retry', 'Retry not implemented for this action')
    },

    getActionHistory: () => [...actionHistory],

    clearActionHistory: () => {
      actionHistory.splice(0, actionHistory.length)
    },

    clearCache: () => {
      cache.clear()
    },
  }
}

// Convenience Factory Functions
// =============================

/**
 * Creates a simple async action for service method calls
 */
export function createServiceAction<TState, TParams = void, TResult = unknown>(
  config: Omit<AsyncActionConfig<TParams, TResult>, 'actionName'> & { actionName: string }
) {
  return withAsyncAction<TState, TParams, TResult>(config)
}

/**
 * Creates an async action for data fetching
 */
export function createFetchAction<TState, TParams = void, TResult = unknown>(
  storeName: string,
  actionName: string,
  serviceName?: string
) {
  return withAsyncAction<TState, TParams, TResult>({
    actionName,
    storeName,
    serviceName,
    enableLoadingState: true,
    enableRecovery: true,
    enableTelemetry: true,
    retry: {
      enabled: true,
      maxAttempts: 3,
      baseDelay: 1000,
    },
  })
}

/**
 * Creates an async action for data mutations
 */
export function createMutationAction<TState, TParams = void, TResult = unknown>(
  storeName: string,
  actionName: string,
  serviceName?: string
) {
  return withAsyncAction<TState, TParams, TResult>({
    actionName,
    storeName,
    serviceName,
    enableLoadingState: true,
    enableRecovery: false, // Don't auto-retry mutations
    enableTelemetry: true,
    cache: {
      enabled: false, // Don't cache mutations
      key: () => '',
    },
  })
}

// Export types and utilities
export type {
  AsyncActionConfig,
  AsyncActionState,
  AsyncActionMethods,
  AsyncActionExecutionContext,
}