/**
 * Phase 4 Performance Optimization: Integration Examples
 * 
 * This file demonstrates how to integrate all Phase 4 performance optimizations
 * into existing Zustand stores.
 */

import { create } from 'zustand'
import { devtools, persist, subscribeWithSelector } from 'zustand/middleware'
import { immer, withPerformanceMonitoring, batchUpdates, createMemoizedUpdater } from '../middleware/immer'
import { resourceCleanup, createIntervalResource } from '../utils/resourceCleanup'
import { usePerformanceBenchmark, type BenchmarkDefinition } from '../performance/benchmarks'

// Example: Optimized Store with All Phase 4 Features
interface OptimizedExampleState {
  // Data
  items: Array<{ id: string; name: string; value: number }>
  selectedItems: Set<string>
  filters: {
    search: string
    category: string
    priceRange: [number, number]
  }
  
  // UI State
  isLoading: boolean
  error: string | null
  
  // Actions
  addItem: (item: { name: string; value: number }) => void
  removeItem: (id: string) => void
  updateItem: (id: string, updates: Partial<{ name: string; value: number }>) => void
  batchUpdateItems: (updates: Array<{ id: string; updates: Partial<{ name: string; value: number }> }>) => void
  
  selectItem: (id: string) => void
  deselectItem: (id: string) => void
  clearSelection: () => void
  
  setFilters: (filters: Partial<OptimizedExampleState['filters']>) => void
  resetFilters: () => void
  
  // Resource management
  startPolling: (interval: number) => void
  stopPolling: () => void
  
  // Performance utilities
  benchmarkOperations: () => Promise<void>
}

const defaultFilters = {
  search: '',
  category: '',
  priceRange: [0, 1000] as [number, number],
}

