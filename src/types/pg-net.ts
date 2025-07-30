/**
 * PostgreSQL pg_net Extension Types
 * 
 * Types for the pg_net extension that enables asynchronous
 * HTTP requests from PostgreSQL to Edge Functions
 */

// HTTP method types supported by pg_net
export type PgNetHttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'

// pg_net request configuration
export interface PgNetRequest {
  url: string
  method?: PgNetHttpMethod
  headers?: Record<string, string>
  body?: string | Record<string, unknown>
  timeout?: number
}

// pg_net response types
export interface PgNetResponse {
  id: string
  status: number
  headers: Record<string, string>
  body: string
  created_at: Date
  updated_at: Date
  error?: string
}

// pg_net job status
export type PgNetJobStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'timeout'

// pg_net job record
export interface PgNetJob {
  id: string
  url: string
  method: PgNetHttpMethod
  headers: Record<string, string>
  body?: string
  status: PgNetJobStatus
  response?: PgNetResponse
  created_at: Date
  updated_at: Date
  attempts: number
  max_attempts: number
  next_retry_at?: Date
}

// pg_net queue configuration
export interface PgNetQueueConfig {
  max_attempts: number
  retry_delay_seconds: number
  timeout_seconds: number
  concurrency: number
}

// Edge Function webhook payload from pg_net
export interface PgNetWebhookPayload {
  event: PgNetWebhookEvent
  timestamp: string
  data: Record<string, unknown>
  metadata?: PgNetWebhookMetadata
}

export interface PgNetWebhookEvent {
  type: 'content_created' | 'content_updated' | 'content_deleted' | 'comment_posted' | 'moderation_required'
  entity: 'blog_post' | 'comment' | 'author' | 'category' | 'tag'
  entityId: string
  userId?: string
}

export interface PgNetWebhookMetadata {
  requestId: string
  origin: string
  userAgent?: string
  ip?: string
}

// pg_net function signatures for TypeScript
export interface PgNetFunctions {
  http_get: (url: string, headers?: Record<string, string>, timeout?: number) => Promise<PgNetResponse>
  http_post: (url: string, body?: string | Record<string, unknown>, headers?: Record<string, string>, timeout?: number) => Promise<PgNetResponse>
  http_put: (url: string, body?: string | Record<string, unknown>, headers?: Record<string, string>, timeout?: number) => Promise<PgNetResponse>
  http_delete: (url: string, headers?: Record<string, string>, timeout?: number) => Promise<PgNetResponse>
  http_patch: (url: string, body?: string | Record<string, unknown>, headers?: Record<string, string>, timeout?: number) => Promise<PgNetResponse>
}

// pg_net error types
export interface PgNetError {
  code: PgNetErrorCode
  message: string
  details?: unknown
  jobId?: string
}

export enum PgNetErrorCode {
  CONNECTION_FAILED = 'PG_NET_CONNECTION_FAILED',
  TIMEOUT = 'PG_NET_TIMEOUT',
  INVALID_URL = 'PG_NET_INVALID_URL',
  INVALID_METHOD = 'PG_NET_INVALID_METHOD',
  INVALID_HEADERS = 'PG_NET_INVALID_HEADERS',
  INVALID_BODY = 'PG_NET_INVALID_BODY',
  MAX_RETRIES_EXCEEDED = 'PG_NET_MAX_RETRIES_EXCEEDED',
  QUEUE_FULL = 'PG_NET_QUEUE_FULL'
}

// Database trigger payload for pg_net
export interface PgNetTriggerPayload {
  operation: 'INSERT' | 'UPDATE' | 'DELETE'
  table: string
  schema: string
  old?: Record<string, unknown>
  new?: Record<string, unknown>
  timestamp: Date
  user: string
}

// pg_net batch request support
export interface PgNetBatchRequest {
  requests: PgNetRequest[]
  parallel?: boolean
  stopOnError?: boolean
}

export interface PgNetBatchResponse {
  results: Array<{
    request: PgNetRequest
    response?: PgNetResponse
    error?: PgNetError
  }>
  successful: number
  failed: number
  totalTime: number
}

// Type guards
export function isPgNetError(error: unknown): error is PgNetError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    'message' in error &&
    Object.values(PgNetErrorCode).includes((error as PgNetError).code)
  )
}

export function isPgNetResponse(response: unknown): response is PgNetResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'id' in response &&
    'status' in response &&
    'headers' in response &&
    'body' in response
  )
}

// Utility types for pg_net integration
export type PgNetCallback = (response: PgNetResponse | PgNetError) => void | Promise<void>

export interface PgNetSubscription {
  id: string
  url: string
  events: PgNetWebhookEvent['type'][]
  active: boolean
  createdAt: Date
  lastTriggeredAt?: Date
}

// Constants
export const PG_NET_DEFAULT_TIMEOUT = 30000 // 30 seconds
export const PG_NET_MAX_RETRIES = 3
export const PG_NET_RETRY_DELAY = 1000 // 1 second

// Edge Function endpoints for pg_net
export const PG_NET_EDGE_ENDPOINTS = {
  SANITIZE_CONTENT: '/.netlify/edge-functions/sanitize-content',
  VALIDATE_CONTENT: '/.netlify/edge-functions/validate-content',
  PROCESS_WEBHOOK: '/.netlify/edge-functions/process-webhook',
  SYNC_CACHE: '/.netlify/edge-functions/sync-cache'
} as const

// Remove this self-referential export as it causes issues