import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { 
  SearchState, 
  SearchResult, 
  SearchFilters, 
  SearchOptions,
  SearchAnalytics 
} from '../types/search'
import { searchService } from '../services/searchService'

/**
 * Search store interface
 */
interface SearchStore extends SearchState {
  // Actions
  /** Set search query */
  setQuery: (query: string) => void
  
  /** Set search results */
  setResults: (results: SearchResult[]) => void
  
  /** Set loading state */
  setLoading: (loading: boolean) => void
  
  /** Set error state */
  setError: (error: string | null) => void
  
  /** Set filters */
  setFilters: (filters: Partial<SearchFilters>) => void
  
  /** Set suggestions */
  setSuggestions: (suggestions: string[]) => void
  
  /** Perform search */
  search: (query: string, options?: SearchOptions) => Promise<void>
  
  /** Clear search */
  clearSearch: () => void
  
  /** Add to recent searches */
  addRecentSearch: (query: string) => void
  
  /** Get recent searches */
  getRecentSearches: () => string[]
  
  /** Clear recent searches */
  clearRecentSearches: () => void
  
  /** Track search analytics */
  trackSearch: (query: string, resultCount: number, userId?: string) => Promise<void>
  
  /** Add search suggestion */
  addSuggestion: (suggestion: string) => void
  
  /** Get search suggestions */
  getSuggestions: (query: string) => Promise<void>
  
  // UI State
  /** Search modal open state */
  isModalOpen: boolean
  
  /** Set modal open state */
  setModalOpen: (open: boolean) => void
  
  /** Recent searches (persisted) */
  recentSearches: string[]
  
  /** Popular searches cache */
  popularSearches: string[]
  
  /** Set popular searches */
  setPopularSearches: (searches: string[]) => void
  
  /** Last search timestamp */
  lastSearchTime: number | null
  
  /** Search performance metrics */
  searchMetrics: {
    averageSearchTime: number
    totalSearches: number
    successfulSearches: number
  }
}

/**
 * Initial state for the search store
 */
const initialState: SearchState = {
  query: '',
  results: [],
  isLoading: false,
  error: null,
  hasSearched: false,
  filters: {},
  totalCount: 0,
  currentPage: 1,
  suggestions: []
}

/**
 * Create the search store with Zustand
 * Uses immer for immutable updates and persist for recent searches
 */
