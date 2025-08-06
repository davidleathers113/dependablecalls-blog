/**
 * DCE Error Handling Middleware
 * 
 * Centralized error handling middleware for Zustand stores, providing:
 * - Automatic error interception and processing
 * - Recovery strategy execution
 * - Error reporting to monitoring systems
 * - State rollback on critical errors
 * - Integration with performance monitoring
 */

import type { StateCreator, StoreApi } from 'zustand'
import { createError, DCEError, type ErrorContext, type RecoveryStrategy } from '../errors/errorTypes'
import { reportError, ErrorReporter } from '../errors/reporting'
import { RecoveryManager } from '../errors/recovery'

// Middleware Configuration
// =======================

export interface ErrorHandlingConfig {
  /** Store name for error context */
  storeName: string
  
  /** Enable automatic error recovery */
  enableRecovery?: boolean
  
  /** Enable error reporting to monitoring systems */
  enableReporting?: boolean
  
  /** Maximum number of recovery attempts per error */
  maxRecoveryAttempts?: number
  
  /** Timeout for recovery operations (ms) */
  recoveryTimeout?: number
  
  /** Custom error context data */
  customContext?: Record<string, unknown>
  
  /** Custom error handlers for specific error types */
  customHandlers?: Record<string, ErrorHandler>
  
  /** State rollback strategy */
  rollbackStrategy?: RollbackStrategy
  
  /** Development mode settings */
  development?: {
    logErrors?: boolean
    logRecovery?: boolean
    breakOnErrors?: boolean
  }
}

export interface ErrorHandler {
  canHandle: (error: Error) => boolean
  handle: (error: DCEError, context: ErrorHandlingContext) => Promise<void>
  priority?: number
}

export interface RollbackStrategy {
  enabled: boolean
  /** Store initial state for rollback */
  preserveInitialState?: boolean
  /** Specific state keys to rollback */
  rollbackKeys?: string[]
  /** Skip rollback for certain error types */
  skipForErrorTypes?: string[]
}

export interface ErrorHandlingContext {
  storeName: string
  actionName?: string
  previousState?: unknown
  currentState?: unknown
  attempt: number
  recoveryManager: RecoveryManager
  reporter: ErrorReporter
}

// Default Configuration
// ====================

const DEFAULT_CONFIG: Required<Omit<ErrorHandlingConfig, 'storeName' | 'customHandlers' | 'customContext'>> = {
  enableRecovery: true,
  enableReporting: true,
  maxRecoveryAttempts: 3,
  recoveryTimeout: 30000,
  rollbackStrategy: {
    enabled: true,
    preserveInitialState: true,
    skipForErrorTypes: ['ValidationError', 'BusinessLogicError'],
  },
  development: {
    logErrors: true,
    logRecovery: true,
    breakOnErrors: false,
  },
}

// Middleware Implementation
// ========================

export interface ErrorHandlingMiddleware {
  hasError: boolean
  lastError: DCEError | null
  errorHistory: DCEError[]
  recoveryAttempts: number
  isRecovering: boolean
  clearError: () => void
  retryLastAction: () => Promise<void>
  getRecoveryStatus: () => RecoveryStatus
}

export interface RecoveryStatus {
  isRecovering: boolean
  attempts: number
  maxAttempts: number
  strategy: RecoveryStrategy | null
  estimatedTimeRemaining?: number
}

// Zustand v5 compatible setState type with proper overloads
type SetStateInternal<T> = {
  (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: false): void
  (state: T | ((state: T) => T), replace: true): void
}

// Error handling middleware implementation type with v5 compatibility
type ErrorHandlingMiddlewareImpl = <
  T extends Record<string, unknown>
>(
  config: ErrorHandlingConfig
) => (
  f: StateCreator<T, [], [], T>
) => StateCreator<T, [], [], T & ErrorHandlingMiddleware>

// StoreMutators declaration moved to resourceCleanup.ts to avoid conflicts
// Note: Removed unused type parameters _Write and _StoreErrorHandling

// Core Middleware Factory
// ======================

export const createErrorHandlingMiddleware: ErrorHandlingMiddlewareImpl = <
  T extends Record<string, unknown>
