/**
 * Store Error System Enhancement
 * 
 * Extends the existing DCE error system with service-layer specific error codes
 * and standardized error handling patterns for store-service integration.
 * 
 * This module provides:
 * - Service-specific error codes for better telemetry and i18n
 * - Enhanced error factory functions for common operations
 * - Integration with existing DCE error handling middleware
 * - Migration helpers for store-to-service transitions
 */

import {
  DCEError,
  createError as baseFcreateError,
  type ErrorContext,
  type ErrorOptions,
  type RecoveryStrategy,
  type MonitoringError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  APIError,
  ValidationError,
  DataError,
  StateError,
  BusinessLogicError,
  ConfigurationError,
} from '../../store/errors/errorTypes'

// Service-Specific Error Codes
// ============================

export const STORE_ERROR_CODES = {
  // Authentication & Authorization Errors
  AUTH_SESSION_EXPIRED: 'STORE_AUTH_SESSION_EXPIRED',
  AUTH_INVALID_CREDENTIALS: 'STORE_AUTH_INVALID_CREDENTIALS',
  AUTH_MAGIC_LINK_EXPIRED: 'STORE_AUTH_MAGIC_LINK_EXPIRED',
  AUTH_MFA_REQUIRED: 'STORE_AUTH_MFA_REQUIRED',
  AUTH_INSUFFICIENT_PERMISSIONS: 'STORE_AUTH_INSUFFICIENT_PERMISSIONS',

  // Data & State Management Errors
  DATA_FETCH_FAILED: 'STORE_DATA_FETCH_FAILED',
  DATA_SAVE_FAILED: 'STORE_DATA_SAVE_FAILED',
  DATA_DELETE_FAILED: 'STORE_DATA_DELETE_FAILED',
  DATA_VALIDATION_FAILED: 'STORE_DATA_VALIDATION_FAILED',
  DATA_CONFLICT: 'STORE_DATA_CONFLICT',
  DATA_NOT_FOUND: 'STORE_DATA_NOT_FOUND',
  
  // Campaign Management Errors
  CAMPAIGN_CREATE_FAILED: 'STORE_CAMPAIGN_CREATE_FAILED',
  CAMPAIGN_UPDATE_FAILED: 'STORE_CAMPAIGN_UPDATE_FAILED',
  CAMPAIGN_DELETE_FAILED: 'STORE_CAMPAIGN_DELETE_FAILED',
  CAMPAIGN_BUDGET_EXCEEDED: 'STORE_CAMPAIGN_BUDGET_EXCEEDED',
  CAMPAIGN_INVALID_STATUS: 'STORE_CAMPAIGN_INVALID_STATUS',
  CAMPAIGN_TARGETING_INVALID: 'STORE_CAMPAIGN_TARGETING_INVALID',
  
  // Call Tracking Errors
  CALL_TRACKING_INIT_FAILED: 'STORE_CALL_TRACKING_INIT_FAILED',
  CALL_TRACKING_UPDATE_FAILED: 'STORE_CALL_TRACKING_UPDATE_FAILED',
  CALL_NUMBER_UNAVAILABLE: 'STORE_CALL_NUMBER_UNAVAILABLE',
  CALL_RECORDING_FAILED: 'STORE_CALL_RECORDING_FAILED',
  
  // Billing & Payments Errors
  BILLING_PAYMENT_FAILED: 'STORE_BILLING_PAYMENT_FAILED',
  BILLING_INSUFFICIENT_FUNDS: 'STORE_BILLING_INSUFFICIENT_FUNDS',
  BILLING_CARD_DECLINED: 'STORE_BILLING_CARD_DECLINED',
  BILLING_SUBSCRIPTION_EXPIRED: 'STORE_BILLING_SUBSCRIPTION_EXPIRED',
  
  // Real-time & Sync Errors
  REALTIME_CONNECTION_FAILED: 'STORE_REALTIME_CONNECTION_FAILED',
  REALTIME_SYNC_FAILED: 'STORE_REALTIME_SYNC_FAILED',
  REALTIME_TIMEOUT: 'STORE_REALTIME_TIMEOUT',
  
  // Service Integration Errors
  SERVICE_UNAVAILABLE: 'STORE_SERVICE_UNAVAILABLE',
  SERVICE_RATE_LIMITED: 'STORE_SERVICE_RATE_LIMITED',
  SERVICE_DEPRECATED: 'STORE_SERVICE_DEPRECATED',
  SERVICE_MIGRATION_REQUIRED: 'STORE_SERVICE_MIGRATION_REQUIRED',
  
  // Configuration & Environment Errors
  CONFIG_MISSING_REQUIRED: 'STORE_CONFIG_MISSING_REQUIRED',
  CONFIG_INVALID_FORMAT: 'STORE_CONFIG_INVALID_FORMAT',
  ENV_VARIABLE_MISSING: 'STORE_ENV_VARIABLE_MISSING',
  
  // Network & External API Errors
  EXTERNAL_API_ERROR: 'STORE_EXTERNAL_API_ERROR',
  EXTERNAL_API_TIMEOUT: 'STORE_EXTERNAL_API_TIMEOUT',
  EXTERNAL_API_RATE_LIMITED: 'STORE_EXTERNAL_API_RATE_LIMITED',
} as const

