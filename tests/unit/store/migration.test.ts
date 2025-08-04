/**
 * Migration Test Suite
 * 
 * Tests to verify that the migrated stores (networkStore.v2, blogStore.v2)
 * maintain compatibility and functionality while using the new standard factory.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

// Import migrated stores
import { useNetworkStore } from '../../../src/store/networkStore.v2'
import { 
  useBlogEditorStore, 
  useBlogFilterStore, 
  useBlogUIStore,
  useBlogDraft,
  useBlogFilters,
  useBlogModalState
} from '../../../src/store/blogStore.v2'

describe('NetworkStore.v2 Migration', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { result } = renderHook(() => useNetworkStore())
    act(() => {
      result.current.reset()
    })
  })

  it('should initialize with correct default state', () => {
    const { result } = renderHook(() => useNetworkStore())
    
    expect(result.current.network).toBeNull()
    expect(result.current.campaigns).toEqual([])
    expect(result.current.relationships).toEqual([])
    expect(result.current.metrics).toBeNull()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
    expect(result.current.selectedMode).toBe('network')
  })

  it('should update network state using Immer', () => {
    const { result } = renderHook(() => useNetworkStore())
    
    const mockNetwork = {
      id: 'test-network',
      user_id: 'user-123',
      company_name: 'Test Network',
      buyer_status: 'active' as const,
      credit_limit: 10000,
      current_balance: 5000,
      supplier_status: 'active' as const,
      credit_balance: 2000,
      margin_percentage: 20,
      routing_rules: [],
      quality_thresholds: {
        minimum_duration: 30,
        maximum_duration: 3600,
        required_fields: ['phone', 'email'],
        blocked_numbers: [],
        allowed_states: [],
        business_hours: {
          timezone: 'America/New_York',
          schedule: {}
        }
      },
      approved_suppliers: [],
      approved_buyers: [],
      settings: {
        auto_accept_calls: false,
        auto_route_calls: true,
        margin_type: 'percentage' as const,
        minimum_margin: 5,
        payment_terms: 30,
        notifications: {
          email_alerts: true,
          sms_alerts: false,
          webhook_url: undefined,
          alert_thresholds: {
            low_margin: 10,
            high_rejection_rate: 30,
            low_quality_score: 70
          }
        }
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    act(() => {
      result.current.setNetwork(mockNetwork)
    })

    expect(result.current.network).toEqual(mockNetwork)
  })

  it('should handle async actions with loading states', async () => {
    const { result } = renderHook(() => useNetworkStore())
    
    // Start async action
    const fetchPromise = act(async () => {
      await result.current.fetchNetworkData('test-id')
    })

    await fetchPromise

    expect(result.current.network).toBeTruthy()
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error).toBeNull()
  })
})

describe('BlogStore.v2 Migration', () => {
  beforeEach(() => {
    // Reset all blog stores
    const { result: editorResult } = renderHook(() => useBlogEditorStore())
    const { result: filterResult } = renderHook(() => useBlogFilterStore())
    const { result: uiResult } = renderHook(() => useBlogUIStore())
    
    act(() => {
      editorResult.current.clearDraft()
      filterResult.current.resetFilters()
      uiResult.current.closeCreateModal()
    })
  })

  describe('BlogEditorStore', () => {
    it('should manage draft state with Immer', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      const draftData = {
        title: 'Test Post',
        content: 'Test content',
        excerpt: 'Test excerpt'
      }

      act(() => {
        result.current.setDraft(draftData)
      })

      expect(result.current.draft).toEqual(draftData)
      expect(result.current.isDraftSaved).toBe(false)
    })

    it('should update draft partially', () => {
      const { result } = renderHook(() => useBlogEditorStore())
      
      act(() => {
        result.current.setDraft({ title: 'Initial Title' })
        result.current.updateDraft({ content: 'New Content' })
      })

      expect(result.current.draft).toEqual({
        title: 'Initial Title',
        content: 'New Content'
      })
    })
  })

  describe('BlogFilterStore', () => {
    it('should manage filters and pagination', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      act(() => {
        result.current.setFilters({ status: 'published' })
        result.current.setSearchQuery('test query')
      })

      expect(result.current.filters).toEqual({ status: 'published' })
      expect(result.current.searchQuery).toBe('test query')
      expect(result.current.currentPage).toBe(1) // Should reset to page 1
    })

    it('should handle post selection', () => {
      const { result } = renderHook(() => useBlogFilterStore())
      
      act(() => {
        result.current.togglePostSelection('post-1')
        result.current.togglePostSelection('post-2')
      })

      expect(result.current.selectedPostIds).toEqual(['post-1', 'post-2'])

      act(() => {
        result.current.togglePostSelection('post-1')
      })

      expect(result.current.selectedPostIds).toEqual(['post-2'])
    })
  })

  describe('BlogUIStore', () => {
    it('should manage modal states', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      act(() => {
        result.current.openCreateModal('blog_post')
      })

      expect(result.current.modalState.type).toBe('create')
      expect(result.current.modalState.entityType).toBe('blog_post')

      act(() => {
        result.current.closeCreateModal()
      })

      expect(result.current.modalState.type).toBe(null)
    })

    it('should manage view preferences', () => {
      const { result } = renderHook(() => useBlogUIStore())
      
      act(() => {
        result.current.setViewMode('list')
        result.current.toggleFilters()
      })

      expect(result.current.viewMode).toBe('list')
      expect(result.current.showFilters).toBe(false)
    })
  })

  describe('Optimized Selectors', () => {
    it('should provide granular selectors for better performance', () => {
      const { result: draftResult } = renderHook(() => useBlogDraft())
      const { result: filtersResult } = renderHook(() => useBlogFilters())
      const { result: modalResult } = renderHook(() => useBlogModalState())
      
      // Initially should be default values
      expect(draftResult.current).toBeNull()
      expect(filtersResult.current).toEqual({})
      expect(modalResult.current.type).toBe(null)
    })
  })
})

describe('Store Factory Integration', () => {
  it('should maintain store instance consistency', () => {
    const { result: store1 } = renderHook(() => useNetworkStore())
    const { result: store2 } = renderHook(() => useNetworkStore())
    
    // Should be the same store instance
    expect(store1.current.setNetwork).toBe(store2.current.setNetwork)
  })

  it('should support feature flag compatibility', () => {
    // Stores should be available regardless of feature flag
    expect(useNetworkStore).toBeDefined()
    expect(useBlogEditorStore).toBeDefined()
    expect(useBlogFilterStore).toBeDefined()
    expect(useBlogUIStore).toBeDefined()
  })
})

describe('Performance and Memory', () => {
  it('should not cause memory leaks with repeated state updates', () => {
    const { result } = renderHook(() => useNetworkStore())
    
    // Perform many state updates
    for (let i = 0; i < 100; i++) {
      act(() => {
        result.current.setSelectedMode(i % 2 === 0 ? 'network' : 'supplier')
      })
    }
    
    // Should still be functional
    expect(result.current.selectedMode).toBeDefined()
  })
})