>(config: ErrorHandlingConfig) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const recoveryManager = new RecoveryManager(fullConfig)
  const reporter = new ErrorReporter(fullConfig)

  let initialState: T | null = null
  let lastAction: { name: string; args: unknown[] } | null = null
  const errorHistory: DCEError[] = []
  let recoveryAttempts = 0
  let isRecovering = false

  return (stateCreator: StateCreator<T, [], [], T>) => (
    set: SetStateInternal<T>,
    get: () => T,
    api: StoreApi<T>
  ) => {
    // Wrap setState to intercept errors with proper v5 overloads
    function createWrappedSet(): SetStateInternal<T> {
      // Create overloaded function that matches Zustand v5 signatures
      function wrappedSetOverload(partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: false): void
      function wrappedSetOverload(state: T | ((state: T) => T), replace: true): void
      function wrappedSetOverload(partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean): void {
      try {
        // Extract action name from partial if it's a function with metadata or use default
        const actionName = 'storeUpdate'
        lastAction = { name: actionName, args: [] }

        // Store initial state on first action
        if (initialState === null && fullConfig.rollbackStrategy.preserveInitialState) {
          initialState = structuredClone(get()) as T
        }

        const previousState: T = get()
        
        // Handle Zustand v5 overloads properly
        if (replace === true) {
          // Full state replacement - call with exact v5 signature
          set(partial as T, true)
        } else {
          // Partial update (default) - call with exact v5 signature  
          set(partial, replace || false)
        }
        
        // Validate state after update if validators exist
        const currentState: T = get()
        validateStateTransition(previousState, currentState, actionName, fullConfig.storeName)

      } catch (error: unknown) {
        void handleError(error, {
          storeName: fullConfig.storeName,
          actionName: 'storeUpdate',
          previousState: get(),
          currentState: undefined,
          attempt: recoveryAttempts,
          recoveryManager,
          reporter,
        }, wrappedSetOverload)
      }
      }
      return wrappedSetOverload
    }
    
    const wrappedSet = createWrappedSet()

    // Create base store with wrapped setState
    const store = stateCreator(wrappedSet, get, api)

    // Add error handling methods
    const errorHandlingExtension: ErrorHandlingMiddleware = {
      hasError: false,
      lastError: null,
      errorHistory: [...errorHistory],
      recoveryAttempts,
      isRecovering,

      clearError: (): void => {
        wrappedSet(
          (state: T) => ({
            ...state,
            hasError: false,
            lastError: null,
          } as T & { hasError: boolean; lastError: null }),
          false
        )
      },

      retryLastAction: async (): Promise<void> => {
        if (!lastAction) {
          throw createError.state('No action to retry', fullConfig.storeName)
        }

        isRecovering = true
        wrappedSet(
          (state: T) => ({ ...state, isRecovering: true } as T & { isRecovering: boolean }),
          false
        )

        try {
          await executeWithRetry(lastAction, wrappedSet, get, fullConfig)
          recoveryAttempts = 0
        } catch (error: unknown) {
          void handleError(error, {
            storeName: fullConfig.storeName,
            actionName: lastAction.name,
            previousState: get(),
            currentState: undefined,
            attempt: recoveryAttempts + 1,
            recoveryManager,
            reporter,
          }, wrappedSet)
        } finally {
          isRecovering = false
          wrappedSet(
            (state: T) => ({ ...state, isRecovering: false } as T & { isRecovering: boolean }),
            false
          )
        }
      },

      getRecoveryStatus: (): RecoveryStatus => ({
        isRecovering,
        attempts: recoveryAttempts,
        maxAttempts: fullConfig.maxRecoveryAttempts,
        strategy: errorHistory[errorHistory.length - 1]?.getRecoveryStrategy() || null,
      }),
    }

    return { ...store, ...errorHandlingExtension } as T & ErrorHandlingMiddleware
  }

  // Error Handling Logic
  // ===================

  async function handleError(
    error: unknown, 
    context: ErrorHandlingContext,
    wrappedSet: SetStateInternal<T>
  ): Promise<void> {
    let dceError: DCEError

    // Convert to DCE error if needed
    if (error instanceof DCEError) {
      dceError = error
    } else if (error instanceof Error) {
      dceError = createError.state(
        error.message,
        context.storeName,
        context.actionName,
        context.currentState,
        {
          cause: error,
          context: buildErrorContext(context),
        }
      )
    } else {
      dceError = createError.state(
        'Unknown error occurred',
        context.storeName,
        context.actionName,
        context.currentState,
        {
          context: buildErrorContext(context, { originalError: error }),
        }
      )
    }

    // Add to error history
    errorHistory.push(dceError)
    if (errorHistory.length > 100) {
      errorHistory.splice(0, errorHistory.length - 100)
    }

    // Update store state with error info
    const storeUpdate = {
      hasError: true,
      lastError: dceError,
      errorHistory: [...errorHistory],
      recoveryAttempts: context.attempt,
    }

    // Report error if enabled
    if (fullConfig.enableReporting) {
      try {
        await reporter.report(dceError, context)
      } catch (reportingError) {
        if (fullConfig.development.logErrors) {
          console.warn('Error reporting failed:', reportingError)
        }
      }
    }

    // Log in development
    if (fullConfig.development.logErrors) {
      console.error(`[${fullConfig.storeName}] Error:`, dceError)
      if (fullConfig.development.breakOnErrors && process.env.NODE_ENV === 'development') {
        // eslint-disable-next-line no-debugger
        debugger // Only in development
      }
    }

    // Attempt recovery if enabled
    if (fullConfig.enableRecovery && context.attempt < fullConfig.maxRecoveryAttempts) {
      try {
        isRecovering = true
        const recovered = await recoveryManager.recover(dceError, context)
        
        if (recovered) {
          if (fullConfig.development.logRecovery) {
            console.log(`[${fullConfig.storeName}] Recovery successful for:`, dceError.message)
          }
          return
        }
      } catch (recoveryError) {
        if (fullConfig.development.logErrors) {
          console.error(`[${fullConfig.storeName}] Recovery failed:`, recoveryError)
        }
      } finally {
        isRecovering = false
      }
    }

    // Perform rollback if configured
    if (shouldRollback(dceError, fullConfig.rollbackStrategy)) {
      await performRollback(context, fullConfig, wrappedSet)
    }

    // Update store with final error state
    wrappedSet(
      (state: T) => ({ ...state, ...storeUpdate } as T & typeof storeUpdate),
      false
    )

    // Re-throw if not recoverable
    if (!dceError.recoverable) {
      throw dceError
    }
  }

  function validateStateTransition(
    previousState: T,
    currentState: T,
    actionName: string,
    storeName: string
  ): void {
    // Add custom state validation logic here
    // For now, just check for circular references and validate state shape
    try {
      JSON.stringify(currentState)
      
      // Additional validation could be added here based on previousState
      if (previousState && typeof previousState === 'object' && typeof currentState === 'object') {
        // Validate that essential store structure is maintained
        const requiredKeys = ['hasError', 'lastError', 'errorHistory'] 
        for (const key of requiredKeys) {
          if (key in previousState && !(key in currentState)) {
            console.warn(`State transition removed required key: ${key}`)
          }
        }
      }
    } catch (error) {
      throw createError.state(
        'State contains circular references or is invalid',
        storeName,
        actionName,
        currentState,
        { cause: error as Error }
      )
    }
  }

  function buildErrorContext(
    context: ErrorHandlingContext,
    additional: Record<string, unknown> = {}
  ): ErrorContext {
    return {
      storeName: context.storeName,
      actionType: context.actionName,
      timestamp: Date.now(),
      userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location.href : undefined,
      ...fullConfig.customContext,
      ...additional,
    }
  }

  function shouldRollback(error: DCEError, strategy: RollbackStrategy): boolean {
    if (!strategy.enabled) return false
    if (strategy.skipForErrorTypes?.includes(error.constructor.name)) return false
    return error.severity === 'critical' || error.severity === 'high'
  }

  async function performRollback(
    context: ErrorHandlingContext,
    config: Required<Omit<ErrorHandlingConfig, 'storeName' | 'customHandlers' | 'customContext'>>,
    wrappedSet: SetStateInternal<T>
  ): Promise<void> {
    if (!initialState) return

    try {
      if (config.rollbackStrategy.rollbackKeys) {
        // Partial rollback
        const rollbackData: Record<string, unknown> = {}
        for (const key of config.rollbackStrategy.rollbackKeys) {
          if (key in (initialState as Record<string, unknown>)) {
            rollbackData[key] = (initialState as Record<string, unknown>)[key]
          }
        }
        wrappedSet((state: T) => ({ ...state, ...rollbackData } as T & Record<string, unknown>), false)
      } else {
        // Full rollback
        wrappedSet(initialState as T, true)
      }

      if (config.development.logRecovery) {
        console.log(`[${context.storeName}] State rolled back after error`)
      }
    } catch (rollbackError) {
      if (config.development.logErrors) {
        console.error(`[${context.storeName}] Rollback failed:`, rollbackError)
      }
    }
  }

  async function executeWithRetry(
    action: { name: string; args: unknown[] },
    _wrappedSet: SetStateInternal<T>,
    _get: () => T,
    _config: Required<Omit<ErrorHandlingConfig, 'storeName' | 'customHandlers' | 'customContext'>> & { storeName: string }
  ): Promise<void> {
    // This would be implemented based on specific store action patterns
    // For now, it's a placeholder that would integrate with specific store implementations
    throw createError.state('Retry not implemented for this action', fullConfig.storeName, action.name)
  }
}

