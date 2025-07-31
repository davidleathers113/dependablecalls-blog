/**
 * Comprehensive error types for the DCE blog system
 * Provides structured error handling with proper TypeScript support
 */

// Base error interface
export interface BaseError {
  code: string
  message: string
  timestamp: string
  requestId?: string
}

// Blog-specific error interface
export interface BlogError extends BaseError {
  type: BlogErrorType
  details?: BlogErrorDetails
  statusCode: number
}

// Error type enumeration  
export const BlogErrorType = {
  // Validation errors (400)
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  INVALID_SLUG: 'INVALID_SLUG',
  INVALID_STATUS: 'INVALID_STATUS',
  INVALID_CONTENT: 'INVALID_CONTENT',
  
  // Authentication errors (401)
  UNAUTHORIZED: 'UNAUTHORIZED',
  INVALID_TOKEN: 'INVALID_TOKEN',
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  
  // Authorization errors (403)
  FORBIDDEN: 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS: 'INSUFFICIENT_PERMISSIONS',
  AUTHOR_MISMATCH: 'AUTHOR_MISMATCH',
  
  // Not found errors (404)
  POST_NOT_FOUND: 'POST_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  TAG_NOT_FOUND: 'TAG_NOT_FOUND',
  AUTHOR_NOT_FOUND: 'AUTHOR_NOT_FOUND',
  COMMENT_NOT_FOUND: 'COMMENT_NOT_FOUND',
  
  // Conflict errors (409)
  DUPLICATE_SLUG: 'DUPLICATE_SLUG',
  DUPLICATE_CATEGORY: 'DUPLICATE_CATEGORY',
  DUPLICATE_TAG: 'DUPLICATE_TAG',
  
  // Business logic errors (422)
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  QUOTA_EXCEEDED: 'QUOTA_EXCEEDED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  
  // Server errors (500)
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE'
} as const

export type BlogErrorType = typeof BlogErrorType[keyof typeof BlogErrorType]

// Error details union type
export type BlogErrorDetails = 
  | ValidationErrorDetails
  | AuthErrorDetails
  | NotFoundErrorDetails
  | ConflictErrorDetails
  | QuotaErrorDetails
  | DatabaseErrorDetails

// Validation error details
export interface ValidationErrorDetails {
  field?: string
  value?: unknown
  constraints?: Record<string, string>
  errors?: Array<{
    field: string
    message: string
    code: string
  }>
}

// Authentication error details
export interface AuthErrorDetails {
  userId?: string
  action?: string
  requiredRole?: string
  actualRole?: string
}

// Not found error details
export interface NotFoundErrorDetails {
  resource: string
  identifier: string | { [key: string]: unknown }
}

// Conflict error details
export interface ConflictErrorDetails {
  resource: string
  existingId: string
  conflictingField: string
  conflictingValue: unknown
}

// Quota error details
export interface QuotaErrorDetails {
  limit: number
  current: number
  resource: string
  resetAt?: string
}

// Database error details
export interface DatabaseErrorDetails {
  operation: string
  table?: string
  constraint?: string
  hint?: string
}

// Error factory functions
export class BlogErrorFactory {
  /**
   * Create a validation error
   */
  static validation(
    message: string,
    details?: ValidationErrorDetails
  ): BlogError {
    return {
      code: BlogErrorType.VALIDATION_ERROR,
      type: BlogErrorType.VALIDATION_ERROR,
      message,
      statusCode: 400,
      timestamp: new Date().toISOString(),
      details
    }
  }

  /**
   * Create an authentication error
   */
  static unauthorized(
    message = 'Authentication required',
    details?: AuthErrorDetails
  ): BlogError {
    return {
      code: BlogErrorType.UNAUTHORIZED,
      type: BlogErrorType.UNAUTHORIZED,
      message,
      statusCode: 401,
      timestamp: new Date().toISOString(),
      details
    }
  }

  /**
   * Create an authorization error
   */
  static forbidden(
    message = 'Insufficient permissions',
    details?: AuthErrorDetails
  ): BlogError {
    return {
      code: BlogErrorType.FORBIDDEN,
      type: BlogErrorType.FORBIDDEN,
      message,
      statusCode: 403,
      timestamp: new Date().toISOString(),
      details
    }
  }

