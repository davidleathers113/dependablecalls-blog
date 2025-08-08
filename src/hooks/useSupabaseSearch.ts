import { useState, useCallback, useEffect, useMemo } from 'react'
import { useAuthStore } from '../store/authStore'
import { searchService, type SearchOptions, type SearchCategory, type UnifiedSearchResult } from '../services/searchService'
import { useDebounce } from './useDebounce'

export interface UseSupabaseSearchOptions extends SearchOptions {
  /** Enable automatic search on query change */
  autoSearch?: boolean
  /** Debounce delay in milliseconds */
  debounceMs?: number
  /** Minimum query length before searching */
  minQueryLength?: number
}

export interface UseSupabaseSearchReturn {
  /** Current search query */
  query: string
  /** Set search query */
  setQuery: (query: string) => void
  /** Search results */
  results: UnifiedSearchResult[]
  /** Loading state */
  isLoading: boolean
  /** Error state */
  error: string | null
  /** Whether search has been performed */
  hasSearched: boolean
  /** Number of results */
  resultCount: number
  /** Manually trigger search */
  search: (searchQuery?: string) => Promise<void>
  /** Clear search */
  clearSearch: () => void
  /** Retry last search */
  retrySearch: () => Promise<void>
  /** Available categories for filtering */
  categories: SearchCategory[]
  /** Selected categories for filtering */
  selectedCategories: SearchCategory[]
  /** Set selected categories */
  setSelectedCategories: (categories: SearchCategory[]) => void
  /** Search suggestions for autocomplete */
  suggestions: string[]
  /** Loading state for suggestions */
  isSuggestionsLoading: boolean
}

/**
 * Hook for performing searches using Supabase full-text search
 * Integrates with DCE authentication and permissions
 */
export function useSupabaseSearch(options: UseSupabaseSearchOptions = {}): UseSupabaseSearchReturn {
  const {
    autoSearch = true,
    debounceMs = 300,
    minQueryLength = 2,
    limit = 20,
    categories,
    fuzzyMatch = true,
    ...searchOptions
  } = options

  const { user, userType } = useAuthStore()
  
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedCategories, setSelectedCategories] = useState<SearchCategory[]>(categories || [])
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false)
  
  const debouncedQuery = useDebounce(query, debounceMs)

  // Available categories based on user role
  const availableCategories = useMemo<SearchCategory[]>(() => {
    const baseCategories: SearchCategory[] = ['campaigns', 'calls', 'navigation', 'settings', 'help', 'reports']
    
    // Add admin-only categories
    if (userType === 'admin') {
      baseCategories.push('users')
    }
    
    return baseCategories
  }, [userType])

  // Perform search function
  const search = useCallback(async (searchQuery?: string) => {
    const queryToSearch = searchQuery ?? query
    
    if (!queryToSearch.trim() || queryToSearch.length < minQueryLength) {
      setResults([])
      setHasSearched(false)
      setError(null)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const searchOptionsWithUser: SearchOptions = {
        ...searchOptions,
        limit,
        categories: selectedCategories.length > 0 ? selectedCategories : undefined,
        userRole: userType || undefined,
        userId: user?.id,
        fuzzyMatch
      }

      const searchResults = await searchService.globalSearch(queryToSearch, searchOptionsWithUser)
      
      setResults(searchResults)
      setHasSearched(true)

      // Track search analytics (optional)
      if (user?.id) {
        searchService.trackSearch(queryToSearch, searchResults.length, user.id).catch(() => {
          // Ignore tracking errors
        })
      }

    } catch (searchError) {
      const errorMessage = searchError instanceof Error 
        ? searchError.message 
        : 'Search failed. Please try again.'
      
      setError(errorMessage)
      setResults([])
      
      // Log error for monitoring
      console.error('Search error:', searchError)
      
    } finally {
      setIsLoading(false)
    }
  }, [query, minQueryLength, searchOptions, limit, selectedCategories, userType, user?.id, fuzzyMatch])

  // Get search suggestions
  const getSuggestions = useCallback(async (suggestionQuery: string) => {
    if (!suggestionQuery.trim() || suggestionQuery.length < minQueryLength) {
      setSuggestions([])
      return
    }

    setIsSuggestionsLoading(true)

    try {
      const searchSuggestions = await searchService.getSearchSuggestions(suggestionQuery, {
        limit: 5,
        userRole: userType || undefined,
        userId: user?.id
      })
      
      setSuggestions(searchSuggestions)
      
    } catch (suggestionError) {
      console.warn('Failed to get suggestions:', suggestionError)
      setSuggestions([])
    } finally {
      setIsSuggestionsLoading(false)
    }
  }, [minQueryLength, userType, user?.id])

  // Auto-search on debounced query change
  useEffect(() => {
    if (autoSearch && debouncedQuery) {
      search(debouncedQuery)
    }
  }, [debouncedQuery, autoSearch, search])

  // Get suggestions on query change (separate from search)
  useEffect(() => {
    if (query && query.length >= minQueryLength) {
      getSuggestions(query)
    } else {
      setSuggestions([])
    }
  }, [query, minQueryLength, getSuggestions])

  // Clear search function
  const clearSearch = useCallback(() => {
    setQuery('')
    setResults([])
    setError(null)
    setHasSearched(false)
    setSuggestions([])
  }, [])

  // Retry search function
  const retrySearch = useCallback(async () => {
    if (query) {
      await search(query)
    }
  }, [query, search])

  // Update selected categories when prop changes
  useEffect(() => {
    if (categories) {
      setSelectedCategories(categories)
    }
  }, [categories])

  return {
    query,
    setQuery,
    results,
    isLoading,
    error,
    hasSearched,
    resultCount: results.length,
    search,
    clearSearch,
    retrySearch,
    categories: availableCategories,
    selectedCategories,
    setSelectedCategories,
    suggestions,
    isSuggestionsLoading
  }
}

/**
 * Simplified hook for quick searches without advanced features
 */
export function useQuickSearch(defaultQuery = '') {
  const [query, setQuery] = useState(defaultQuery)
  const [results, setResults] = useState<UnifiedSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const { user, userType } = useAuthStore()

  const search = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([])
      return
    }

    setIsLoading(true)

    try {
      const searchResults = await searchService.globalSearch(searchQuery, {
        limit: 10,
        userRole: userType || undefined,
        userId: user?.id,
        fuzzyMatch: true
      })
      
      setResults(searchResults)
    } catch (error) {
      console.error('Quick search failed:', error)
      setResults([])
    } finally {
      setIsLoading(false)
    }
  }, [userType, user?.id])

  return {
    query,
    setQuery,
    results,
    isLoading,
    search
  }
}

export type { SearchCategory, UnifiedSearchResult }