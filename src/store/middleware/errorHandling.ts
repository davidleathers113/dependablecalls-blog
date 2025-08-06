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

import { StateCreator } from 'zustand'
import { DCEError, createError, ErrorContext, RecoveryStrategy } from '../errors/errorTypes'
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

type ErrorHandlingMiddlewareImpl = <
  T,
  A extends string = 'errorHandling'
>(
  config: ErrorHandlingConfig
) => (
  f: StateCreator<T, [], [], T>,
  name?: A
) => StateCreator<T, [], [], T & ErrorHandlingMiddleware, A>

// StoreMutators declaration moved to resourceCleanup.ts to avoid conflicts
// declare module 'zustand/vanilla' {
//   interface StoreMutators<S, A, T, U> {
//     errorHandling: Write<S, StoreErrorHandling<S>>
//   }
// }

type _Write<T, U> = Omit<T, keyof U> & U
type _StoreErrorHandling<S> = S extends { getState: () => infer T }
  ? S & {
      setState: (
        partial: T | Partial<T> | ((state: T) => T | Partial<T>),
        replace?: boolean | undefined,
        action?: string | { type: unknown }
      ) => void
    }
  : never

// Core Middleware Factory
// ======================

export const createErrorHandlingMiddleware: ErrorHandlingMiddlewareImpl = (config) => {
  const fullConfig = { ...DEFAULT_CONFIG, ...config }
  const recoveryManager = new RecoveryManager(fullConfig)
  const reporter = new ErrorReporter(fullConfig)

  let initialState: unknown = null
  let lastAction: { name: string; args: unknown[] } | null = null
  const errorHistory: DCEError[] = []
  let recoveryAttempts = 0
  let isRecovering = false

  return (stateCreator) => (set, get, api) => {
    // Wrap setState to intercept errors
    const wrappedSet: typeof set = (partial, replace, action) => {
      try {
        const actionName = typeof action === 'string' ? action : action?.type?.toString() || 'unknown'
        lastAction = { name: actionName, args: [] }

        // Store initial state on first action
        if (initialState === null && fullConfig.rollbackStrategy.preserveInitialState) {
          initialState = structuredClone(get())
        }

        const previousState = get()
        set(partial, replace, action)
        
        // Validate state after update if validators exist
        const currentState = get()
        validateStateTransition(previousState, currentState, actionName, fullConfig.storeName)

      } catch (error) {
        handleError(error, {
          storeName: fullConfig.storeName,
          actionName: typeof action === 'string' ? action : action?.type?.toString(),
          previousState: get(),
          currentState: undefined,
          attempt: recoveryAttempts,
          recoveryManager,
          reporter,
        })
      }
    }

    // Create base store with wrapped setState
    const store = stateCreator(wrappedSet, get, api)

    // Add error handling methods
    const errorHandlingExtension: ErrorHandlingMiddleware = {
      hasError: false,
      lastError: null,
      errorHistory: [...errorHistory],
      recoveryAttempts,
      isRecovering,

      clearError: () => {
        wrappedSet(
          (state) => ({
            ...state,
            hasError: false,
            lastError: null,
          }),
          false,
          'clearError'
        )
      },

      retryLastAction: async () => {
        if (!lastAction) {
          throw createError.state('No action to retry', fullConfig.storeName)
        }

        isRecovering = true
        wrappedSet(
          (state) => ({ ...state, isRecovering: true }),
          false,
          'startRetry'
        )

        try {
          await executeWithRetry(lastAction, wrappedSet, get, api, fullConfig)
          recoveryAttempts = 0
        } catch (error) {
          handleError(error, {
            storeName: fullConfig.storeName,
            actionName: lastAction.name,
            previousState: get(),
            currentState: undefined,
            attempt: recoveryAttempts + 1,
            recoveryManager,
            reporter,
          })
        } finally {
          isRecovering = false
          wrappedSet(
            (state) => ({ ...state, isRecovering: false }),
            false,
            'endRetry'
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

    return { ...store, ...errorHandlingExtension }
  }

  // Error Handling Logic
  // ===================

  async function handleError(error: unknown, context: ErrorHandlingContext): Promise<void> {
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
      await performRollback(context, fullConfig)
    }

    // Update store with final error state
    set(
      (state) => ({ ...state, ...storeUpdate }),
      false,
      'errorHandled'
    )

    // Re-throw if not recoverable
    if (!dceError.recoverable) {
      throw dceError
    }
  }

  function validateStateTransition(
    previousState: unknown,
    currentState: unknown,
    actionName: string,
    storeName: string
  ): void {
    // Add custom state validation logic here
    // For now, just check for circular references
    try {
      JSON.stringify(currentState)
    } catch (error) {
      throw createError.state(
        'State contains circular references',
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
    config: Required<Omit<ErrorHandlingConfig, 'storeName' | 'customHandlers' | 'customContext'>>
  ): Promise<void> {
    if (!initialState) return

    try {
      if (config.rollbackStrategy.rollbackKeys) {
        // Partial rollback
        const rollbackData = {}
        for (const key of config.rollbackStrategy.rollbackKeys) {
          if (key in (initialState as object)) {
            rollbackData[key] = (initialState as Record<string, unknown>)[key]
          }
        }
        set((state) => ({ ...state, ...rollbackData }), false, 'rollbackPartial')
      } else {
        // Full rollback
        set(initialState, true, 'rollbackFull')
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
    set: typeof api.setState,
    get: typeof api.getState,
    api: typeof api,
    config: Required<Omit<ErrorHandlingConfig, 'storeName' | 'customHandlers' | 'customContext'>>
  ): Promise<void> {
    // This would be implemented based on specific store action patterns
    // For now, it's a placeholder that would integrate with specific store implementations
    throw createError.state('Retry not implemented for this action', config.storeName, action.name)
  }
}

// Convenience Functions
// ====================

export function withErrorHandling<T>(
  storeCreator: StateCreator<T>,
  config: ErrorHandlingConfig
): StateCreator<T & ErrorHandlingMiddleware> {
  return createErrorHandlingMiddleware(config)(storeCreator)
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

// Type Exports
// ===========

export type {
  ErrorHandlingConfig,
  ErrorHandler,
  RollbackStrategy,
  ErrorHandlingContext,
  ErrorHandlingMiddleware,
  RecoveryStatus,
}