  /**
   * Create a not found error
   */
  static notFound(
    resource: string,
    identifier: string | { [key: string]: unknown }
  ): BlogError {
    return {
      code: BlogErrorType.POST_NOT_FOUND,
      type: BlogErrorType.POST_NOT_FOUND,
      message: `${resource} not found`,
      statusCode: 404,
      timestamp: new Date().toISOString(),
      details: { resource, identifier }
    }
  }

  /**
   * Create a duplicate error
   */
  static duplicate(
    resource: string,
    field: string,
    value: unknown,
    existingId: string
  ): BlogError {
    return {
      code: BlogErrorType.DUPLICATE_SLUG,
      type: BlogErrorType.DUPLICATE_SLUG,
      message: `${resource} with ${field} "${value}" already exists`,
      statusCode: 409,
      timestamp: new Date().toISOString(),
      details: {
        resource,
        existingId,
        conflictingField: field,
        conflictingValue: value
      }
    }
  }

  /**
   * Create a quota exceeded error
   */
  static quotaExceeded(
    resource: string,
    limit: number,
    current: number,
    resetAt?: Date
  ): BlogError {
    return {
      code: BlogErrorType.QUOTA_EXCEEDED,
      type: BlogErrorType.QUOTA_EXCEEDED,
      message: `${resource} quota exceeded. Limit: ${limit}, Current: ${current}`,
      statusCode: 422,
      timestamp: new Date().toISOString(),
      details: {
        resource,
        limit,
        current,
        resetAt: resetAt?.toISOString()
      }
    }
  }

  /**
   * Create a database error
   */
  static database(
    operation: string,
    error: unknown,
    table?: string
  ): BlogError {
    const message = error instanceof Error ? error.message : 'Database operation failed'
    return {
      code: BlogErrorType.DATABASE_ERROR,
      type: BlogErrorType.DATABASE_ERROR,
      message,
      statusCode: 500,
      timestamp: new Date().toISOString(),
      details: {
        operation,
        table,
        hint: 'Check database logs for more details'
      }
    }
  }
}

// Type guards
export function isBlogError(error: unknown): error is BlogError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'type' in error &&
    'statusCode' in error &&
    Object.values(BlogErrorType).includes((error as any).type)
  )
}

export function isValidationError(error: BlogError): boolean {
  return error.type === BlogErrorType.VALIDATION_ERROR
}

export function isAuthError(error: BlogError): boolean {
  return [
    BlogErrorType.UNAUTHORIZED,
    BlogErrorType.FORBIDDEN,
    BlogErrorType.INVALID_TOKEN,
    BlogErrorType.SESSION_EXPIRED
  ].includes(error.type as any)
}

// Error handling utilities
export function handleSupabaseError(error: unknown): BlogError {
  if (!error || typeof error !== 'object') {
    return BlogErrorFactory.database('Unknown', error)
  }

  const supabaseError = error as any

  // Handle specific Supabase error codes
  if (supabaseError.code === '23505') {
    // Unique constraint violation
    return BlogErrorFactory.duplicate(
      'Resource',
      'field',
      'value',
      'existing'
    )
  }

  if (supabaseError.code === '23503') {
    // Foreign key violation
    return BlogErrorFactory.validation(
      'Invalid reference to related resource',
      { field: 'foreign_key', constraints: { exists: 'Referenced resource must exist' } }
    )
  }

  if (supabaseError.code === 'PGRST116') {
    // JWT expired
    return BlogErrorFactory.unauthorized('Session expired', {
      action: 'refresh_token'
    })
  }

  // Default database error
  return BlogErrorFactory.database(
    supabaseError.message || 'Database operation failed',
    error
  )
}

// Batch operation error types
export interface BatchOperationError {
  operation: 'create' | 'update' | 'delete'
  itemId?: string
  index: number
  error: BlogError
}

export interface BatchOperationResult<T> {
  successful: T[]
  failed: BatchOperationError[]
  total: number
  successCount: number
  failureCount: number
}