/**
 * DCE Error Management System - Main Export
 * 
 * Centralized exports for the complete error management system
 */

// Core Error Types
export {
  DCEError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  APIError,
  ValidationError,
  DataError,
  StateError,
  ConcurrencyError,
  BusinessLogicError,
  ConfigurationError,
  createError,
} from './errorTypes'

export type {
  ErrorSeverity,
  ErrorCategory,
  ErrorContext,
  ErrorOptions,
  RecoveryStrategy,
  MonitoringError,
} from './errorTypes'

// Error Handling Middleware
export {
  createErrorHandlingMiddleware,
  withErrorHandling,
  createSafeAsync,
} from '../middleware/errorHandling'

export type {
  ErrorHandlingConfig,
  ErrorHandler,
  RollbackStrategy,
  ErrorHandlingContext,
  ErrorHandlingMiddleware,
  RecoveryStatus,
} from '../middleware/errorHandling'

// Recovery System
export {
  RecoveryManager,
  createRetryableOperation,
  isRetryableError,
  calculateNextRetryDelay,
} from './recovery'

export type {
  RecoveryConfig,
  RetryableOperation,
  CircuitBreakerState,
} from './recovery'

// Error Reporting
export {
  ErrorReporter,
  reportError,
  setGlobalErrorReporter,
  getGlobalErrorReporter,
  DEFAULT_ERROR_FILTERS,
  DEFAULT_ERROR_TRANSFORMERS,
} from './reporting'

export type {
  ErrorReportingConfig,
  ErrorFilter,
  ErrorTransformer,
  ErrorReport,
  ErrorSummary,
  ErrorTrends,
  UserImpactAnalysis,
  PerformanceImpactAnalysis,
} from './reporting'

// Convenience factory function for setting up complete error management
export function createErrorManagementSystem(config: {
  storeName: string
  enableRecovery?: boolean
  enableReporting?: boolean
  sentryDsn?: string
  maxRetryAttempts?: number
  customErrorFilters?: import('./reporting').ErrorFilter[]
  customErrorTransformers?: import('./reporting').ErrorTransformer[]
}) {
  const errorHandlingConfig: import('../middleware/errorHandling').ErrorHandlingConfig = {
    storeName: config.storeName,
    enableRecovery: config.enableRecovery ?? true,
    enableReporting: config.enableReporting ?? true,
    maxRecoveryAttempts: config.maxRetryAttempts ?? 3,
    development: {
      logErrors: process.env.NODE_ENV === 'development',
      logRecovery: process.env.NODE_ENV === 'development',
      breakOnErrors: false,
    },
  }

  const reportingConfig = {
    enabled: config.enableReporting ?? true,
    sentryDsn: config.sentryDsn,
    filters: config.customErrorFilters ?? [],
    transformers: config.customErrorTransformers ?? [],
  }

  return {
    middleware: createErrorHandlingMiddleware(errorHandlingConfig),
    reporter: new ErrorReporter(errorHandlingConfig),
    recoveryManager: new RecoveryManager(errorHandlingConfig),
    createSafeAsync: (fn: Function) => createSafeAsync(fn, { storeName: config.storeName }),
  }
}