export type StoreErrorCode = typeof STORE_ERROR_CODES[keyof typeof STORE_ERROR_CODES]

// Enhanced Error Classes
// ======================

export class StoreError extends DCEError {
  public readonly code: StoreErrorCode
  public readonly serviceName?: string
  public readonly operation?: string
  public readonly metadata: Record<string, unknown>

  constructor(
    code: StoreErrorCode,
    message: string,
    options: ErrorOptions & {
      serviceName?: string
      operation?: string
      metadata?: Record<string, unknown>
    } = {}
  ) {
    super(message, {
      ...options,
      context: {
        ...options.context,
        errorCode: code,
        serviceName: options.serviceName,
        operation: options.operation,
      },
    })
    
    this.code = code
    this.serviceName = options.serviceName
    this.operation = options.operation
    this.metadata = options.metadata || {}
  }

  toMonitoringError(): MonitoringError {
    return {
      id: this.errorId,
      timestamp: this.timestamp,
      type: this.inferErrorType(),
      severity: this.severity,
      message: this.message,
      stack: this.stack,
      context: {
        ...this.context,
        errorCode: this.code,
        serviceName: this.serviceName,
        operation: this.operation,
        metadata: this.metadata,
      },
      resolved: false,
    }
  }

  protected getDefaultRecoveryStrategy(): RecoveryStrategy {
    // Provide code-specific recovery strategies
    switch (this.code) {
      case STORE_ERROR_CODES.AUTH_SESSION_EXPIRED:
        return {
          type: 'redirect',
          action: 'refreshSession',
          message: 'Session expired. Please sign in again.',
          fallbackUrl: '/login',
        }
        
      case STORE_ERROR_CODES.DATA_CONFLICT:
        return {
          type: 'state',
          action: 'refreshState',
          message: 'Data conflict detected. Refreshing from server...',
        }
        
      case STORE_ERROR_CODES.SERVICE_RATE_LIMITED:
        return {
          type: 'retry',
          action: 'rateLimitBackoff',
          message: 'Rate limit exceeded. Retrying...',
          maxAttempts: 3,
          baseDelay: 5000,
        }
        
      case STORE_ERROR_CODES.REALTIME_CONNECTION_FAILED:
        return {
          type: 'retry',
          action: 'reconnect',
          message: 'Connection lost. Reconnecting...',
          maxAttempts: 5,
          baseDelay: 2000,
        }
        
      default:
        return {
          type: 'fallback',
          action: 'showErrorMessage',
          message: this.message,
        }
    }
  }

  private inferErrorType(): MonitoringError['type'] {
    if (this.code.includes('AUTH')) return 'authentication'
    if (this.code.includes('DATA') || this.code.includes('VALIDATION')) return 'data'
    if (this.code.includes('NETWORK') || this.code.includes('API')) return 'network'
    if (this.code.includes('BILLING') || this.code.includes('CAMPAIGN')) return 'business'
    if (this.code.includes('CONFIG') || this.code.includes('ENV')) return 'system'
    return 'state'
  }
}

// Enhanced Error Factory Functions
// ================================

