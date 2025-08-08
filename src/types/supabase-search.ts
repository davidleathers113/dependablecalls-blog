/**
 * Supabase Search Integration Types
 * TypeScript definitions for DCE platform search with Supabase
 * 
 * CRITICAL: NO REGEX patterns allowed - all validation uses Zod schemas
 */

import type { Database } from './database-extended'

/**
 * Supabase table types for search operations
 */
export type CampaignRow = Database['public']['Tables']['campaigns']['Row']
export type CallRow = Database['public']['Tables']['calls']['Row']
export type UserProfileRow = Database['public']['Tables']['user_profiles']['Row']
export type SearchAnalyticsRow = Database['public']['Tables']['search_analytics']['Row']

/**
 * Full-text search vector configuration
 */
export interface SearchVectorConfig {
  /** Document content for indexing */
  content: string
  /** Title with higher weight */
  title: string
  /** Category for grouping */
  category: string
  /** Additional metadata for search */
  metadata?: Record<string, unknown>
  /** Search tags */
  tags?: string[]
}

/**
 * Supabase text search options
 */
export interface SupabaseSearchOptions {
  /** Text search type */
  type?: 'websearch' | 'plainto' | 'phraseto'
  /** Language configuration */
  config?: 'english' | 'simple'
  /** Case sensitivity */
  caseSensitive?: boolean
  /** Use negation */
  negate?: boolean
}

/**
 * Search query builder interface
 */
export interface SearchQueryBuilder {
  /** Add text search condition */
  textSearch(column: string, query: string, options?: SupabaseSearchOptions): SearchQueryBuilder
  
  /** Add ILIKE condition (NO REGEX alternative) */
  ilike(column: string, pattern: string): SearchQueryBuilder
  
  /** Add equality condition */
  eq(column: string, value: unknown): SearchQueryBuilder
  
  /** Add IN condition */
  in(column: string, values: unknown[]): SearchQueryBuilder
  
  /** Add date range condition */
  gte(column: string, value: string): SearchQueryBuilder
  lte(column: string, value: string): SearchQueryBuilder
  
  /** Add ordering */
  order(column: string, options?: { ascending?: boolean }): SearchQueryBuilder
  
  /** Limit results */
  limit(count: number): SearchQueryBuilder
  
  /** Execute query */
  execute(): Promise<{ data: unknown[] | null; error: unknown | null }>
}

/**
 * Campaign search parameters
 */
export interface CampaignSearchParams {
  /** Search query text */
  query: string
  /** Campaign status filter */
  status?: ('active' | 'paused' | 'ended')[]
  /** Buyer ID filter */
  buyerId?: string
  /** Supplier ID filter */
  supplierId?: string
  /** Date range */
  dateRange?: {
    start: string
    end: string
  }
  /** Budget range */
  budgetRange?: {
    min: number
    max: number
  }
  /** Target CPA range */
  cpaRange?: {
    min: number
    max: number
  }
  /** Sort options */
  sortBy?: 'name' | 'created_at' | 'target_cpa' | 'daily_budget' | 'status'
  sortOrder?: 'asc' | 'desc'
  /** Pagination */
  page?: number
  limit?: number
}

/**
 * Call search parameters
 */
export interface CallSearchParams {
  /** Search query text */
  query: string
  /** Call status filter */
  status?: ('connected' | 'missed' | 'busy' | 'failed' | 'in_progress')[]
  /** Campaign ID filter */
  campaignId?: string
  /** Phone number search (NO REGEX) */
  phoneNumber?: string
  /** Duration range (seconds) */
  durationRange?: {
    min: number
    max: number
  }
  /** Quality score range */
  qualityRange?: {
    min: number
    max: number
  }
  /** Date range */
  dateRange?: {
    start: string
    end: string
  }
  /** Sort options */
  sortBy?: 'created_at' | 'duration' | 'quality_score' | 'phone_number'
  sortOrder?: 'asc' | 'desc'
  /** Pagination */
  page?: number
  limit?: number
}

/**
 * User search parameters (admin only)
 */
export interface UserSearchParams {
  /** Search query text */
  query: string
  /** User role filter */
  role?: ('supplier' | 'buyer' | 'admin' | 'network')[]
  /** User status filter */
  status?: ('active' | 'inactive' | 'suspended')[]
  /** Company filter */
  company?: string
  /** Registration date range */
  registrationRange?: {
    start: string
    end: string
  }
  /** Last login range */
  lastLoginRange?: {
    start: string
    end: string
  }
  /** Sort options */
  sortBy?: 'email' | 'first_name' | 'last_name' | 'created_at' | 'last_login'
  sortOrder?: 'asc' | 'desc'
  /** Pagination */
  page?: number
  limit?: number
}

/**
 * Search result metadata for different entity types
 */
