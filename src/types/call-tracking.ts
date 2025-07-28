// Core call tracking types and interfaces

export type ProviderType = 'retreaver' | 'trackdrive' | 'ringba';

export type CallStatus = 
  | 'initiated' 
  | 'ringing' 
  | 'connected' 
  | 'completed' 
  | 'failed' 
  | 'rejected' 
  | 'busy' 
  | 'no_answer';

export type SyncType = 'initial' | 'incremental' | 'webhook' | 'manual';

export type WebhookEventType = 
  | 'call.initiated'
  | 'call.ringing'
  | 'call.connected'
  | 'call.completed'
  | 'call.failed'
  | 'call.recording.ready'
  | 'call.transcription.ready'
  | 'call.updated'
  | 'call.deleted';

// Core call data structure
export interface CallData {
  id: string;
  external_id: string;
  provider: ProviderType;
  campaign_id?: string;
  buyer_campaign_id?: string;
  tracking_number: string;
  caller_number: string;
  destination_number?: string;
  call_sid?: string;
  status: CallStatus;
  started_at: Date;
  answered_at?: Date;
  ended_at?: Date;
  duration_seconds: number;
  billable_seconds?: number;
  recording_url?: string;
  recording_duration?: number;
  transcription?: string;
  quality_score?: number;
  fraud_score?: number;
  caller_location?: {
    city?: string;
    state?: string;
    country?: string;
    zip?: string;
  };
  metadata: Record<string, unknown>;
  last_synced_at?: Date;
  created_at: Date;
  updated_at: Date;
}

// Campaign data structure
export interface CampaignData {
  id: string;
  external_id: string;
  provider: ProviderType;
  supplier_id?: string;
  name: string;
  description?: string;
  category?: string;
  vertical?: string;
  status: 'draft' | 'active' | 'paused' | 'completed' | 'cancelled';
  targeting?: Record<string, unknown>;
  routing_rules?: Record<string, unknown>;
  tracking_numbers?: string[];
  max_concurrent_calls?: number;
  daily_cap?: number;
  total_cap?: number;
  start_date?: Date;
  end_date?: Date;
  metadata: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

// Tracking number data structure
export interface TrackingNumber {
  id: string;
  external_id?: string;
  provider: ProviderType;
  number: string;
  campaign_id?: string;
  status: 'active' | 'inactive' | 'released';
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  provisioned_at: Date;
  released_at?: Date;
  metadata: Record<string, unknown>;
}

// Webhook event structure
export interface WebhookEvent {
  id: string;
  provider: ProviderType;
  event_type: WebhookEventType;
  call_id?: string;
  external_call_id?: string;
  payload: Record<string, unknown>;
  signature?: string;
  headers: Record<string, string>;
  processed: boolean;
  processing_attempts: number;
  error?: string;
  created_at: Date;
  processed_at?: Date;
}

// Call filters for querying
export interface CallFilters {
  provider?: ProviderType;
  campaign_id?: string;
  status?: CallStatus | CallStatus[];
  caller_number?: string;
  tracking_number?: string;
  start_date?: Date;
  end_date?: Date;
  min_duration?: number;
  max_duration?: number;
  quality_score?: {
    min?: number;
    max?: number;
  };
  fraud_score?: {
    min?: number;
    max?: number;
  };
  has_recording?: boolean;
  has_transcription?: boolean;
  limit?: number;
  offset?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

// Paginated response structure
export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    has_next: boolean;
    has_previous: boolean;
  };
}

// Call report structure
export interface CallReport {
  provider: ProviderType;
  start_date: Date;
  end_date: Date;
  total_calls: number;
  connected_calls: number;
  failed_calls: number;
  total_duration: number;
  average_duration: number;
  connection_rate: number;
  quality_metrics?: {
    average_quality_score?: number;
    average_fraud_score?: number;
  };
  by_status: Record<CallStatus, number>;
  by_hour?: Record<string, number>;
  by_day?: Record<string, number>;
}

// Sync status structure
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';

export interface SyncStatusRecord {
  id: string;
  provider: ProviderType;
  sync_type: SyncType;
  last_sync_at?: Date;
  last_successful_sync_at?: Date;
  records_synced: number;
  records_failed: number;
  status: SyncStatus;
  error_details?: string;
  sync_duration?: number; // milliseconds
  created_at: Date;
  updated_at: Date;
}