export const createStoreError = {
  // Authentication Errors
  sessionExpired: (serviceName?: string, operation?: string) =>
    new StoreError(
      STORE_ERROR_CODES.AUTH_SESSION_EXPIRED,
      'Your session has expired. Please sign in again.',
      {
        serviceName,
        operation,
        severity: 'high',
        recoverable: true,
        retryable: false,
      }
    ),

  invalidCredentials: (serviceName?: string, operation?: string) =>
    new StoreError(
      STORE_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      'Invalid email or password provided.',
      {
        serviceName,
        operation,
        severity: 'medium',
        recoverable: true,
        retryable: false,
      }
    ),

  insufficientPermissions: (requiredRole: string, userRole: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS,
      `Access denied. Required role: ${requiredRole}, current role: ${userRole}`,
      {
        serviceName,
        operation: 'authorization',
        severity: 'high',
        recoverable: true,
        retryable: false,
        metadata: { requiredRole, userRole },
      }
    ),

  // Data Operation Errors
  fetchFailed: (resource: string, reason?: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.DATA_FETCH_FAILED,
      `Failed to fetch ${resource}${reason ? `: ${reason}` : ''}`,
      {
        serviceName,
        operation: 'fetch',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        metadata: { resource, reason },
      }
    ),

  saveFailed: (resource: string, reason?: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.DATA_SAVE_FAILED,
      `Failed to save ${resource}${reason ? `: ${reason}` : ''}`,
      {
        serviceName,
        operation: 'save',
        severity: 'high',
        recoverable: true,
        retryable: true,
        metadata: { resource, reason },
      }
    ),

  validationFailed: (field: string, rule: string, value?: unknown, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.DATA_VALIDATION_FAILED,
      `Validation failed for ${field}: ${rule}`,
      {
        serviceName,
        operation: 'validation',
        severity: 'medium',
        recoverable: true,
        retryable: false,
        metadata: { field, rule, value },
      }
    ),

  dataConflict: (resource: string, conflictType: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.DATA_CONFLICT,
      `Data conflict detected for ${resource}: ${conflictType}`,
      {
        serviceName,
        operation: 'save',
        severity: 'medium',
        recoverable: true,
        retryable: false,
        metadata: { resource, conflictType },
      }
    ),

  notFound: (resource: string, identifier: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.DATA_NOT_FOUND,
      `${resource} not found: ${identifier}`,
      {
        serviceName,
        operation: 'fetch',
        severity: 'medium',
        recoverable: false,
        retryable: false,
        metadata: { resource, identifier },
      }
    ),

  // Campaign Management Errors
  campaignBudgetExceeded: (campaignId: string, budget: number, attempted: number) =>
    new StoreError(
      STORE_ERROR_CODES.CAMPAIGN_BUDGET_EXCEEDED,
      `Campaign budget exceeded. Budget: $${budget}, Attempted: $${attempted}`,
      {
        serviceName: 'campaign',
        operation: 'budgetCheck',
        severity: 'high',
        recoverable: false,
        retryable: false,
        metadata: { campaignId, budget, attempted },
      }
    ),

  campaignInvalidStatus: (campaignId: string, currentStatus: string, requestedStatus: string) =>
    new StoreError(
      STORE_ERROR_CODES.CAMPAIGN_INVALID_STATUS,
      `Invalid status transition: ${currentStatus} → ${requestedStatus}`,
      {
        serviceName: 'campaign',
        operation: 'statusUpdate',
        severity: 'medium',
        recoverable: true,
        retryable: false,
        metadata: { campaignId, currentStatus, requestedStatus },
      }
    ),

  // Service Integration Errors
  serviceUnavailable: (serviceName: string, reason?: string) =>
    new StoreError(
      STORE_ERROR_CODES.SERVICE_UNAVAILABLE,
      `Service ${serviceName} is currently unavailable${reason ? `: ${reason}` : ''}`,
      {
        serviceName,
        operation: 'healthCheck',
        severity: 'high',
        recoverable: true,
        retryable: true,
        metadata: { reason },
      }
    ),

  serviceRateLimited: (serviceName: string, retryAfter?: number) =>
    new StoreError(
      STORE_ERROR_CODES.SERVICE_RATE_LIMITED,
      `Rate limit exceeded for ${serviceName}${retryAfter ? `. Retry after ${retryAfter}ms` : ''}`,
      {
        serviceName,
        operation: 'rateLimit',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        metadata: { retryAfter },
      }
    ),

  // Real-time Errors
  realtimeConnectionFailed: (reason?: string) =>
    new StoreError(
      STORE_ERROR_CODES.REALTIME_CONNECTION_FAILED,
      `Real-time connection failed${reason ? `: ${reason}` : ''}`,
      {
        serviceName: 'realtime',
        operation: 'connect',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        metadata: { reason },
      }
    ),

  realtimeSyncFailed: (resource: string, reason?: string) =>
    new StoreError(
      STORE_ERROR_CODES.REALTIME_SYNC_FAILED,
      `Failed to sync ${resource}${reason ? `: ${reason}` : ''}`,
      {
        serviceName: 'realtime',
        operation: 'sync',
        severity: 'medium',
        recoverable: true,
        retryable: true,
        metadata: { resource, reason },
      }
    ),

  // Configuration Errors
  configMissing: (configKey: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.CONFIG_MISSING_REQUIRED,
      `Required configuration missing: ${configKey}`,
      {
        serviceName,
        operation: 'config',
        severity: 'critical',
        recoverable: false,
        retryable: false,
        metadata: { configKey },
      }
    ),

  envVariableMissing: (variableName: string, serviceName?: string) =>
    new StoreError(
      STORE_ERROR_CODES.ENV_VARIABLE_MISSING,
      `Required environment variable missing: ${variableName}`,
      {
        serviceName,
        operation: 'config',
        severity: 'critical',
        recoverable: false,
        retryable: false,
        metadata: { variableName },
      }
    ),
}