export const useOptimizedExampleStore = create<OptimizedExampleState>()(
  // Dev tools with performance monitoring
  devtools(
    // Resource cleanup for proper memory management
    resourceCleanup({
      enableAutoCleanup: true,
      maxAge: 10 * 60 * 1000, // 10 minutes
      maxResources: 20,
      cleanupInterval: 60 * 1000, // 1 minute
    })(
      // Persistence with selective storage
      persist(
        // Subscribe with selector for granular updates
        subscribeWithSelector(
          // Immer for immutable updates with performance monitoring
          immer(
            withPerformanceMonitoring('optimized-example', {
              enableLogging: process.env.NODE_ENV === 'development',
              warnThreshold: 16, // 16ms threshold
            })(
              (set, get, store) => ({
                // Initial state
                items: [],
                selectedItems: new Set(),
                filters: { ...defaultFilters },
                isLoading: false,
                error: null,

                // Optimized actions using immer
                addItem: (item) => {
                  set((draft) => {
                    const newItem = {
                      id: `item-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                      ...item,
                    }
                    draft.items.push(newItem)
                    draft.error = null
                  })
                },

                removeItem: (id) => {
                  set((draft) => {
                    draft.items = draft.items.filter(item => item.id !== id)
                    draft.selectedItems.delete(id)
                  })
                },

                updateItem: createMemoizedUpdater(
                  (id: string, updates: Partial<{ name: string; value: number }>) => 
                    (draft: OptimizedExampleState) => {
                      const item = draft.items.find(item => item.id === id)
                      if (item) {
                        Object.assign(item, updates)
                      }
                    }
                ),

                // Batch updates for better performance
                batchUpdateItems: (updates) => {
                  set(batchUpdates(
                    updates.map(({ id, updates }) => 
                      (draft: OptimizedExampleState) => {
                        const item = draft.items.find(item => item.id === id)
                        if (item) {
                          Object.assign(item, updates)
                        }
                      }
                    )
                  ))
                },

                selectItem: (id) => {
                  set((draft) => {
                    draft.selectedItems.add(id)
                  })
                },

                deselectItem: (id) => {
                  set((draft) => {
                    draft.selectedItems.delete(id)
                  })
                },

                clearSelection: () => {
                  set((draft) => {
                    draft.selectedItems.clear()
                  })
                },

                setFilters: (newFilters) => {
                  set((draft) => {
                    Object.assign(draft.filters, newFilters)
                  })
                },

                resetFilters: () => {
                  set((draft) => {
                    draft.filters = { ...defaultFilters }
                  })
                },

                // Resource management examples
                startPolling: (interval) => {
                  if ('addResource' in store && 'cleanupByType' in store) {
                    // Clean up existing polling
                    (store as unknown as { cleanupByType: (type: string) => void }).cleanupByType('interval')

                    // Create new polling resource
                    const pollingResource = createIntervalResource(
                      'data-polling',
                      async () => {
                        set((draft) => {
                          draft.isLoading = true
                        })

                        try {
                          // Simulate API call
                          await new Promise(resolve => setTimeout(resolve, 500))
                          
                          set((draft) => {
                            draft.isLoading = false
                            draft.error = null
                          })
                        } catch (error) {
                          set((draft) => {
                            draft.isLoading = false
                            draft.error = error instanceof Error ? error.message : 'Polling failed'
                          })
                        }
                      },
                      interval,
                      { purpose: 'data polling', interval }
                    );
                    
                    (store as unknown as { addResource: (resource: unknown) => void }).addResource(pollingResource)
                  }
                },

                stopPolling: () => {
                  if ('cleanupByType' in store) {
                    (store as unknown as { cleanupByType: (type: string) => void }).cleanupByType('interval')
                  }
                },

                // Performance benchmarking
                benchmarkOperations: async () => {
                  const benchmark = usePerformanceBenchmark.getState()
                  
                  const benchmarkSuite: BenchmarkDefinition[] = [
                    {
                      name: 'Add 100 Items',
                      execute: () => {
                        const state = get()
                        for (let i = 0; i < 100; i++) {
                          state.addItem({ name: `Item ${i}`, value: Math.random() * 1000 })
                        }
                      },
                      config: { iterations: 5, warmupRuns: 2 }
                    },
                    {
                      name: 'Batch Update Items',
                      setup: () => {
                        // Add items for testing
                        const state = get()
                        for (let i = 0; i < 50; i++) {
                          state.addItem({ name: `Test Item ${i}`, value: i * 10 })
                        }
                      },
                      execute: () => {
                        const state = get()
                        const updates = state.items.slice(0, 10).map(item => ({
                          id: item.id,
                          updates: { value: item.value * 2 }
                        }))
                        state.batchUpdateItems(updates)
                      },
                      teardown: () => {
                        get().resetFilters()
                        set({ items: [], selectedItems: new Set() })
                      }
                    },
                    {
                      name: 'Filter Operations',
                      execute: () => {
                        const state = get()
                        state.setFilters({ search: 'test', priceRange: [100, 500] })
                        state.resetFilters()
                      }
                    }
                  ]

                  await benchmark.runBenchmarkSuite(benchmarkSuite)
                },
              })
            )
          )
        ),
        {
          name: 'optimized-example-storage',
          // Only persist essential data
          partialize: (state) => ({
            items: state.items,
            filters: state.filters,
          }),
          // Use enhanced serialization
          serialize: (state) => {
            return JSON.stringify({
              state: {
                ...state.state,
                selectedItems: Array.from(state.state.selectedItems || []),
              },
              version: state.version,
            })
          },
          deserialize: (str) => {
            const data = JSON.parse(str)
            return {
              ...data,
              state: {
                ...data.state,
                selectedItems: new Set(data.state.selectedItems || []),
              },
            }
          },
        }
      )
    ),
    {
      name: 'optimized-example',
      enabled: process.env.NODE_ENV === 'development',
    }
  )
)

// Selector examples with memoization
export const useOptimizedSelectors = () => {
  // Basic selectors
  const items = useOptimizedExampleStore(state => state.items)
  const selectedItems = useOptimizedExampleStore(state => state.selectedItems)
  const filters = useOptimizedExampleStore(state => state.filters)
  
  // Computed selectors (automatically memoized by Zustand)
  const filteredItems = useOptimizedExampleStore(state => {
    return state.items.filter(item => {
      const matchesSearch = !state.filters.search || 
        item.name.toLowerCase().includes(state.filters.search.toLowerCase())
      const matchesPrice = item.value >= state.filters.priceRange[0] && 
        item.value <= state.filters.priceRange[1]
      
      return matchesSearch && matchesPrice
    })
  })
  
  const selectedCount = useOptimizedExampleStore(state => state.selectedItems.size)
  
  const totalValue = useOptimizedExampleStore(state => {
    return Array.from(state.selectedItems)
      .map(id => state.items.find(item => item.id === id))
      .filter(Boolean)
      .reduce((sum, item) => sum + item!.value, 0)
  })
  
  return {
    items,
    selectedItems,
    filters,
    filteredItems,
    selectedCount,
    totalValue,
  }
}

// Hook for performance monitoring
export const useStorePerformance = () => {
  const benchmark = usePerformanceBenchmark()
  
  const runPerformanceTest = async () => {
    const store = useOptimizedExampleStore.getState()
    await store.benchmarkOperations()
    return benchmark.generateReport()
  }
  
  const getResourceStats = () => {
    const store = useOptimizedExampleStore.getState()
    if ('getResourceStats' in store) {
      return (store as unknown as { getResourceStats: () => unknown }).getResourceStats()
    }
    return null
  }
  
  return {
    runPerformanceTest,
    getResourceStats,
    isEnabled: benchmark.isEnabled,
    globalMetrics: benchmark.globalMetrics,
  }
}

// Example usage in a React component:
/*
import { useOptimizedExampleStore, useOptimizedSelectors, useStorePerformance } from './examples/phase4-integration'

function ExampleComponent() {
  const { addItem, selectItem, startPolling, stopPolling } = useOptimizedExampleStore()
  const { filteredItems, selectedCount, totalValue } = useOptimizedSelectors()
  const { runPerformanceTest, getResourceStats } = useStorePerformance()
  
  React.useEffect(() => {
    // Start polling on mount
    startPolling(5000)
    
    // Cleanup on unmount
    return () => {
      stopPolling()
    }
  }, [startPolling, stopPolling])
  
  const handleRunBenchmark = async () => {
    const report = await runPerformanceTest()
    console.log('Performance Report:', report)
  }
  
  return (
    <div>
      <p>Items: {filteredItems.length}</p>
      <p>Selected: {selectedCount}</p>
      <p>Total Value: ${totalValue}</p>
      
      <button onClick={() => addItem({ name: 'New Item', value: 100 })}>
        Add Item
      </button>
      
      <button onClick={handleRunBenchmark}>
        Run Performance Test
      </button>
      
      {filteredItems.map(item => (
        <div key={item.id} onClick={() => selectItem(item.id)}>
          {item.name} - ${item.value}
        </div>
      ))}
    </div>
  )
}
*/