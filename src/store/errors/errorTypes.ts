/**
 * DCE Error Management System - Typed Error Classes
 * 
 * Provides a comprehensive hierarchy of typed error classes for the DCE platform,
 * enabling precise error handling and recovery strategies across all store operations.
 */

// Base Error Classes
// =================

export abstract class DCEError extends Error {
  public readonly timestamp: number
  public readonly errorId: string
  public readonly severity: ErrorSeverity
  public readonly category: ErrorCategory
  public readonly context: ErrorContext
  public readonly recoverable: boolean
  public readonly retryable: boolean

  constructor(
    message: string,
    options: ErrorOptions = {}
  ) {
    super(message)
    this.name = this.constructor.name
    this.timestamp = options.timestamp ?? Date.now()
    this.errorId = options.errorId ?? this.generateErrorId()
    this.severity = options.severity ?? 'medium'
    this.category = options.category ?? 'system'
    this.context = options.context ?? {}
    this.recoverable = options.recoverable ?? false
    this.retryable = options.retryable ?? false

    // Maintain proper stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor)
    }
  }

  private generateErrorId(): string {
    return `dce_${this.timestamp}_${Math.random().toString(36).substr(2, 9)}`
  }

  abstract toMonitoringError(): MonitoringError
  
  public shouldRetry(attemptCount: number): boolean {
    return this.retryable && attemptCount < 3
  }

  public getRecoveryStrategy(): RecoveryStrategy | null {
    return this.recoverable ? this.getDefaultRecoveryStrategy() : null
  }

  protected abstract getDefaultRecoveryStrategy(): RecoveryStrategy
}

// Authentication & Authorization Errors
// ====================================

export class AuthenticationError extends DCEError {
  constructor(message: string, options: ErrorOptions = {}) {
    super(message, {
      ...options,
      category: 'authentication',
      severity: options.severity ?? 'high',
      recoverable: true,
      retryable: false,
    })
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'authentication' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'redirect',
      action: 'signOut',
      message: 'Please sign in again to continue',
      fallbackUrl: '/login',
    }
  }
}

export class AuthorizationError extends DCEError {
  public readonly requiredRole: string
  public readonly userRole: string

  constructor(
    message: string, 
    requiredRole: string, 
    userRole: string,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'authorization',
      severity: options.severity ?? 'high',
      recoverable: true,
      retryable: false,
    })
    this.requiredRole = requiredRole
    this.userRole = userRole
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'authorization' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        requiredRole: this.requiredRole,
        userRole: this.userRole,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'redirect',
      action: 'showAccessDenied',
      message: `Access denied. Required role: ${this.requiredRole}`,
      fallbackUrl: '/dashboard',
    }
  }
}

// Network & API Errors
// ===================

export class NetworkError extends DCEError {
  public readonly statusCode?: number
  public readonly endpoint?: string
  public readonly method?: string

  constructor(
    message: string,
    statusCode?: number,
    endpoint?: string,
    method?: string,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'network',
      severity: options.severity ?? NetworkError.getSeverityFromStatus(statusCode),
      recoverable: true,
      retryable: NetworkError.isRetryableStatus(statusCode),
    })
    this.statusCode = statusCode
    this.endpoint = endpoint
    this.method = method
  }

  private static getSeverityFromStatus(status?: number): ErrorSeverity {
    if (!status) return 'medium'
    if (status >= 500) return 'high'
    if (status >= 400) return 'medium'
    return 'low'
  }

  private static isRetryableStatus(status?: number): boolean {
    if (!status) return true
    // Retry on 5xx errors, 408 (timeout), 429 (rate limit)
    return status >= 500 || status === 408 || status === 429
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'network' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        statusCode: this.statusCode,
        endpoint: this.endpoint,
        method: this.method,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    if (this.statusCode && this.statusCode >= 500) {
      return {
        type: 'retry',
        action: 'exponentialBackoff',
        message: 'Server error occurred. Retrying...',
        maxAttempts: 3,
        baseDelay: 1000,
      }
    }

    if (this.statusCode === 429) {
      return {
        type: 'retry',
        action: 'rateLimitBackoff',
        message: 'Rate limit exceeded. Please wait...',
        maxAttempts: 2,
        baseDelay: 5000,
      }
    }

    return {
      type: 'fallback',
      action: 'showErrorMessage',
      message: 'Network error occurred. Please try again.',
    }
  }
}

