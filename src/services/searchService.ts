import { z } from 'zod'
import { from } from '../lib/supabase-optimized'
import type { 
  SearchResult,
  SearchOptions as BaseSearchOptions,
  SearchCategory
} from '../types/search'
import { 
  HomeIcon,
  ChartBarIcon,
  PhoneIcon,
  DocumentTextIcon,
  CogIcon,
  UserCircleIcon,
  QuestionMarkCircleIcon
} from '@heroicons/react/24/outline'

// Remove duplicate type definitions - use types from ../types/search.ts

// Use SearchOptions from types/search.ts
export interface SearchServiceOptions extends BaseSearchOptions {
  /** User ID for filtering user-specific content */
  userId?: string
  /** Enable fuzzy matching */
  fuzzyMatch?: boolean
}

// Use SearchResult from types/search.ts as UnifiedSearchResult
export type UnifiedSearchResult = SearchResult

/**
 * Search query validation schema (NO REGEX - DCE requirement)
 */
const searchQuerySchema = z.object({
  query: z.string()
    .min(1, 'Search query cannot be empty')
    .max(100, 'Search query too long')
    .transform(val => val.trim()), // Sanitize whitespace
  options: z.object({
    limit: z.number().min(1).max(50).default(20),
    categories: z.array(z.enum(['campaigns', 'calls', 'users', 'navigation', 'settings', 'help', 'reports'])).optional(),
    userRole: z.enum(['supplier', 'buyer', 'admin', 'network']).optional(),
    userId: z.string().uuid().optional(),
    fuzzyMatch: z.boolean().default(true)
  }).default({})
})

export type SearchQuery = z.infer<typeof searchQuerySchema>

/**
 * Category-specific icon mapping
 */
const categoryIcons: Record<SearchCategory, React.ComponentType<{ className?: string }>> = {
  campaigns: ChartBarIcon,
  calls: PhoneIcon,
  users: UserCircleIcon,
  navigation: HomeIcon,
  settings: CogIcon,
  help: QuestionMarkCircleIcon,
  reports: DocumentTextIcon
}

/**
 * Search service class for handling all search operations
 */
