/**
 * Edge Function Types for DCE Blog CMS
 * 
 * These types define the interfaces for Netlify Edge Functions
 * running on Deno runtime for server-side content processing
 */

// Base Edge Function types
export interface EdgeFunctionContext {
  request: Request
  next: () => Promise<Response>
  params: Record<string, string>
  site: {
    id: string
    name: string
    url: string
  }
  ip: string
  geo: {
    city?: string
    country?: {
      code: string
      name: string
    }
    subdivision?: {
      code: string
      name: string
    }
    timezone?: string
    latitude?: number
    longitude?: number
  }
  cookies: {
    get(name: string): string | undefined
    set(name: string, value: string, options?: CookieOptions): void
    delete(name: string): void
  }
}

export interface CookieOptions {
  domain?: string
  expires?: Date
  httpOnly?: boolean
  maxAge?: number
  path?: string
  sameSite?: 'strict' | 'lax' | 'none'
  secure?: boolean
}

// Content Sanitization API types
export interface SanitizeContentRequest {
  content: string
  options?: SanitizationOptions
  context?: SanitizationContext
}

export interface SanitizationOptions {
  allowedTags?: string[]
  allowedAttributes?: Record<string, string[]>
  allowedProtocols?: string[]
  allowIframes?: boolean
  allowScripts?: boolean
  allowStyles?: boolean
  removeEmptyTags?: boolean
  transformLinks?: boolean
  maxLength?: number
}

export interface SanitizationContext {
  contentType: 'blog_post' | 'comment' | 'author_bio' | 'category_description'
  userId?: string
  userRole?: 'admin' | 'author' | 'user'
  postId?: string
  timestamp?: string
}

export interface SanitizeContentResponse {
  sanitizedContent: string
  metadata: SanitizationMetadata
  warnings?: SanitizationWarning[]
}

export interface SanitizationMetadata {
  originalLength: number
  sanitizedLength: number
  removedTags: string[]
  removedAttributes: string[]
  processingTimeMs: number
  sanitizationLevel: 'strict' | 'moderate' | 'relaxed'
}

export interface SanitizationWarning {
  type: 'xss_attempt' | 'suspicious_content' | 'truncated' | 'malformed_html'
  message: string
  position?: number
  context?: string
}

// Edge Function error types
export interface EdgeFunctionError {
  code: EdgeFunctionErrorCode
  message: string
  details?: unknown
  retryable: boolean
  statusCode: number
}

export enum EdgeFunctionErrorCode {
  TIMEOUT = 'EDGE_FUNCTION_TIMEOUT',
  MEMORY_EXCEEDED = 'EDGE_FUNCTION_MEMORY_EXCEEDED',
  INVALID_REQUEST = 'EDGE_FUNCTION_INVALID_REQUEST',
  SANITIZATION_FAILED = 'EDGE_FUNCTION_SANITIZATION_FAILED',
  NETWORK_ERROR = 'EDGE_FUNCTION_NETWORK_ERROR',
  RATE_LIMITED = 'EDGE_FUNCTION_RATE_LIMITED',
  INTERNAL_ERROR = 'EDGE_FUNCTION_INTERNAL_ERROR'
}

// Retry configuration types
export interface RetryConfig {
  maxRetries: number
  initialDelayMs: number
  maxDelayMs: number
  backoffMultiplier: number
  retryableErrors: EdgeFunctionErrorCode[]
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 100,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  retryableErrors: [
    EdgeFunctionErrorCode.TIMEOUT,
    EdgeFunctionErrorCode.NETWORK_ERROR,
    EdgeFunctionErrorCode.RATE_LIMITED
  ]
}

// Edge Function response types
export interface EdgeFunctionResponse<T = unknown> {
  success: boolean
  data?: T
  error?: EdgeFunctionError
  metadata?: ResponseMetadata
}

export interface ResponseMetadata {
  functionName: string
  executionTimeMs: number
  region: string
  requestId: string
  version?: string
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Cache control types
export interface CacheControl {
  public?: boolean
  private?: boolean
  maxAge?: number
  sMaxAge?: number
  noCache?: boolean
  noStore?: boolean
  mustRevalidate?: boolean
  proxyRevalidate?: boolean
  immutable?: boolean
  staleWhileRevalidate?: number
  staleIfError?: number
}

// Common Edge Function headers
export const EDGE_FUNCTION_HEADERS = {
  REQUEST_ID: 'x-edge-request-id',
  FUNCTION_NAME: 'x-edge-function-name',
  EXECUTION_TIME: 'x-edge-execution-time',
  RATE_LIMIT_LIMIT: 'x-ratelimit-limit',
  RATE_LIMIT_REMAINING: 'x-ratelimit-remaining',
  RATE_LIMIT_RESET: 'x-ratelimit-reset',
  RETRY_AFTER: 'retry-after',
  CACHE_CONTROL: 'cache-control'
} as const

// Type guards
export function isEdgeFunctionError(error: unknown): error is EdgeFunctionError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    'retryable' in error &&
    'statusCode' in error
  )
}

export function isSanitizationWarning(warning: unknown): warning is SanitizationWarning {
  return (
    typeof warning === 'object' &&
    warning !== null &&
    'type' in warning &&
    'message' in warning
  )
}

// Utility types for Edge Function handlers
export type EdgeFunctionHandler = (
  request: Request,
  context: EdgeFunctionContext
) => Promise<Response> | Response

export type TypedEdgeFunctionHandler<TRequest = unknown, TResponse = unknown> = (
  request: Request,
  context: EdgeFunctionContext
) => Promise<EdgeFunctionResponse<TResponse>>

// Content validation types
export interface ContentValidation {
  isValid: boolean
  errors: ValidationError[]
  sanitizedContent?: string
}

export interface ValidationError {
  field: string
  rule: string
  message: string
  value?: unknown
}

// Edge Function configuration
export interface EdgeFunctionConfig {
  name: string
  path: string
  timeout?: number
  memory?: number
  environment?: Record<string, string>
  headers?: Record<string, string>
  cache?: CacheControl
  rateLimit?: {
    windowMs: number
    max: number
  }
}

// Remove this self-referential export as it causes issues