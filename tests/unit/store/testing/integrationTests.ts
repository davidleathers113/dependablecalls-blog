/**
 * Integration Tests for DCE Zustand Store Architecture
 * 
 * Comprehensive integration tests covering:
 * - Cross-store synchronization and communication
 * - Auth flow integration with other stores
 * - Real-time data updates across stores
 * - State persistence and hydration
 * - Error handling and recovery scenarios
 * - Performance under load
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act, waitFor } from '@testing-library/react'
import { 
  createStoreTestWrapper, 
  createStateAssertions, 
  runCrossStoreTest,
  mockDataGenerators
} from './storeTestUtils'

// Import all stores for integration testing
import { useAuthStore } from '../authStore'
import { useBlogUIStore, useBlogEditorStore } from '../blogStore'
import { useBuyerStore } from '../buyerStore'
import { useSupplierStore } from '../supplierStore'
import { useSettingsStore } from '../settingsStore'
import { useNavigationStore } from '../slices/navigationSlice'

// Import monitoring stores
import { usePerformanceMonitor } from '../monitoring/performanceMonitor'
import { useStateDebugger } from '../debugging/stateDebugger'

// ===========================================
// TEST SETUP AND CONFIGURATION
// ===========================================

describe('DCE Store Integration Tests', () => {
  let authWrapper: ReturnType<typeof createStoreTestWrapper>
  let blogUIWrapper: ReturnType<typeof createStoreTestWrapper>
  let blogEditorWrapper: ReturnType<typeof createStoreTestWrapper>
  let buyerWrapper: ReturnType<typeof createStoreTestWrapper>
  let supplierWrapper: ReturnType<typeof createStoreTestWrapper>
  let settingsWrapper: ReturnType<typeof createStoreTestWrapper>
  let navigationWrapper: ReturnType<typeof createStoreTestWrapper>
  let performanceWrapper: ReturnType<typeof createStoreTestWrapper>

  beforeEach(() => {
    // Create test wrappers for all stores
    authWrapper = createStoreTestWrapper(useAuthStore, {
      storeName: 'auth-store',
      trackPerformance: true,
      trackStateChanges: true
    })

    blogUIWrapper = createStoreTestWrapper(useBlogUIStore, {
      storeName: 'blog-ui-store',
      trackPerformance: true,
      trackStateChanges: true
    })

    blogEditorWrapper = createStoreTestWrapper(useBlogEditorStore, {
      storeName: 'blog-editor-store',
      persistKey: 'blog-editor-storage',
      trackPerformance: true
    })

    buyerWrapper = createStoreTestWrapper(useBuyerStore, {
      storeName: 'buyer-store',
      trackPerformance: true
    })

    supplierWrapper = createStoreTestWrapper(useSupplierStore, {
      storeName: 'supplier-store',
      trackPerformance: true
    })

    settingsWrapper = createStoreTestWrapper(useSettingsStore, {
      storeName: 'settings-store',
      persistKey: 'settings-storage',
      trackPerformance: true
    })

    navigationWrapper = createStoreTestWrapper(useNavigationStore, {
      storeName: 'navigation-store',
      trackPerformance: true,
      trackStateChanges: true
    })

    performanceWrapper = createStoreTestWrapper(usePerformanceMonitor, {
      storeName: 'performance-monitor',
      trackPerformance: false // Don't track performance of performance monitor
    })
  })

  afterEach(() => {
    // Clean up all wrappers
    authWrapper.cleanup()
    blogUIWrapper.cleanup()
    blogEditorWrapper.cleanup()
    buyerWrapper.cleanup()
    supplierWrapper.cleanup()
    settingsWrapper.cleanup()
    navigationWrapper.cleanup()
    performanceWrapper.cleanup()
  })

  // ===========================================
  // AUTH FLOW INTEGRATION TESTS
  // ===========================================

  describe('Authentication Flow Integration', () => {
    it('should synchronize user authentication across all stores', async () => {
      const authAssertions = createStateAssertions(authWrapper)
      const settingsAssertions = createStateAssertions(settingsWrapper)

      await runCrossStoreTest({
        name: 'auth-sync-test',
        store1: authWrapper,
        store2: settingsWrapper,
        
        setup: async () => {
          // Initial state - user not authenticated
          authAssertions.expectStateProperty('isAuthenticated', false)
          authAssertions.expectStateProperty('user', null)
        },
        
        execute: async () => {
          // Simulate user login
          const mockUser = mockDataGenerators.authState().user!
          
          act(() => {
            authWrapper.store.getState().login(mockUser, {
              accessToken: 'test-token',
              refreshToken: 'test-refresh',
              expiresAt: Date.now() + 3600000
            })
          })

          // Wait for settings store to react to auth changes
          await waitFor(() => {
            const settingsState = settingsWrapper.getState()
            expect(settingsState.userId).toBe(mockUser.id)
          })
        },
        
        verify: async () => {
          // Verify auth state
          authAssertions.expectStateProperty('isAuthenticated', true)
          authAssertions.expectStateToHaveProperty('user')
          
          // Verify settings loaded for authenticated user
          settingsAssertions.expectStateToHaveProperty('userId')
          settingsAssertions.expectStateToHaveProperty('preferences')
          
          // Verify state changes were tracked
          authAssertions.expectStateChanged('isAuthenticated')
          authAssertions.expectStateChanged('user')
          settingsAssertions.expectStateChanged('userId')
        }
      })
    })

    it('should handle authentication errors and cleanup', async () => {
      const authAssertions = createStateAssertions(authWrapper)

      await runCrossStoreTest({
        name: 'auth-error-cleanup',
        store1: authWrapper,
        store2: settingsWrapper,
        
        setup: async () => {
          // Start with authenticated user
          const mockUser = mockDataGenerators.authState().user!
          authWrapper.setState({
            isAuthenticated: true,
            user: mockUser,
            session: {
              accessToken: 'test-token',
              refreshToken: 'test-refresh',
              expiresAt: Date.now() + 3600000
            }
          })
        },
        
        execute: async () => {
          // Simulate authentication error
          act(() => {
            authWrapper.store.getState().logout()
          })

          await waitFor(() => {
            const authState = authWrapper.getState()
            expect(authState.isAuthenticated).toBe(false)
          })
        },
        
        verify: async () => {
          // Verify complete cleanup
          authAssertions.expectStateProperty('isAuthenticated', false)
          authAssertions.expectStateProperty('user', null)
          authAssertions.expectStateProperty('session', null)
          
          // Verify settings reset
          const settingsState = settingsWrapper.getState()
          expect(settingsState.userId).toBeNull()
        }
      })
    })
  })

  // ===========================================
  // BLOG STORE INTEGRATION TESTS
  // ===========================================

  describe('Blog Store Integration', () => {
    it('should coordinate between editor, filter, and UI stores', async () => {
      const editorAssertions = createStateAssertions(blogEditorWrapper)
      const uiAssertions = createStateAssertions(blogUIWrapper)

      await runCrossStoreTest({
        name: 'blog-coordination-test',
        store1: blogEditorWrapper,
        store2: blogUIWrapper,
        
        setup: async () => {
          // Setup draft in editor
          const mockDraft = mockDataGenerators.blogPost()
          blogEditorWrapper.setState({
            draft: mockDraft,
            isDraftSaved: false
          })
        },
        
        execute: async () => {
          // Open create modal via UI store
          act(() => {
            blogUIWrapper.store.getState().openCreateModal('blog_post')
          })

          // Save draft in editor
          act(() => {
            blogEditorWrapper.store.getState().markDraftSaved()
          })
        },
        
        verify: async () => {
          // Verify modal state using assertions
          uiAssertions.expectStateProperty('modalState.type', 'create')
          uiAssertions.expectStateProperty('modalState.entityType', 'blog_post')
          uiAssertions.expectStateChanged('modalState')
          
          // Verify draft state
          editorAssertions.expectStateProperty('isDraftSaved', true)
          editorAssertions.expectStateToHaveProperty('lastSavedAt')
        }
      })
    })

    it('should handle modal state machine transitions correctly', async () => {
      const uiAssertions = createStateAssertions(blogUIWrapper)

      await runCrossStoreTest({
        name: 'modal-state-machine-test',
        store1: blogUIWrapper,
        store2: blogEditorWrapper,
        
        setup: async () => {
          // Ensure clean state
          blogUIWrapper.setState({
            modalState: { type: null }
          })
        },
        
        execute: async () => {
          // Test state machine transitions
          act(() => {
            blogUIWrapper.store.getState().openCreateModal()
          })

          await waitFor(() => {
            expect(blogUIWrapper.getState().modalState.type).toBe('create')
          })

          act(() => {
            blogUIWrapper.store.getState().openEditModal('post-123', true)
          })

          await waitFor(() => {
            expect(blogUIWrapper.getState().modalState.type).toBe('edit')
          })

          act(() => {
            blogUIWrapper.store.getState().closeEditModal()
          })
        },
        
        verify: async () => {
          // Verify final state
          uiAssertions.expectStateProperty('modalState', { type: null })
          
          // Verify multiple state transitions occurred
          const history = blogUIWrapper.getStateHistory()
          expect(history.length).toBeGreaterThanOrEqual(3) // open create, open edit, close
          
          // Verify rollback capability
          const canRollback = blogUIWrapper.store.getState().rollbackModal()
          expect(canRollback).toBe(true)
        }
      })
    })
  })

  // ===========================================
  // NAVIGATION INTEGRATION TESTS
  // ===========================================

  describe('Navigation Integration', () => {
    it('should coordinate navigation state with user preferences', async () => {
      const navAssertions = createStateAssertions(navigationWrapper)
      const settingsAssertions = createStateAssertions(settingsWrapper)

      await runCrossStoreTest({
        name: 'navigation-preferences-sync',
        store1: navigationWrapper,
        store2: settingsWrapper,
        
        setup: async () => {
          // Set initial preferences
          settingsWrapper.setState({
            preferences: {
              navigation: {
                sidebarCollapsed: false,
                rememberState: true
              }
            }
          })
        },
        
        execute: async () => {
          // Toggle sidebar via navigation store
          act(() => {
            navigationWrapper.store.getState().toggleElement('desktop_sidebar')
          })

          // Wait for preferences to sync
          await waitFor(() => {
            const navState = navigationWrapper.getState()
            const settingsState = settingsWrapper.getState()
            
            expect(settingsState.preferences.navigation?.sidebarCollapsed)
              .toBe(navState.desktopSidebar.type === 'collapsed')
          })
        },
        
        verify: async () => {
          // Verify navigation state changed
          navAssertions.expectStateChanged('desktopSidebar')
          
          // Verify preferences were updated
          settingsAssertions.expectStateChanged('preferences')
          
          const navState = navigationWrapper.getState()
          const settingsState = settingsWrapper.getState()
          
          expect(navState.desktopSidebar.type).toBe('collapsed')
          expect(settingsState.preferences.navigation?.sidebarCollapsed).toBe(true)
        }
      })
    })

    it('should handle mobile navigation state machine correctly', async () => {
      const navAssertions = createStateAssertions(navigationWrapper)

      await runCrossStoreTest({
        name: 'mobile-navigation-test',
        store1: navigationWrapper,
        store2: settingsWrapper,
        
        setup: async () => {
          // Simulate mobile viewport
          Object.defineProperty(window, 'innerWidth', {
            writable: true,
            configurable: true,
            value: 768
          })
        },
        
        execute: async () => {
          // Test mobile menu transitions
          act(() => {
            navigationWrapper.store.getState().toggleElement('mobile_menu')
          })

          await waitFor(() => {
            expect(navigationWrapper.getState().mobileMenu.type).toBe('expanded')
          })

          // Test auto-close on navigation
          act(() => {
            navigationWrapper.store.getState().navigateAndClose('/dashboard')
          })

          await waitFor(() => {
            expect(navigationWrapper.getState().mobileMenu.type).toBe('collapsed')
          })
        },
        
        verify: async () => {
          navAssertions.expectStateProperty('mobileMenu', { 
            type: 'collapsed', 
            element: 'mobile_menu' 
          })
          
          // Verify accessibility updates
          const navState = navigationWrapper.getState()
          expect(navState.focusState.activeElement).toBe('main-content')
          expect(navState.focusState.shouldAnnounce).toBe(true)
        }
      })
    })
  })

  // ===========================================
  // REAL-TIME DATA INTEGRATION TESTS
  // ===========================================

  describe('Real-time Data Integration', () => {
    it('should handle real-time updates across buyer and supplier stores', async () => {
      const buyerAssertions = createStateAssertions(buyerWrapper)
      const supplierAssertions = createStateAssertions(supplierWrapper)
      
      // Mock real-time subscription
      const mockRealtime = {
        subscribe: vi.fn(),
        unsubscribe: vi.fn(),
        send: vi.fn()
      }

      await runCrossStoreTest({
        name: 'realtime-data-sync',
        store1: buyerWrapper,
        store2: supplierWrapper,
        
        setup: async () => {
          // Setup realtime mock
          vi.mocked(mockRealtime.subscribe).mockReturnValue({ unsubscribe: vi.fn() })
          
          // Setup initial campaign data
          const mockCampaign = mockDataGenerators.campaign()
          buyerWrapper.setState({
            campaigns: [mockCampaign],
            activeCampaign: mockCampaign
          })
        },
        
        execute: async () => {
          // Simulate real-time campaign update
          const updatedCampaign = {
            ...mockDataGenerators.campaign(),
            id: buyerWrapper.getState().activeCampaign?.id,
            status: 'paused' as const,
            budget: 500
          }

          act(() => {
            buyerWrapper.store.getState().updateCampaign(updatedCampaign.id!, updatedCampaign)
          })

          // Supplier should receive notification of campaign changes
          await waitFor(() => {
            const supplierState = supplierWrapper.getState()
            const campaignUpdate = supplierState.notifications?.find(
              n => n.type === 'campaign_update' && n.campaignId === updatedCampaign.id
            )
            expect(campaignUpdate).toBeDefined()
          })
        },
        
        verify: async () => {
          // Verify buyer campaign updated using assertions
          buyerAssertions.expectStateProperty('activeCampaign.status', 'paused')
          buyerAssertions.expectStateProperty('activeCampaign.budget', 500)
          buyerAssertions.expectStateChanged('activeCampaign')
          
          // Verify supplier received notification using assertions
          supplierAssertions.expectStateToHaveProperty('notifications')
          supplierAssertions.expectStateChanged('notifications')
          
          // Verify realtime subscription was used
          expect(mockRealtime.subscribe).toHaveBeenCalled()
        }
      })
    })
  })

  // ===========================================
  // PERFORMANCE INTEGRATION TESTS
  // ===========================================

  describe('Performance Integration', () => {
    it('should maintain performance under concurrent store updates', async () => {
      const performanceAssertions = createStateAssertions(performanceWrapper)

      await runCrossStoreTest({
        name: 'concurrent-updates-performance',
        store1: authWrapper,
        store2: performanceWrapper,
        
        setup: async () => {
          // Start performance monitoring
          act(() => {
            performanceWrapper.store.getState().startMonitoring()
          })
        },
        
        execute: async () => {
          // Perform concurrent updates across multiple stores
          const updates = Array.from({ length: 100 }, (_, i) => 
            act(() => {
              authWrapper.setState({ lastActivity: Date.now() + i })
              blogUIWrapper.setState({ viewMode: i % 2 === 0 ? 'grid' : 'list' })
              navigationWrapper.store.getState().updateAriaStates()
            })
          )

          // Wait for all updates to complete
          await Promise.all(updates)
          await waitFor(() => {
            const perfState = performanceWrapper.getState()
            expect(perfState.totalStateUpdates).toBeGreaterThan(90)
          })
        },
        
        verify: async () => {
          // Verify performance metrics using assertions
          performanceAssertions.expectStateToHaveProperty('averageUpdateTime')
          performanceAssertions.expectStateToHaveProperty('memoryUsage')
          performanceAssertions.expectStateToHaveProperty('totalStateUpdates')
          performanceAssertions.expectStateChanged('totalStateUpdates')
          
          const perfState = performanceWrapper.getState()
          
          // Verify performance metrics are reasonable
          expect(perfState.averageUpdateTime).toBeLessThan(10) // ms
          expect(perfState.memoryUsage).toBeLessThan(50 * 1024 * 1024) // 50MB
          expect(perfState.totalStateUpdates).toBeGreaterThan(0)
          
          // Verify no memory leaks
          const initialMemory = perfState.memoryBaseline
          const currentMemory = perfState.memoryUsage
          const memoryIncrease = currentMemory - initialMemory
          expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024) // 10MB max increase
        }
      })
    })

    it('should track cross-store selector dependencies', async () => {
      await runCrossStoreTest({
        name: 'selector-dependency-tracking',
        store1: authWrapper,
        store2: settingsWrapper,
        
        setup: async () => {
          // Enable dependency tracking
          const debuggerState = useStateDebugger.getState()
          debuggerState.startTracking()
        },
        
        execute: async () => {
          // Create selector dependencies across stores
          const authUser = authWrapper.getState().user
          // Get user settings to establish cross-store dependency
          settingsWrapper.getState().getUserSettings?.(authUser?.id)
          
          // Trigger updates that should cascade
          act(() => {
            authWrapper.setState({
              user: { ...authUser!, preferences: { theme: 'dark' } }
            })
          })

          await waitFor(() => {
            const settingsState = settingsWrapper.getState()
            expect(settingsState.preferences.theme).toBe('dark')
          })
        },
        
        verify: async () => {
          const debuggerState = useStateDebugger.getState()
          const dependencies = debuggerState.selectorDependencies
          
          // Verify cross-store dependencies were tracked
          expect(Object.keys(dependencies).length).toBeGreaterThan(0)
          
          // Verify cascade performance
          const metrics = debuggerState.performanceMetrics
          expect(metrics.selectorCalls).toBeGreaterThan(0)
          expect(metrics.averageExecutionTime).toBeLessThan(5) // ms
        }
      })
    })
  })

  // ===========================================
  // ERROR HANDLING INTEGRATION TESTS
  // ===========================================

  describe('Error Handling Integration', () => {
    it('should gracefully handle store initialization failures', async () => {
      const scenarios = [
        {
          name: 'persistent-storage-failure',
          setup: () => {
            // Mock storage failure
            vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
              throw new Error('Storage quota exceeded')
            })
          }
        },
        {
          name: 'network-connection-failure',
          setup: () => {
            // Mock network failure
            global.navigator = {
              ...navigator,
              onLine: false
            } as Navigator
          }
        }
      ]

      for (const scenario of scenarios) {
        await runCrossStoreTest({
          name: scenario.name,
          store1: authWrapper,
          store2: settingsWrapper,
          
          setup: async () => {
            scenario.setup()
          },
          
          execute: async () => {
            // Attempt operations that might fail
            try {
              act(() => {
                authWrapper.store.getState().initialize?.()
                settingsWrapper.store.getState().loadUserSettings?.()
              })
            } catch (error) {
              // Errors should be handled gracefully
              expect(error).toBeDefined()
            }
          },
          
          verify: async () => {
            // Verify stores are in valid fallback state
            const authState = authWrapper.getState()
            const settingsState = settingsWrapper.getState()
            
            expect(authState).toBeDefined()
            expect(settingsState).toBeDefined()
            
            // Verify error states are properly set
            expect(authState.error || settingsState.error).toBeDefined()
          },
          
          cleanup: async () => {
            // Restore mocks
            vi.restoreAllMocks()
          }
        })
      }
    })
  })
})

// ===========================================
// HELPER FUNCTIONS FOR INTEGRATION TESTS
// ===========================================

export function createMockRealtimeClient() {
  const subscribers = new Map()
  
  return {
    subscribe: vi.fn((channel: string, callback: (data: unknown) => void) => {
      if (!subscribers.has(channel)) {
        subscribers.set(channel, [])
      }
      subscribers.get(channel).push(callback)
      return { unsubscribe: vi.fn() }
    }),
    
    broadcast: vi.fn((channel: string, data: unknown) => {
      const channelSubscribers = subscribers.get(channel) || []
      channelSubscribers.forEach((callback: (data: unknown) => void) => callback(data))
    }),
    
    getChannels: vi.fn(() => Array.from(subscribers.keys()))
  }
}

export function simulateNetworkConditions(condition: 'offline' | 'slow' | 'fast') {
  const conditions = {
    offline: { onLine: false, effectiveType: 'none' },
    slow: { onLine: true, effectiveType: '2g' },
    fast: { onLine: true, effectiveType: '4g' }
  }

  const mockConnection = conditions[condition]
  
  Object.defineProperty(navigator, 'onLine', {
    writable: true,
    value: mockConnection.onLine
  })

  Object.defineProperty(navigator, 'connection', {
    writable: true,
    value: { effectiveType: mockConnection.effectiveType }
  })
}

export function createLoadTestScenario(operations: number = 1000) {
  return {
    name: `load-test-${operations}-operations`,
    execute: async (stores: Array<ReturnType<typeof createStoreTestWrapper>>) => {
      const startTime = performance.now()
      const operations_promises = []

      for (let i = 0; i < operations; i++) {
        const storeIndex = i % stores.length
        const store = stores[storeIndex]
        
        operations_promises.push(
          new Promise(resolve => {
            act(() => {
              store.setState({ lastUpdate: Date.now() })
            })
            resolve(undefined)
          })
        )
      }

      await Promise.all(operations_promises)
      const endTime = performance.now()
      
      return {
        duration: endTime - startTime,
        operationsPerSecond: operations / ((endTime - startTime) / 1000),
        averageOperationTime: (endTime - startTime) / operations
      }
    }
  }
}