export interface CampaignSearchMetadata {
  type: 'campaign'
  status: string
  buyerId: string
  supplierId?: string
  targetCpa?: number
  dailyBudget?: number
  createdAt: string
  isActive: boolean
}

export interface CallSearchMetadata {
  type: 'call'
  status: string
  campaignId: string
  campaignName?: string
  duration?: number
  qualityScore?: number
  recordingUrl?: string
  createdAt: string
}

export interface UserSearchMetadata {
  type: 'user'
  role: string
  company?: string
  status: string
  lastLogin?: string
  createdAt: string
  isActive: boolean
}

export type SearchMetadata = 
  | CampaignSearchMetadata 
  | CallSearchMetadata 
  | UserSearchMetadata

/**
 * Supabase RPC function parameters for search
 */
export interface GlobalSearchRPCParams {
  search_query: string
  search_categories?: string[]
  user_id?: string
  user_role?: string
  max_results?: number
  fuzzy_match?: boolean
}

export interface SearchSuggestionsRPCParams {
  search_query: string
  user_id?: string
  user_role?: string
  max_results?: number
  include_popular?: boolean
}

export interface SearchAnalyticsRPCParams {
  search_query: string
  result_count: number
  user_id?: string
  search_time_ms?: number
  selected_result_id?: string
  search_filters?: Record<string, unknown>
}

/**
 * Search indexing configuration
 */
export interface SearchIndexConfig {
  /** Table name to index */
  tableName: string
  /** Columns to include in search vector */
  searchColumns: {
    column: string
    weight: 'A' | 'B' | 'C' | 'D' // PostgreSQL text search weights
  }[]
  /** Filter conditions for indexing */
  filterConditions?: Record<string, unknown>
  /** Update trigger configuration */
  updateTrigger?: {
    enabled: boolean
    triggerName: string
  }
}

/**
 * Search performance metrics
 */
export interface SearchPerformanceMetrics {
  /** Average search time in milliseconds */
  averageSearchTime: number
  /** Total number of searches */
  totalSearches: number
  /** Successful searches (no errors) */
  successfulSearches: number
  /** Most popular search terms */
  popularSearches: Array<{
    query: string
    count: number
  }>
  /** Search success rate */
  successRate: number
  /** Average results per search */
  averageResultsPerSearch: number
}

/**
 * Real-time search updates via Supabase subscriptions
 */
export interface SearchSubscriptionConfig {
  /** Table to subscribe to */
  table: string
  /** Event types to listen for */
  events: ('INSERT' | 'UPDATE' | 'DELETE')[]
  /** Filter conditions */
  filter?: string
  /** Callback for updates */
  onUpdate: (payload: unknown) => void
  /** Error callback */
  onError?: (error: Error) => void
}

/**
 * Search cache configuration
 */
export interface SearchCacheConfig {
  /** Cache key prefix */
  keyPrefix: string
  /** Cache TTL in seconds */
  ttl: number
  /** Maximum cache size */
  maxSize: number
  /** Enable cache compression */
  compress?: boolean
}

/**
 * Database views for optimized search queries
 */
export interface SearchView {
  /** View name */
  name: string
  /** SQL definition */
  definition: string
  /** Materialized view flag */
  materialized: boolean
  /** Refresh schedule for materialized views */
  refreshSchedule?: {
    interval: string
    concurrent: boolean
  }
}

/**
 * Search API response types
 */
export interface SearchAPIResponse<T = unknown> {
  /** Search results */
  data: T[]
  /** Total count (for pagination) */
  count: number
  /** Search metadata */
  metadata: {
    query: string
    searchTime: number
    page: number
    limit: number
    totalPages: number
  }
  /** Error information */
  error?: {
    code: string
    message: string
    details?: unknown
  }
}

/**
 * Batch search operations
 */
export interface BatchSearchOperation {
  /** Operation ID */
  id: string
  /** Search type */
  type: 'campaigns' | 'calls' | 'users' | 'global'
  /** Search parameters */
  params: Record<string, unknown>
  /** Priority (1-10) */
  priority?: number
}

export interface BatchSearchResult {
  /** Operation ID */
  operationId: string
  /** Results */
  results: unknown[]
  /** Status */
  status: 'completed' | 'failed' | 'pending'
  /** Error if failed */
  error?: string
  /** Execution time */
  executionTime: number
}

/**
 * Search audit trail
 */
export interface SearchAuditEntry {
  /** Audit entry ID */
  id: string
  /** User who performed search */
  userId?: string
  /** Search query */
  query: string
  /** Search filters applied */
  filters: Record<string, unknown>
  /** Results returned */
  resultCount: number
  /** Search timestamp */
  timestamp: string
  /** IP address */
  ipAddress?: string
  /** User agent */
  userAgent?: string
  /** Session ID */
  sessionId?: string
}

// All types are already exported individually above