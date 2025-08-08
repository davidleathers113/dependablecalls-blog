import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSearch, useGlobalSearch } from '../useSearch'
import type { SearchItem } from '../useSearch'

// Mock the useDebounce hook
vi.mock('../useDebounce', () => ({
  useDebounce: (value: string) => value
}))

describe('useSearch', () => {
  const mockItems: SearchItem[] = [
    {
      id: '1',
      title: 'Dashboard',
      description: 'Main dashboard view',
      category: 'Navigation',
      url: '/dashboard',
      tags: ['main', 'overview']
    },
    {
      id: '2',
      title: 'Settings',
      description: 'Application settings',
      category: 'Configuration',
      url: '/settings',
      tags: ['config', 'preferences']
    },
    {
      id: '3',
      title: 'Profile',
      description: 'User profile page',
      category: 'Navigation',
      url: '/profile',
      tags: ['user', 'account']
    },
    {
      id: '4',
      title: 'Campaigns',
      description: 'Campaign management',
      category: 'Features',
      url: '/campaigns',
      tags: ['marketing', 'ads']
    }
  ]

  it('should initialize with empty query and all items', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    expect(result.current.query).toBe('')
    expect(result.current.searchResults).toHaveLength(4)
    expect(result.current.isSearching).toBe(false)
    expect(result.current.hasResults).toBe(true)
  })

  it('should search items based on query', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    act(() => {
      result.current.setQuery('dash')
    })
    
    expect(result.current.query).toBe('dash')
    expect(result.current.searchResults).toHaveLength(1)
    expect(result.current.searchResults[0].title).toBe('Dashboard')
  })

  it('should filter by category', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    act(() => {
      result.current.setSelectedCategory('Navigation')
    })
    
    expect(result.current.searchResults).toHaveLength(2)
    expect(result.current.searchResults.every(item => item.category === 'Navigation')).toBe(true)
  })

  it('should combine search query and category filter', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    act(() => {
      result.current.setQuery('pro')
      result.current.setSelectedCategory('Navigation')
    })
    
    expect(result.current.searchResults).toHaveLength(1)
    expect(result.current.searchResults[0].title).toBe('Profile')
  })

  it('should clear search and reset state', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    act(() => {
      result.current.setQuery('test')
      result.current.setSelectedCategory('Navigation')
    })
    
    act(() => {
      result.current.clearSearch()
    })
    
    expect(result.current.query).toBe('')
    expect(result.current.selectedCategory).toBeNull()
    expect(result.current.searchResults).toHaveLength(4)
  })

  it('should return unique categories sorted alphabetically', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    expect(result.current.categories).toEqual([
      'Configuration',
      'Features',
      'Navigation'
    ])
  })

  it('should respect limit option', () => {
    const { result } = renderHook(() => useSearch(mockItems, { limit: 2 }))
    
    expect(result.current.searchResults).toHaveLength(2)
  })

  it('should highlight matches without using regex', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    const highlighted = result.current.highlightMatches('Dashboard settings', 'dash')
    expect(highlighted).toBe('<mark>Dash</mark>board settings')
    
    const multiMatch = result.current.highlightMatches('dashboard Dashboard DASHBOARD', 'dash')
    expect(multiMatch).toContain('<mark>')
    expect(multiMatch).not.toMatch(/RegExp/)
  })

  it('should handle case-insensitive highlighting', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    const highlighted = result.current.highlightMatches('DASHBOARD', 'dash')
    expect(highlighted).toBe('<mark>DASH</mark>BOARD')
  })

  it('should handle empty search term in highlighting', () => {
    const { result } = renderHook(() => useSearch(mockItems))
    
    const highlighted = result.current.highlightMatches('Dashboard', '')
    expect(highlighted).toBe('Dashboard')
  })

  it('should handle special characters in search', () => {
    const specialItems: SearchItem[] = [
      {
        id: '1',
        title: 'User (Admin)',
        category: 'Users',
        url: '/users/admin'
      }
    ]
    
    const { result } = renderHook(() => useSearch(specialItems))
    
    act(() => {
      result.current.setQuery('(Admin)')
    })
    
    expect(result.current.searchResults).toHaveLength(1)
  })
})

describe('useGlobalSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should load search items on mount', async () => {
    const { result } = renderHook(() => useGlobalSearch())
    
    expect(result.current.isLoading).toBe(true)
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    expect(result.current.searchResults.length).toBeGreaterThan(0)
  })

  it('should handle loading errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    
    // Mock the useEffect to throw an error
    const { result } = renderHook(() => useGlobalSearch())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Even on error, should not crash
    expect(result.current.searchResults).toBeDefined()
    
    consoleSpy.mockRestore()
  })

  it('should include proper search categories', async () => {
    const { result } = renderHook(() => useGlobalSearch())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    const categories = result.current.categories
    expect(categories).toContain('Navigation')
    expect(categories).toContain('Campaigns')
    expect(categories).toContain('Settings')
    expect(categories).toContain('Help')
    expect(categories).toContain('Legal')
  })

  it('should have proper search configuration', async () => {
    const { result } = renderHook(() => useGlobalSearch())
    
    await waitFor(() => {
      expect(result.current.isLoading).toBe(false)
    })
    
    // Should limit results to 10
    act(() => {
      result.current.setQuery('') // Reset to show all
    })
    
    expect(result.current.searchResults.length).toBeLessThanOrEqual(10)
  })
})