// Migration Helpers
// =================

/**
 * Convert legacy errors to StoreError format
 */
export function migrateError(
  error: unknown, 
  context: { serviceName?: string; operation?: string } = {}
): StoreError {
  if (error instanceof StoreError) {
    return error
  }

  if (error instanceof DCEError) {
    // Convert existing DCE errors to StoreError
    const code = inferErrorCode(error)
    return new StoreError(code, error.message, {
      ...context,
      severity: error.severity,
      recoverable: error.recoverable,
      retryable: error.retryable,
      cause: error,
    })
  }

  if (error instanceof Error) {
    const code = inferErrorCodeFromMessage(error.message)
    return new StoreError(code, error.message, {
      ...context,
      cause: error,
    })
  }

  return new StoreError(
    STORE_ERROR_CODES.DATA_FETCH_FAILED,
    'Unknown error occurred',
    {
      ...context,
      metadata: { originalError: error },
    }
  )
}

function inferErrorCode(error: DCEError): StoreErrorCode {
  if (error instanceof AuthenticationError) {
    if (error.message.includes('session')) return STORE_ERROR_CODES.AUTH_SESSION_EXPIRED
    if (error.message.includes('credentials')) return STORE_ERROR_CODES.AUTH_INVALID_CREDENTIALS
    return STORE_ERROR_CODES.AUTH_SESSION_EXPIRED
  }

  if (error instanceof AuthorizationError) {
    return STORE_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS
  }

  if (error instanceof ValidationError) {
    return STORE_ERROR_CODES.DATA_VALIDATION_FAILED
  }

  if (error instanceof NetworkError) {
    if (error.statusCode === 429) return STORE_ERROR_CODES.SERVICE_RATE_LIMITED
    if (error.statusCode && error.statusCode >= 500) return STORE_ERROR_CODES.SERVICE_UNAVAILABLE
    return STORE_ERROR_CODES.EXTERNAL_API_ERROR
  }

  if (error instanceof DataError) {
    return STORE_ERROR_CODES.DATA_FETCH_FAILED
  }

  if (error instanceof BusinessLogicError) {
    if (error.message.includes('budget')) return STORE_ERROR_CODES.CAMPAIGN_BUDGET_EXCEEDED
    if (error.message.includes('status')) return STORE_ERROR_CODES.CAMPAIGN_INVALID_STATUS
    return STORE_ERROR_CODES.DATA_VALIDATION_FAILED
  }

  if (error instanceof ConfigurationError) {
    return STORE_ERROR_CODES.CONFIG_MISSING_REQUIRED
  }

  return STORE_ERROR_CODES.DATA_FETCH_FAILED
}

