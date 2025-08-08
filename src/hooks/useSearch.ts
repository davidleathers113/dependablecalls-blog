import { useState, useCallback, useMemo, useEffect } from 'react'
import Fuse, { type IFuseOptions } from 'fuse.js'
import { useDebounce } from './useDebounce'
import type { SearchItem } from '../types/search'

// Local search options for Fuse.js integration
export interface FuseSearchOptions {
  threshold?: number
  keys?: string[]
  includeScore?: boolean
  limit?: number
  minMatchCharLength?: number
}

const defaultFuseOptions: IFuseOptions<SearchItem> = {
  keys: [
    { name: 'title', weight: 0.4 },
    { name: 'description', weight: 0.3 },
    { name: 'tags', weight: 0.2 },
    { name: 'category', weight: 0.1 }
  ],
  threshold: 0.3,
  includeScore: true,
  minMatchCharLength: 2,
  shouldSort: true,
  findAllMatches: false,
  location: 0,
  distance: 100,
}

export function useSearch<T extends SearchItem>(
  items: T[],
  options: FuseSearchOptions = {}
) {
  const [query, setQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  
  const debouncedQuery = useDebounce(query, 300)
  
  // Create Fuse instance
  const fuse = useMemo(() => {
    const fuseOptions = {
      ...defaultFuseOptions,
      ...options,
      keys: options.keys || defaultFuseOptions.keys,
    }
    return new Fuse(items, fuseOptions)
  }, [items, options])
  
  // Get available categories
  const categories = useMemo(() => {
    const categorySet = new Set<string>()
    items.forEach(item => {
      if (item.category) {
        categorySet.add(item.category)
      }
    })
    return Array.from(categorySet).sort()
  }, [items])
  
  // Perform search
  const searchResults = useMemo(() => {
    setIsSearching(true)
    
    let results: T[] = []
    
    if (debouncedQuery.trim()) {
      const fuseResults = fuse.search(debouncedQuery)
      results = fuseResults
        .slice(0, options.limit || 20)
        .map(result => result.item)
    } else {
      // If no query, return all items (limited)
      results = items.slice(0, options.limit || 20)
    }
    
    // Apply category filter
    if (selectedCategory) {
      results = results.filter(item => item.category === selectedCategory)
    }
    
    setIsSearching(false)
    return results
  }, [debouncedQuery, fuse, items, options.limit, selectedCategory])
  
  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('')
    setSelectedCategory(null)
  }, [])
  
  // Highlight search matches in text (NO REGEX - DCE security requirement)
  const highlightMatches = useCallback((text: string, searchTerm: string) => {
    if (!searchTerm.trim()) return text
    
    const lowerText = text.toLowerCase()
    const lowerTerm = searchTerm.toLowerCase()
    const termLength = searchTerm.length
    
    const parts: string[] = []
    let lastIndex = 0
    let searchIndex = lowerText.indexOf(lowerTerm, lastIndex)
    
    while (searchIndex !== -1) {
      // Add text before match
      if (searchIndex > lastIndex) {
        parts.push(text.substring(lastIndex, searchIndex))
      }
      
      // Add matched text with highlight
      const matchedText = text.substring(searchIndex, searchIndex + termLength)
      parts.push(`<mark>${matchedText}</mark>`)
      
      lastIndex = searchIndex + termLength
      searchIndex = lowerText.indexOf(lowerTerm, lastIndex)
    }
    
    // Add remaining text after last match
    if (lastIndex < text.length) {
      parts.push(text.substring(lastIndex))
    }
    
    return parts.join('')
  }, [])
  
  return {
    query,
    setQuery,
    searchResults,
    isSearching,
    clearSearch,
    categories,
    selectedCategory,
    setSelectedCategory,
    highlightMatches,
    resultsCount: searchResults.length,
    hasResults: searchResults.length > 0,
  }
}