class SearchService {
  /**
   * Perform global search across multiple entities
   */
  async globalSearch(query: string, options: SearchServiceOptions = {}): Promise<UnifiedSearchResult[]> {
    // Validate input (NO REGEX used here)
    const validation = searchQuerySchema.safeParse({ query, options })
    if (!validation.success) {
      throw new Error(`Invalid search query: ${validation.error.message}`)
    }

    const { query: sanitizedQuery, options: validatedOptions } = validation.data
    const results: UnifiedSearchResult[] = []

    try {
      // Execute searches in parallel for better performance
      const searchPromises = []

      if (!validatedOptions.categories || validatedOptions.categories.includes('campaigns')) {
        searchPromises.push(this.searchCampaigns(sanitizedQuery, validatedOptions))
      }

      if (!validatedOptions.categories || validatedOptions.categories.includes('calls')) {
        searchPromises.push(this.searchCalls(sanitizedQuery, validatedOptions))
      }

      if (!validatedOptions.categories || validatedOptions.categories.includes('users')) {
        searchPromises.push(this.searchUsers(sanitizedQuery, validatedOptions))
      }

      // Always include navigation items for better UX
      if (!validatedOptions.categories || validatedOptions.categories.includes('navigation')) {
        searchPromises.push(this.getNavigationSuggestions(sanitizedQuery, validatedOptions))
      }

      // Wait for all searches to complete
      const searchResults = await Promise.allSettled(searchPromises)
      
      // Combine and flatten results
      searchResults.forEach(result => {
        if (result.status === 'fulfilled') {
          results.push(...result.value)
        } else {
          // Log error but don't fail the entire search
          console.warn('Search category failed:', result.reason)
        }
      })

      // Sort by relevance score and limit results
      return results
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .slice(0, validatedOptions.limit || 20)

    } catch (error) {
      throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Search campaigns using Supabase full-text search
   */
  private async searchCampaigns(query: string, options: SearchServiceOptions): Promise<UnifiedSearchResult[]> {
    try {
      let searchQuery = from('campaigns').select(`
        id,
        name,
        description,
        status,
        created_at,
        supplier_id,
        vertical,
        bid_floor,
        daily_cap,
        monthly_cap,
        quality_threshold,
        updated_at
      `)

      // Use full-text search with websearch_to_tsquery for better matching
      if (options.fuzzyMatch) {
        searchQuery = searchQuery.textSearch('search_vector', query, {
          type: 'websearch',
          config: 'english'
        })
      } else {
        // Exact matching using ILIKE (NO REGEX)
        const likePattern = `%${query.toLowerCase()}%`
        searchQuery = searchQuery.or(`name.ilike.${likePattern},description.ilike.${likePattern}`)
      }

      // Apply user-specific filters
      if (options.userId && options.userRole === 'supplier') {
        searchQuery = searchQuery.eq('supplier_id', options.userId)
      }
      // Note: buyer filtering would require joining with buyer_campaigns table

      const { data, error } = await searchQuery
        .eq('status', 'active') // Only show active campaigns
        .limit(options.limit || 10)

      if (error) throw error

      return (data || []).map((campaign): UnifiedSearchResult => ({
        id: campaign.id,
        title: campaign.name,
        description: campaign.description || undefined,
        category: 'Campaigns',
        url: `/app/campaigns/${campaign.id}`,
        type: 'campaigns',
        score: this.calculateRelevanceScore(query, campaign.name, campaign.description),
        metadata: {
          status: campaign.status,
          created_at: campaign.created_at,
          supplier_id: campaign.supplier_id,
          vertical: campaign.vertical,
          bid_floor: campaign.bid_floor,
          daily_cap: campaign.daily_cap,
          monthly_cap: campaign.monthly_cap,
          quality_threshold: campaign.quality_threshold
        },
        tags: ['campaign', campaign.status, campaign.vertical]
      }))

    } catch (error) {
      console.warn('Campaign search failed:', error)
      return []
    }
  }

  /**
   * Search calls with campaign information
   */
  private async searchCalls(query: string, options: SearchServiceOptions): Promise<UnifiedSearchResult[]> {
    try {
      // Use a view or join for better performance
      const { data, error } = await from('calls').select(`
        id,
        caller_number,
        tracking_number,
        campaign_id,
        status,
        created_at,
        started_at,
        duration_seconds,
        quality_score,
        payout_amount,
        supplier_id,
        buyer_campaign_id,
        campaigns!inner (
          name,
          supplier_id
        )
      `)
      .or(`caller_number.ilike.%${query.toLowerCase()}%,tracking_number.ilike.%${query.toLowerCase()}%`)
      .limit(options.limit || 10)

      if (error) throw error

      return (data || []).map((call): UnifiedSearchResult => ({
        id: call.id,
        title: `Call ${call.caller_number}`,
        description: `${call.status} call ${call.duration_seconds ? `(${call.duration_seconds}s)` : ''}`,
        category: 'Calls',
        url: `/app/calls/${call.id}`,
        type: 'calls',
        score: this.calculateRelevanceScore(query, call.caller_number, call.tracking_number),
        metadata: {
          campaign_id: call.campaign_id,
          status: call.status,
          caller_number: call.caller_number,
          tracking_number: call.tracking_number,
          started_at: call.started_at,
          duration_seconds: call.duration_seconds,
          quality_score: call.quality_score,
          payout_amount: call.payout_amount,
          supplier_id: call.supplier_id,
          buyer_campaign_id: call.buyer_campaign_id,
          campaign_name: (call.campaigns as { name?: string })?.name
        },
        tags: ['call', call.status]
      }))

    } catch (error) {
      console.warn('Call search failed:', error)
      return []
    }
  }

  /**
   * Search users (admin only)
   */
  private async searchUsers(query: string, options: SearchServiceOptions): Promise<UnifiedSearchResult[]> {
    // Only allow admin users to search users
    if (options.userRole !== 'admin') {
      return []
    }

    try {
      const { data, error } = await from('user_profiles').select(`
        user_id,
        email,
        first_name,
        last_name,
        role,
        company,
        created_at,
        last_login,
        status,
        avatar_url,
        phone
      `)
      .or(`email.ilike.%${query.toLowerCase()}%,first_name.ilike.%${query.toLowerCase()}%,last_name.ilike.%${query.toLowerCase()}%,company.ilike.%${query.toLowerCase()}%`)
      .eq('status', 'active')
      .limit(options.limit || 5)

      if (error) throw error

      return (data || []).map((user): UnifiedSearchResult => ({
        id: user.user_id,
        title: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        description: `${user.role} at ${user.company || 'Unknown'}`,
        category: 'Users',
        url: `/app/admin/users/${user.user_id}`,
        type: 'users',
        score: this.calculateRelevanceScore(query, user.email, `${user.first_name} ${user.last_name}`),
        metadata: {
          email: user.email,
          role: user.role,
          company: user.company,
          status: user.status,
          last_login: user.last_login,
          avatar_url: user.avatar_url,
          phone: user.phone
        },
        tags: ['user', user.role, user.status || 'active']
      }))

    } catch (error) {
      console.warn('User search failed:', error)
      return []
    }
  }

  /**
   * Get navigation suggestions based on user role
   */
  private async getNavigationSuggestions(query: string, _options: SearchServiceOptions): Promise<UnifiedSearchResult[]> {
    const suggestions: UnifiedSearchResult[] = []
    const lowerQuery = query.toLowerCase()

    // Role-based navigation items
    const navigationItems: Array<{
      id: string
      title: string
      description: string
      url: string
      category: string
      roles?: string[]
      keywords: string[]
    }> = [
      {
        id: 'dashboard',
        title: 'Dashboard',
        description: 'View your main dashboard with analytics and metrics',
        url: '/app/dashboard',
        category: 'Navigation',
        keywords: ['dashboard', 'home', 'overview', 'main']
      },
      {
        id: 'campaigns',
        title: 'Campaigns',
        description: 'Manage your campaigns and view performance',
        url: '/app/campaigns',
        category: 'Navigation',
        keywords: ['campaigns', 'manage', 'create', 'performance']
      },
      {
        id: 'calls',
        title: 'Calls',
        description: 'View call history and analytics',
        url: '/app/calls',
        category: 'Navigation',
        keywords: ['calls', 'history', 'tracking', 'phone']
      },
      {
        id: 'settings',
        title: 'Settings',
        description: 'Manage your account and preferences',
        url: '/app/settings',
        category: 'Navigation',
        keywords: ['settings', 'account', 'preferences', 'configuration']
      },
      {
        id: 'reports',
        title: 'Reports',
        description: 'View detailed analytics and reports',
        url: '/app/reports',
        category: 'Navigation',
        keywords: ['reports', 'analytics', 'data', 'insights']
      }
    ]

    // Filter navigation items based on query
    navigationItems.forEach(item => {
      const matchFound = item.keywords.some(keyword => 
        keyword.includes(lowerQuery) || 
        item.title.toLowerCase().includes(lowerQuery) ||
        item.description.toLowerCase().includes(lowerQuery)
      )

      if (matchFound) {
        suggestions.push({
          id: item.id,
          title: item.title,
          description: item.description,
          category: item.category,
          url: item.url,
          type: 'navigation',
          score: this.calculateRelevanceScore(query, item.title, item.description),
          metadata: {
            keywords: item.keywords
          }
        })
      }
    })

    return suggestions
  }

  /**
   * Calculate relevance score for search results (NO REGEX)
   */
  private calculateRelevanceScore(query: string, title: string, description?: string | null): number {
    const lowerQuery = query.toLowerCase()
    const lowerTitle = title.toLowerCase()
    const lowerDesc = (description || '').toLowerCase()
    
    let score = 0
    
    // Exact title match gets highest score
    if (lowerTitle === lowerQuery) {
      score += 1.0
    } else if (lowerTitle.includes(lowerQuery)) {
      // Title contains query - high relevance
      score += 0.8
      
      // Bonus if query is at start of title
      if (lowerTitle.startsWith(lowerQuery)) {
        score += 0.1
      }
    }
    
    // Description match gets lower score
    if (lowerDesc.includes(lowerQuery)) {
      score += 0.3
    }
    
    // Normalize score to 0-1 range
    return Math.min(score, 1.0)
  }

  /**
   * Get search suggestions for autocomplete
   * Note: Uses mock suggestions until get_search_suggestions RPC is implemented
   */
  async getSearchSuggestions(query: string, options: SearchServiceOptions = {}): Promise<string[]> {
    if (query.length < 2) return []

    try {
      // TODO: Replace with actual RPC when get_search_suggestions is implemented
      // For now, return static suggestions based on query
      const mockSuggestions = [
        'campaigns', 'calls', 'dashboard', 'settings',
        'active campaigns', 'completed calls', 'reports',
        'buyer dashboard', 'supplier dashboard', 'analytics'
      ]
      
      const filtered = mockSuggestions
        .filter(suggestion => 
          suggestion.toLowerCase().includes(query.toLowerCase())
        )
        .slice(0, options.limit || 5)
      
      return filtered

    } catch (error) {
      console.warn('Search suggestions failed:', error)
      return []
    }
  }

  /**
   * Track search analytics (optional)
   */
  async trackSearch(query: string, resultCount: number, userId?: string, searchTimeMs?: number): Promise<void> {
    try {
      await from('search_analytics').insert({
        query,
        result_count: resultCount,
        user_id: userId,
        search_time_ms: searchTimeMs,
        searched_at: new Date().toISOString()
      })
    } catch (error) {
      // Don't fail the search if analytics tracking fails
      console.warn('Failed to track search:', error)
    }
  }
}

// Export singleton instance
export const searchService = new SearchService()

// Export types for external use
export type { SearchServiceOptions as SearchOptions }
export { categoryIcons }

// Re-export types from main search types file
export type {
  SearchCategory,
  CampaignSearchResult,
  CallSearchResult,
  UserSearchResult
} from '../types/search'