function inferErrorCodeFromMessage(message: string): StoreErrorCode {
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('session') || lowerMessage.includes('expired')) {
    return STORE_ERROR_CODES.AUTH_SESSION_EXPIRED
  }
  if (lowerMessage.includes('unauthorized') || lowerMessage.includes('forbidden')) {
    return STORE_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS
  }
  if (lowerMessage.includes('validation') || lowerMessage.includes('invalid')) {
    return STORE_ERROR_CODES.DATA_VALIDATION_FAILED
  }
  if (lowerMessage.includes('rate limit')) {
    return STORE_ERROR_CODES.SERVICE_RATE_LIMITED
  }
  if (lowerMessage.includes('not found')) {
    return STORE_ERROR_CODES.DATA_NOT_FOUND
  }
  if (lowerMessage.includes('conflict')) {
    return STORE_ERROR_CODES.DATA_CONFLICT
  }
  if (lowerMessage.includes('budget')) {
    return STORE_ERROR_CODES.CAMPAIGN_BUDGET_EXCEEDED
  }
  if (lowerMessage.includes('realtime') || lowerMessage.includes('connection')) {
    return STORE_ERROR_CODES.REALTIME_CONNECTION_FAILED
  }

  return STORE_ERROR_CODES.DATA_FETCH_FAILED
}

/**
 * Error code utilities for i18n and telemetry
 */
