import type { ComponentType } from 'react'

/**
 * DCE Platform Search Types
 * TypeScript definitions for the search functionality
 * 
 * IMPORTANT: All validation uses Zod schemas - NO REGEX patterns allowed
 */

/**
 * Base search item interface
 */
export interface SearchItem {
  /** Unique identifier for the search item */
  id: string
  /** Display title */
  title: string
  /** Optional description for additional context */
  description?: string
  /** Category for grouping and filtering */
  category: string
  /** URL to navigate to when selected */
  url: string
  /** Optional tags for improved matching */
  tags?: string[]
  /** Additional metadata for custom use cases */
  metadata?: Record<string, unknown>
}

/**
 * Enhanced search result with relevance scoring
 */
export interface SearchResult extends SearchItem {
  /** Search relevance score (0-1) */
  score?: number
  /** Result type for categorical filtering */
  type: SearchCategory
  /** Optional icon component for display */
  icon?: ComponentType<{ className?: string }>
}

/**
 * Available search categories in the DCE platform
 */
export type SearchCategory = 
  | 'campaigns'    // Campaign management
  | 'calls'        // Call tracking and history
  | 'users'        // User management (admin only)
  | 'navigation'   // Site navigation items
  | 'settings'     // Account and system settings
  | 'help'         // Help documentation and support
  | 'reports'      // Analytics and reporting

/**
 * Search filter options
 */
export interface SearchFilters {
  /** Categories to include in search */
  categories?: SearchCategory[]
  /** Date range for time-sensitive results */
  dateRange?: {
    start: Date
    end: Date
  }
  /** Status filter for campaigns, calls, etc. */
  status?: string[]
  /** User role for permission-based filtering */
  userRole?: 'supplier' | 'buyer' | 'admin' | 'network'
  /** Minimum relevance score threshold */
  minScore?: number
}

/**
 * Search configuration options
 */
export interface SearchOptions extends SearchFilters {
  /** Maximum number of results to return */
  limit?: number
  /** Enable fuzzy matching for typos */
  fuzzyMatch?: boolean
  /** Include inactive/archived items */
  includeInactive?: boolean
  /** Sort order for results */
  sortBy?: 'relevance' | 'date' | 'title' | 'category'
  /** Sort direction */
  sortOrder?: 'asc' | 'desc'
}

/**
 * Search state for UI components
 */
export interface SearchState {
  /** Current search query */
  query: string
  /** Search results */
  results: SearchResult[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Whether a search has been performed */
  hasSearched: boolean
  /** Selected filters */
  filters: SearchFilters
  /** Total number of results available */
  totalCount?: number
  /** Current page for pagination */
  currentPage?: number
  /** Search suggestions for autocomplete */
  suggestions: string[]
}

/**
 * Search analytics data
 */
export interface SearchAnalytics {
  /** Search query performed */
  query: string
  /** Number of results returned */
  resultCount: number
  /** Time taken to perform search (ms) */
  searchTime: number
  /** Selected result (if any) */
  selectedResult?: SearchResult
  /** User who performed the search */
  userId?: string
  /** Timestamp of search */
  timestamp: Date
  /** Search filters applied */
  filters?: SearchFilters
}

/**
 * Search suggestion item
 */
export interface SearchSuggestion {
  /** Suggestion text */
  text: string
  /** Category the suggestion belongs to */
  category: SearchCategory
  /** How many times this suggestion was used */
  popularity?: number
  /** Whether this is a recent search by the user */
  isRecent?: boolean
}

/**
 * Database search result types for specific entities
 * These match the actual database schema from our mock types
 */
export interface CampaignSearchResult {
  id: string
  name: string
  description: string | null
  status: 'active' | 'paused' | 'completed' | 'draft'
  created_at: string
  supplier_id: string
  vertical: string
  bid_floor: number
  daily_cap: number | null
  monthly_cap: number | null
  quality_threshold: number | null
  updated_at: string
}

export interface CallSearchResult {
  id: string
  caller_number: string
  tracking_number: string
  campaign_id: string
  status: 'initiated' | 'ringing' | 'connected' | 'completed' | 'failed' | 'rejected'
  created_at: string
  started_at: string | null
  duration_seconds: number | null
  quality_score: number | null
  payout_amount: number | null
  supplier_id: string
  buyer_campaign_id: string | null
  updated_at: string
}

export interface UserSearchResult {
  user_id: string
  email: string
  first_name: string | null
  last_name: string | null
  role: 'supplier' | 'buyer' | 'admin'
  company: string | null
  created_at: string
  last_login: string | null
  status: 'active' | 'inactive' | 'suspended'
  avatar_url: string | null
  phone: string | null
}

/**
 * Search service interface for dependency injection
 */
export interface SearchService {
  /** Perform global search across entities */
  globalSearch(query: string, options?: SearchOptions): Promise<SearchResult[]>
  