// Hook for global site search
export function useGlobalSearch() {
  const [searchItems, setSearchItems] = useState<SearchItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [retryCount, setRetryCount] = useState(0)
  
  // Load search index with retry logic
  useEffect(() => {
    const loadSearchIndex = async () => {
      setIsLoading(true)
      setError(null)
      
      try {
        // Simulate network delay for more realistic UX
        await new Promise(resolve => setTimeout(resolve, 300))
        
        // In a real app, this would fetch from an API or load from a static index
        // For now, we'll create a mock index
        const mockSearchItems: SearchItem[] = [
          // Dashboard items
          { id: '1', title: 'Dashboard', category: 'Navigation', url: '/app/dashboard', 
            description: 'View your main dashboard with analytics and metrics' },
          { id: '2', title: 'Supplier Dashboard', category: 'Navigation', url: '/app/supplier', 
            description: 'Manage your supplier account and view performance' },
          { id: '3', title: 'Buyer Dashboard', category: 'Navigation', url: '/app/buyer', 
            description: 'Browse campaigns and manage purchases' },
          
          // Campaign items
          { id: '4', title: 'Create Campaign', category: 'Campaigns', url: '/app/campaigns/new', 
            description: 'Create a new campaign for lead generation' },
          { id: '5', title: 'Campaign Analytics', category: 'Campaigns', url: '/app/campaigns/analytics', 
            description: 'View detailed analytics for your campaigns' },
          { id: '6', title: 'Campaign Settings', category: 'Campaigns', url: '/app/campaigns/settings', 
            description: 'Configure campaign settings and preferences' },
          
          // Settings items
          { id: '7', title: 'Account Settings', category: 'Settings', url: '/app/settings/account', 
            description: 'Manage your account information and preferences' },
          { id: '8', title: 'Billing Settings', category: 'Settings', url: '/app/settings/billing', 
            description: 'Manage payment methods and billing information' },
          { id: '9', title: 'Notification Settings', category: 'Settings', url: '/app/settings/notifications', 
            description: 'Configure email and push notification preferences' },
          
          // Help items
          { id: '10', title: 'Getting Started Guide', category: 'Help', url: '/help/getting-started', 
            description: 'Learn how to get started with DependableCalls' },
          { id: '11', title: 'API Documentation', category: 'Help', url: '/help/api', 
            description: 'Technical documentation for API integration' },
          { id: '12', title: 'Contact Support', category: 'Help', url: '/contact', 
            description: 'Get in touch with our support team' },
          
          // Legal items
          { id: '13', title: 'Privacy Policy', category: 'Legal', url: '/privacy', 
            description: 'Our privacy policy and data handling practices' },
          { id: '14', title: 'Terms of Service', category: 'Legal', url: '/terms', 
            description: 'Terms and conditions for using DependableCalls' },
          { id: '15', title: 'Cookie Policy', category: 'Legal', url: '/cookies', 
            description: 'Information about how we use cookies' },
        ]
        
        setSearchItems(mockSearchItems)
      } catch (searchError) {
        const errorMessage = searchError instanceof Error ? searchError.message : 'Failed to load search index'
        setError(errorMessage)
        
        // Log error for monitoring (not console.error)
        if (typeof window !== 'undefined' && 'captureError' in window) {
          const captureError = (window as { captureError?: (error: Error, context: Record<string, unknown>) => void }).captureError
          if (captureError) {
            captureError(new Error(`Search index loading failed: ${errorMessage}`), {
              context: 'useGlobalSearch',
              retryCount,
              searchItems: searchItems.length
            })
          }
        }
      } finally {
        setIsLoading(false)
      }
    }
    
    loadSearchIndex()
  }, [retryCount, searchItems.length]) // Re-run when retryCount or searchItems.length changes
  
  // Retry function for error recovery
  const retrySearch = () => {
    if (retryCount < 3) { // Max 3 retries
      setRetryCount(prev => prev + 1)
    }
  }
  
  const search = useSearch(searchItems, {
    threshold: 0.4,
    limit: 10,
  } as FuseSearchOptions)
  
  return {
    ...search,
    isLoading,
    error,
    retrySearch,
    hasError: !!error,
    canRetry: retryCount < 3,
    retryCount
  }
}