export const ErrorCodeUtils = {
  /**
   * Get human-readable description of error code
   */
  getDescription: (code: StoreErrorCode): string => {
    const descriptions: Record<StoreErrorCode, string> = {
      [STORE_ERROR_CODES.AUTH_SESSION_EXPIRED]: 'User session has expired',
      [STORE_ERROR_CODES.AUTH_INVALID_CREDENTIALS]: 'Invalid login credentials provided',
      [STORE_ERROR_CODES.AUTH_MAGIC_LINK_EXPIRED]: 'Magic link has expired',
      [STORE_ERROR_CODES.AUTH_MFA_REQUIRED]: 'Multi-factor authentication required',
      [STORE_ERROR_CODES.AUTH_INSUFFICIENT_PERMISSIONS]: 'User lacks required permissions',
      
      [STORE_ERROR_CODES.DATA_FETCH_FAILED]: 'Failed to retrieve data from server',
      [STORE_ERROR_CODES.DATA_SAVE_FAILED]: 'Failed to save data to server',
      [STORE_ERROR_CODES.DATA_DELETE_FAILED]: 'Failed to delete data from server',
      [STORE_ERROR_CODES.DATA_VALIDATION_FAILED]: 'Data failed validation rules',
      [STORE_ERROR_CODES.DATA_CONFLICT]: 'Data conflict with existing records',
      [STORE_ERROR_CODES.DATA_NOT_FOUND]: 'Requested data not found',
      
      [STORE_ERROR_CODES.CAMPAIGN_CREATE_FAILED]: 'Failed to create new campaign',
      [STORE_ERROR_CODES.CAMPAIGN_UPDATE_FAILED]: 'Failed to update campaign',
      [STORE_ERROR_CODES.CAMPAIGN_DELETE_FAILED]: 'Failed to delete campaign',
      [STORE_ERROR_CODES.CAMPAIGN_BUDGET_EXCEEDED]: 'Campaign budget has been exceeded',
      [STORE_ERROR_CODES.CAMPAIGN_INVALID_STATUS]: 'Invalid campaign status change',
      [STORE_ERROR_CODES.CAMPAIGN_TARGETING_INVALID]: 'Invalid campaign targeting parameters',
      
      [STORE_ERROR_CODES.CALL_TRACKING_INIT_FAILED]: 'Failed to initialize call tracking',
      [STORE_ERROR_CODES.CALL_TRACKING_UPDATE_FAILED]: 'Failed to update call tracking data',
      [STORE_ERROR_CODES.CALL_NUMBER_UNAVAILABLE]: 'Call tracking number unavailable',
      [STORE_ERROR_CODES.CALL_RECORDING_FAILED]: 'Call recording failed',
      
      [STORE_ERROR_CODES.BILLING_PAYMENT_FAILED]: 'Payment processing failed',
      [STORE_ERROR_CODES.BILLING_INSUFFICIENT_FUNDS]: 'Insufficient account balance',
      [STORE_ERROR_CODES.BILLING_CARD_DECLINED]: 'Payment card was declined',
      [STORE_ERROR_CODES.BILLING_SUBSCRIPTION_EXPIRED]: 'Subscription has expired',
      
      [STORE_ERROR_CODES.REALTIME_CONNECTION_FAILED]: 'Real-time connection failed',
      [STORE_ERROR_CODES.REALTIME_SYNC_FAILED]: 'Failed to sync real-time data',
      [STORE_ERROR_CODES.REALTIME_TIMEOUT]: 'Real-time operation timed out',
      
      [STORE_ERROR_CODES.SERVICE_UNAVAILABLE]: 'Service is temporarily unavailable',
      [STORE_ERROR_CODES.SERVICE_RATE_LIMITED]: 'Service rate limit exceeded',
      [STORE_ERROR_CODES.SERVICE_DEPRECATED]: 'Service endpoint is deprecated',
      [STORE_ERROR_CODES.SERVICE_MIGRATION_REQUIRED]: 'Service migration is required',
      
      [STORE_ERROR_CODES.CONFIG_MISSING_REQUIRED]: 'Required configuration is missing',
      [STORE_ERROR_CODES.CONFIG_INVALID_FORMAT]: 'Configuration format is invalid',
      [STORE_ERROR_CODES.ENV_VARIABLE_MISSING]: 'Required environment variable is missing',
      
      [STORE_ERROR_CODES.EXTERNAL_API_ERROR]: 'External API request failed',
      [STORE_ERROR_CODES.EXTERNAL_API_TIMEOUT]: 'External API request timed out',
      [STORE_ERROR_CODES.EXTERNAL_API_RATE_LIMITED]: 'External API rate limit exceeded',
    }

    return descriptions[code] || 'Unknown error occurred'
  },

  /**
   * Get error category for grouping
   */
  getCategory: (code: StoreErrorCode): string => {
    if (code.includes('AUTH')) return 'Authentication'
    if (code.includes('DATA')) return 'Data Management'
    if (code.includes('CAMPAIGN')) return 'Campaign Management'
    if (code.includes('CALL')) return 'Call Tracking'
    if (code.includes('BILLING')) return 'Billing & Payments'
    if (code.includes('REALTIME')) return 'Real-time Operations'
    if (code.includes('SERVICE')) return 'Service Integration'
    if (code.includes('CONFIG') || code.includes('ENV')) return 'Configuration'
    if (code.includes('EXTERNAL')) return 'External APIs'
    return 'General'
  },

  /**
   * Check if error code indicates user action required
   */
  requiresUserAction: (code: StoreErrorCode): boolean => {
    return [
      STORE_ERROR_CODES.AUTH_SESSION_EXPIRED,
      STORE_ERROR_CODES.AUTH_INVALID_CREDENTIALS,
      STORE_ERROR_CODES.AUTH_MFA_REQUIRED,
      STORE_ERROR_CODES.DATA_VALIDATION_FAILED,
      STORE_ERROR_CODES.BILLING_INSUFFICIENT_FUNDS,
      STORE_ERROR_CODES.BILLING_CARD_DECLINED,
    ].includes(code)
  },

  /**
   * Check if error code indicates system issue
   */
  isSystemIssue: (code: StoreErrorCode): boolean => {
    return [
      STORE_ERROR_CODES.SERVICE_UNAVAILABLE,
      STORE_ERROR_CODES.CONFIG_MISSING_REQUIRED,
      STORE_ERROR_CODES.ENV_VARIABLE_MISSING,
      STORE_ERROR_CODES.EXTERNAL_API_ERROR,
    ].includes(code)
  },
}

// Re-export enhanced error factory that includes both base and store errors
export const createError = {
  ...baseFcreateError,
  store: createStoreError,
}

export type { StoreErrorCode }
export { STORE_ERROR_CODES, StoreError }