// Provider configuration structure
export interface ProviderConfig {
  id: string;
  provider_type: ProviderType;
  name: string;
  credentials: {
    type: 'api_key' | 'oauth' | 'basic';
    encrypted: boolean;
    [key: string]: unknown;
  };
  settings: {
    api_base_url?: string;
    webhook_url?: string;
    sync_interval?: number; // milliseconds
    batch_size?: number;
    timeout?: number;
    [key: string]: unknown;
  };
  features: {
    webhooks: boolean;
    realtime: boolean;
    number_provisioning: boolean;
    recording: boolean;
    transcription: boolean;
    quality_scoring: boolean;
    fraud_detection: boolean;
    [key: string]: boolean;
  };
  rate_limits?: {
    requests_per_second?: number;
    requests_per_minute?: number;
    requests_per_hour?: number;
    requests_per_day?: number;
  };
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

// Webhook configuration
export interface WebhookConfig {
  url: string;
  events: WebhookEventType[];
  secret?: string;
  headers?: Record<string, string>;
  retry_attempts?: number;
  timeout?: number;
}

// Webhook registration response
export interface WebhookRegistration {
  id: string;
  webhook_id?: string;
  url: string;
  events: WebhookEventType[];
  status: 'active' | 'inactive' | 'failed';
  created_at: Date;
}

// Number provisioning options
export interface NumberOptions {
  area_code?: string;
  country_code?: string;
  number_type?: 'local' | 'toll_free' | 'mobile';
  capabilities?: {
    voice?: boolean;
    sms?: boolean;
    mms?: boolean;
  };
  campaign_id?: string;
  metadata?: Record<string, unknown>;
}

// Provider error types
export class ProviderError extends Error {
  provider: ProviderType
  code: string
  retryable: boolean
  details?: unknown
  
  constructor(
    provider: ProviderType,
    code: string,
    retryable: boolean,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.name = 'ProviderError';
    this.provider = provider;
    this.code = code;
    this.retryable = retryable;
    this.details = details;
  }
}

export class AuthenticationError extends ProviderError {
  constructor(provider: ProviderType, message: string, details?: unknown) {
    super(provider, 'AUTHENTICATION_ERROR', false, message, details);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends ProviderError {
  retryAfter?: number;
  
  constructor(
    provider: ProviderType, 
    message: string, 
    retryAfter?: number,
    details?: unknown
  ) {
    super(provider, 'RATE_LIMIT_ERROR', true, message, details);
    this.name = 'RateLimitError';
    this.retryAfter = retryAfter;
  }
}

export class ValidationError extends ProviderError {
  constructor(provider: ProviderType, message: string, details?: unknown) {
    super(provider, 'VALIDATION_ERROR', false, message, details);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends ProviderError {
  constructor(provider: ProviderType, message: string, details?: unknown) {
    super(provider, 'NETWORK_ERROR', true, message, details);
    this.name = 'NetworkError';
  }
}

export class NotFoundError extends ProviderError {
  constructor(provider: ProviderType, message: string, details?: unknown) {
    super(provider, 'NOT_FOUND_ERROR', false, message, details);
    this.name = 'NotFoundError';
  }
}

// Retry configuration
export interface RetryOptions {
  maxAttempts: number;
  baseDelay: number;
  backoff: 'linear' | 'exponential';
  retryOn?: (error: Error) => boolean;
}

// Health check result
export interface HealthCheckResult {
  provider: ProviderType;
  status: 'healthy' | 'unhealthy' | 'degraded';
  response_time?: number;
  last_check: Date;
  error?: string;
  details?: Record<string, unknown>;
}

// Data transformation mapping
export interface FieldMapping {
  source: string;
  target: string;
  transform?: (value: unknown) => unknown;
  required?: boolean;
  default?: unknown;
}

export interface DataMapping {
  provider: ProviderType;
  entity: 'call' | 'campaign' | 'tracking_number';
  fields: FieldMapping[];
}

// Metrics and monitoring
export interface ProviderMetrics {
  provider: ProviderType;
  period_start: Date;
  period_end: Date;
  api_requests: number;
  api_errors: number;
  webhook_events: number;
  webhook_failures: number;
  calls_synced: number;
  sync_failures: number;
  average_response_time: number;
  error_rate: number;
  uptime_percentage: number;
}

// Sync result structure
export interface SyncResult {
  success: boolean;
  total_records: number;
  synced_records: number;
  failed_records: number;
  error?: string;
  duration: number; // milliseconds
}

// Batch sync options
export interface BatchSyncOptions {
  batch_size?: number;
  max_concurrent_batches?: number;
  delay_between_batches?: number;
  max_retries?: number;
  start_date?: Date;
  end_date?: Date;
  filters?: CallFilters;
}

// Sync progress structure
export interface SyncProgressEvent {
  provider: ProviderType;
  syncId: string;
  totalRecords: number;
  syncedRecords: number;
  failedRecords: number;
  currentPage: number;
  totalPages: number;
  estimatedTimeRemaining?: number;
  throughputPerSecond: number;
  lastError?: string;
}