export const useSearchStore = create<SearchStore>()(
  persist(
    immer((set, get) => ({
      // Initial state
      ...initialState,
      isModalOpen: false,
      recentSearches: [],
      popularSearches: [],
      lastSearchTime: null,
      searchMetrics: {
        averageSearchTime: 0,
        totalSearches: 0,
        successfulSearches: 0
      },

      // Query management
      setQuery: (query: string) => {
        set((state) => {
          state.query = query
          // Clear results if query is empty
          if (!query.trim()) {
            state.results = []
            state.hasSearched = false
            state.error = null
          }
        })
      },

      // Results management
      setResults: (results: SearchResult[]) => {
        set((state) => {
          state.results = results
          state.totalCount = results.length
          state.hasSearched = true
        })
      },

      // Loading state
      setLoading: (loading: boolean) => {
        set((state) => {
          state.isLoading = loading
        })
      },

      // Error handling
      setError: (error: string | null) => {
        set((state) => {
          state.error = error
          state.isLoading = false
        })
      },

      // Filter management
      setFilters: (newFilters: Partial<SearchFilters>) => {
        set((state) => {
          state.filters = { ...state.filters, ...newFilters }
        })
      },

      // Suggestions management
      setSuggestions: (suggestions: string[]) => {
        set((state) => {
          state.suggestions = suggestions
        })
      },

      // Main search function
      search: async (query: string, options?: SearchOptions) => {
        const startTime = performance.now()
        
        set((state) => {
          state.query = query
          state.isLoading = true
          state.error = null
        })

        try {
          const searchOptions: SearchOptions = {
            ...get().filters,
            ...options
          }

          const results = await searchService.globalSearch(query, searchOptions)
          
          const endTime = performance.now()
          const searchTime = endTime - startTime

          set((state) => {
            state.results = results
            state.totalCount = results.length
            state.hasSearched = true
            state.isLoading = false
            state.lastSearchTime = Date.now()
            
            // Update metrics
            state.searchMetrics.totalSearches += 1
            state.searchMetrics.successfulSearches += 1
            state.searchMetrics.averageSearchTime = 
              (state.searchMetrics.averageSearchTime * (state.searchMetrics.successfulSearches - 1) + searchTime) / 
              state.searchMetrics.successfulSearches
          })

          // Add to recent searches if query is meaningful
          if (query.trim().length > 1) {
            get().addRecentSearch(query.trim())
          }

        } catch (searchError) {
          const errorMessage = searchError instanceof Error 
            ? searchError.message 
            : 'Search failed. Please try again.'

          set((state) => {
            state.error = errorMessage
            state.isLoading = false
            state.results = []
            state.hasSearched = true
          })

          // Still update total searches count
          set((state) => {
            state.searchMetrics.totalSearches += 1
          })

          console.error('Search error:', searchError)
        }
      },

      // Clear search
      clearSearch: () => {
        set((state) => {
          state.query = ''
          state.results = []
          state.error = null
          state.hasSearched = false
          state.suggestions = []
          state.currentPage = 1
        })
      },

      // Recent searches management
      addRecentSearch: (query: string) => {
        set((state) => {
          const trimmedQuery = query.trim()
          if (!trimmedQuery || trimmedQuery.length < 2) return

          // Remove if already exists and add to front
          const filtered = state.recentSearches.filter(search => search !== trimmedQuery)
          state.recentSearches = [trimmedQuery, ...filtered].slice(0, 10) // Keep last 10
        })
      },

      getRecentSearches: () => {
        return get().recentSearches
      },

      clearRecentSearches: () => {
        set((state) => {
          state.recentSearches = []
        })
      },

      // Analytics tracking
      trackSearch: async (query: string, resultCount: number, userId?: string) => {
        try {
          const analytics: SearchAnalytics = {
            query,
            resultCount,
            searchTime: performance.now() - (get().lastSearchTime || performance.now()),
            userId,
            timestamp: new Date(),
            filters: get().filters
          }

          await searchService.trackSearch(query, resultCount, userId, analytics.searchTime)
        } catch (error) {
          console.warn('Failed to track search analytics:', error)
        }
      },

      // Suggestion management
      addSuggestion: (suggestion: string) => {
        set((state) => {
          if (!state.suggestions.includes(suggestion)) {
            state.suggestions = [...state.suggestions, suggestion].slice(0, 10)
          }
        })
      },

      getSuggestions: async (query: string) => {
        if (!query.trim() || query.length < 2) {
          set((state) => {
            state.suggestions = []
          })
          return
        }

        try {
          const suggestions = await searchService.getSearchSuggestions(query)
          set((state) => {
            state.suggestions = suggestions
          })
        } catch (error) {
          console.warn('Failed to get suggestions:', error)
          set((state) => {
            state.suggestions = []
          })
        }
      },

      // Modal state management
      setModalOpen: (open: boolean) => {
        set((state) => {
          state.isModalOpen = open
          // Clear search when modal closes
          if (!open) {
            state.query = ''
            state.results = []
            state.hasSearched = false
            state.error = null
            state.suggestions = []
          }
        })
      },

      // Popular searches
      setPopularSearches: (searches: string[]) => {
        set((state) => {
          state.popularSearches = searches
        })
      }
    })),
    {
      name: 'dce-search-store',
      storage: createJSONStorage(() => localStorage),
      // Only persist certain fields
      partialize: (state) => ({
        recentSearches: state.recentSearches,
        popularSearches: state.popularSearches,
        searchMetrics: state.searchMetrics
      }),
      version: 1,
      migrate: (persistedState: unknown, version: number) => {
        // Handle migration if needed
        if (version === 0) {
          // Migration from version 0 to 1
          const state = persistedState as Record<string, unknown>
          return {
            ...state,
            searchMetrics: {
              averageSearchTime: 0,
              totalSearches: 0,
              successfulSearches: 0
            }
          }
        }
        return persistedState as SearchStore
      }
    }
  )
)

/**
 * Selector hooks for optimized re-renders
 */
export const useSearchQuery = () => useSearchStore((state) => state.query)
export const useSearchResults = () => useSearchStore((state) => state.results)
export const useSearchLoading = () => useSearchStore((state) => state.isLoading)
export const useSearchError = () => useSearchStore((state) => state.error)
export const useSearchModal = () => useSearchStore((state) => state.isModalOpen)
export const useRecentSearches = () => useSearchStore((state) => state.recentSearches)
export const useSearchSuggestions = () => useSearchStore((state) => state.suggestions)

/**
 * Action selectors for better performance
 */
export const useSearchActions = () => useSearchStore((state) => ({
  setQuery: state.setQuery,
  search: state.search,
  clearSearch: state.clearSearch,
  setModalOpen: state.setModalOpen,
  setFilters: state.setFilters,
  getSuggestions: state.getSuggestions
}))

export default useSearchStore