  /** Search specific entity type */
  searchCampaigns(query: string, options?: SearchOptions): Promise<CampaignSearchResult[]>
  searchCalls(query: string, options?: SearchOptions): Promise<CallSearchResult[]>
  searchUsers(query: string, options?: SearchOptions): Promise<UserSearchResult[]>
  
  /** Get search suggestions */
  getSuggestions(query: string, limit?: number): Promise<SearchSuggestion[]>
  
  /** Track search analytics */
  trackSearch(analytics: SearchAnalytics): Promise<void>
  
  /** Get popular searches */
  getPopularSearches(category?: SearchCategory, limit?: number): Promise<string[]>
  
  /** Get recent searches for user */
  getRecentSearches(userId: string, limit?: number): Promise<string[]>
}

/**
 * Search hook return type
 */
export interface UseSearchReturn {
  /** Current search state */
  state: SearchState
  /** Perform search */
  search: (query: string, options?: SearchOptions) => Promise<void>
  /** Clear search results */
  clear: () => void
  /** Update search filters */
  setFilters: (filters: Partial<SearchFilters>) => void
  /** Update search query */
  setQuery: (query: string) => void
  /** Retry last search */
  retry: () => Promise<void>
  /** Load more results (pagination) */
  loadMore: () => Promise<void>
  /** Get suggestions */
  getSuggestions: (query: string) => Promise<void>
}

/**
 * Search component props interfaces
 */
export interface SearchBarProps {
  /** Placeholder text */
  placeholder?: string
  /** Size variant */
  size?: 'sm' | 'md' | 'lg'
  /** Visual variant */
  variant?: 'default' | 'minimal' | 'rounded'
  /** Show suggestions dropdown */
  showSuggestions?: boolean
  /** Maximum suggestions to show */
  maxSuggestions?: number
  /** Callback when search is performed */
  onSearch?: (query: string) => void
  /** Callback when suggestion is selected */
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void
  /** Custom suggestions */
  suggestions?: SearchSuggestion[]
  /** Loading state */
  isLoading?: boolean
  /** Disabled state */
  disabled?: boolean
  /** Custom CSS classes */
  className?: string
  /** ARIA label */
  ariaLabel?: string
  /** Auto focus on mount */
  autoFocus?: boolean
}

export interface SearchModalProps {
  /** Whether modal is open */
  isOpen: boolean
  /** Close callback */
  onClose: () => void
  /** Initial query */
  initialQuery?: string
  /** Categories to search */
  categories?: SearchCategory[]
  /** Show category filters */
  showFilters?: boolean
  /** Custom title */
  title?: string
}

/**
 * Search keyboard shortcut configuration
 */
export interface SearchShortcuts {
  /** Open search modal */
  openModal?: string
  /** Clear search */
  clear?: string
  /** Navigate results */
  navigateUp?: string
  navigateDown?: string
  /** Select result */
  select?: string
  /** Close modal */
  close?: string
}

/**
 * Search theme configuration
 */
export interface SearchTheme {
  /** Primary accent color */
  primaryColor?: string
  /** Background colors */
  backgroundColor?: string
  /** Text colors */
  textColor?: string
  /** Border colors */
  borderColor?: string
  /** Focus ring color */
  focusColor?: string
}

/**
 * Default search shortcuts
 */
export const DEFAULT_SEARCH_SHORTCUTS: Required<SearchShortcuts> = {
  openModal: 'cmd+k,ctrl+k',
  clear: 'escape',
  navigateUp: 'up',
  navigateDown: 'down',
  select: 'enter',
  close: 'escape'
}

// All types are already exported individually above