// Convenience Functions
// ====================

export function withErrorHandling<T extends Record<string, unknown>>(
  storeCreator: StateCreator<T, [], [], T>,
  config: ErrorHandlingConfig
): StateCreator<T & ErrorHandlingMiddleware, [], [], T & ErrorHandlingMiddleware> {
  return createErrorHandlingMiddleware<T>(config)(storeCreator)
}

export function createSafeAsync<T extends unknown[], R>(
  asyncFn: (...args: T) => Promise<R>,
  errorContext: Partial<ErrorContext> = {}
): (...args: T) => Promise<R | null> {
  return async (...args: T): Promise<R | null> => {
    try {
      return await asyncFn(...args)
    } catch (error) {
      let dceError: DCEError

      if (error instanceof DCEError) {
        dceError = error
      } else if (error instanceof Error) {
        dceError = createError.state(error.message, errorContext.storeName, errorContext.actionType, undefined, {
          cause: error,
          context: errorContext,
        })
      } else {
        dceError = createError.state('Unknown async error', errorContext.storeName, errorContext.actionType, undefined, {
          context: { ...errorContext, originalError: error },
        })
      }

      // Report error
      try {
        await reportError(dceError, errorContext)
      } catch (reportingError) {
        console.warn('Error reporting failed:', reportingError)
      }

      // Log in development
      if (process.env.NODE_ENV === 'development') {
        console.error('Safe async function error:', dceError)
      }

      return null
    }
  }
}

// Note: Types are already exported via interface declarations above
// Removing duplicate type exports to resolve conflicts