export class APIError extends NetworkError {
  public readonly apiCode?: string
  public readonly details?: unknown

  constructor(
    message: string,
    statusCode?: number,
    apiCode?: string,
    details?: unknown,
    options: ErrorOptions = {}
  ) {
    super(message, statusCode, options.context?.endpoint as string, options.context?.method as string, {
      ...options,
      category: 'api',
    })
    this.apiCode = apiCode
    this.details = details
  }

  toMonitoringError(): MonitoringError {
    const baseError = super.toMonitoringError()
    return {
      ...baseError,
      type: 'api' as const,
      context: {
        ...baseError.context,
        apiCode: this.apiCode,
        details: this.details,
      },
    }
  }
}

// Data & Validation Errors
// =======================

export class ValidationError extends DCEError {
  public readonly field?: string
  public readonly validationRule?: string
  public readonly receivedValue?: unknown

  constructor(
    message: string,
    field?: string,
    validationRule?: string,
    receivedValue?: unknown,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'validation',
      severity: options.severity ?? 'medium',
      recoverable: true,
      retryable: false,
    })
    this.field = field
    this.validationRule = validationRule
    this.receivedValue = receivedValue
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'validation' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        field: this.field,
        validationRule: this.validationRule,
        receivedValue: this.receivedValue,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'validation',
      action: 'showFieldError',
      message: this.message,
      field: this.field,
    }
  }
}

export class DataError extends DCEError {
  public readonly dataType?: string
  public readonly operation?: string

  constructor(
    message: string,
    dataType?: string,
    operation?: string,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'data',
      severity: options.severity ?? 'medium',
      recoverable: false,
      retryable: false,
    })
    this.dataType = dataType
    this.operation = operation
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'data' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        dataType: this.dataType,
        operation: this.operation,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'fallback',
      action: 'showErrorMessage',
      message: 'Data processing error occurred. Please refresh and try again.',
    }
  }
}

// State Management Errors
// ======================

export class StateError extends DCEError {
  public readonly storeName?: string
  public readonly actionType?: string
  public readonly stateSnapshot?: unknown

  constructor(
    message: string,
    storeName?: string,
    actionType?: string,
    stateSnapshot?: unknown,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'state',
      severity: options.severity ?? 'high',
      recoverable: true,
      retryable: false,
    })
    this.storeName = storeName
    this.actionType = actionType
    this.stateSnapshot = stateSnapshot
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'state' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        storeName: this.storeName,
        actionType: this.actionType,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'state',
      action: 'resetStore',
      message: 'State error occurred. Resetting to safe state...',
      storeName: this.storeName,
    }
  }
}

export class ConcurrencyError extends StateError {
  public readonly conflictingAction?: string

  constructor(
    message: string,
    storeName?: string,
    actionType?: string,
    conflictingAction?: string,
    options: ErrorOptions = {}
  ) {
    super(message, storeName, actionType, undefined, {
      ...options,
      severity: 'high',
    })
    this.conflictingAction = conflictingAction
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'state',
      action: 'refreshState',
      message: 'Concurrent modification detected. Refreshing state...',
      storeName: this.storeName,
    }
  }
}

// Business Logic Errors
// ====================

export class BusinessLogicError extends DCEError {
  public readonly businessRule?: string
  public readonly entityType?: string
  public readonly entityId?: string

  constructor(
    message: string,
    businessRule?: string,
    entityType?: string,
    entityId?: string,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'business',
      severity: options.severity ?? 'medium',
      recoverable: true,
      retryable: false,
    })
    this.businessRule = businessRule
    this.entityType = entityType
    this.entityId = entityId
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'business' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        businessRule: this.businessRule,
        entityType: this.entityType,
        entityId: this.entityId,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'validation',
      action: 'showBusinessRuleError',
      message: this.message,
      businessRule: this.businessRule,
    }
  }
}

// Configuration & System Errors  
// ============================

export class ConfigurationError extends DCEError {
  public readonly configKey?: string
  public readonly expectedType?: string

  constructor(
    message: string,
    configKey?: string,
    expectedType?: string,
    options: ErrorOptions = {}
  ) {
    super(message, {
      ...options,
      category: 'configuration',
      severity: options.severity ?? 'critical',
      recoverable: false,
      retryable: false,
    })
    this.configKey = configKey
    this.expectedType = expectedType
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: 'system' as const,
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        configKey: this.configKey,
        expectedType: this.expectedType,
        errorCategory: this.category,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    return {
      type: 'fallback',
      action: 'showCriticalError',
      message: 'Configuration error detected. Please contact support.',
    }
  }
}

// Type Definitions
// ===============

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'

export type ErrorCategory = 
  | 'authentication'
  | 'authorization' 
  | 'network'
  | 'api'
  | 'validation'
  | 'data'
  | 'state'
  | 'business'
  | 'configuration'
  | 'system'

export interface ErrorContext {
  userId?: string
  userType?: string
  sessionId?: string
  requestId?: string
  storeName?: string
  actionType?: string
  endpoint?: string
  method?: string
  userAgent?: string
  url?: string
  timestamp?: number
  [key: string]: unknown
}

export interface ErrorOptions {
  timestamp?: number
  errorId?: string
  severity?: ErrorSeverity
  category?: ErrorCategory
  context?: ErrorContext
  recoverable?: boolean
  retryable?: boolean
  cause?: Error
}

export interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'redirect' | 'validation' | 'state'
  action: string
  message: string
  maxAttempts?: number
  baseDelay?: number
  fallbackUrl?: string
  field?: string
  businessRule?: string
  storeName?: string
}

// Re-export monitoring error type for compatibility
export interface MonitoringError {
  id: string
  timestamp: number
  type: 'performance' | 'state' | 'selector' | 'query' | 'system' | 'network' | 'api' | 'authentication' | 'authorization' | 'validation' | 'data' | 'business'
  severity: ErrorSeverity
  message: string
  stack?: string
  context: ErrorContext
  resolved: boolean
}

// Error Factory Functions
// ======================

export const createError = {
  authentication: (message: string, options?: ErrorOptions) => 
    new AuthenticationError(message, options),
  
  authorization: (message: string, requiredRole: string, userRole: string, options?: ErrorOptions) =>
    new AuthorizationError(message, requiredRole, userRole, options),
  
  network: (message: string, statusCode?: number, endpoint?: string, method?: string, options?: ErrorOptions) =>
    new NetworkError(message, statusCode, endpoint, method, options),
  
  api: (message: string, statusCode?: number, apiCode?: string, details?: unknown, options?: ErrorOptions) =>
    new APIError(message, statusCode, apiCode, details, options),
  
  validation: (message: string, field?: string, rule?: string, value?: unknown, options?: ErrorOptions) =>
    new ValidationError(message, field, rule, value, options),
  
  data: (message: string, dataType?: string, operation?: string, options?: ErrorOptions) =>
    new DataError(message, dataType, operation, options),
  
  state: (message: string, storeName?: string, actionType?: string, snapshot?: unknown, options?: ErrorOptions) =>
    new StateError(message, storeName, actionType, snapshot, options),
  
  concurrency: (message: string, storeName?: string, actionType?: string, conflictingAction?: string, options?: ErrorOptions) =>
    new ConcurrencyError(message, storeName, actionType, conflictingAction, options),
  
  business: (message: string, rule?: string, entityType?: string, entityId?: string, options?: ErrorOptions) =>
    new BusinessLogicError(message, rule, entityType, entityId, options),
  
  configuration: (message: string, configKey?: string, expectedType?: string, options?: ErrorOptions) =>
    new ConfigurationError(message, configKey, expectedType, options),
}