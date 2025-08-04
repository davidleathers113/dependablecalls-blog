/**
 * Store Testing Utilities for DCE Zustand Architecture
 * 
 * Comprehensive testing utilities for all DCE stores including:
 * - Store setup and teardown helpers
 * - Mock data generators and factories
 * - State assertion utilities
 * - Integration test helpers
 * - Performance measurement tools
 */

import React from 'react'
import { act } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import { vi, expect } from 'vitest'
import type { StoreApi, UseBoundStore } from 'zustand'

// Import all store types for comprehensive testing
import type { AuthState } from '../authStore'
import type { BlogEditorState } from '../blogStore'

// Import monitoring and debugging types
import type { 
  PerformanceMetrics, 
  StateSnapshot
} from '../monitoring/types'

// ===========================================
// CORE TESTING UTILITIES
// ===========================================

export interface StoreTestConfig {
  storeName: string
  persistKey?: string
  resetBetweenTests?: boolean
  enableMockPersistence?: boolean
  trackPerformance?: boolean
  trackStateChanges?: boolean
}

export interface MockStoreState {
  [key: string]: unknown
}

export interface TestAssertions<T = unknown> {
  toBeDefined(): void
  toEqual(expected: T): void
  toHaveProperty(property: string, value?: unknown): void
  toBeCalledWith(...args: unknown[]): void
  toHaveBeenCalled(): void
}

export interface PerformanceSnapshot {
  storeName: string
  operation: string
  duration: number
  memoryUsage: number
  timestamp: number
  stateSize: number
}

// ===========================================
// STORE SETUP AND TEARDOWN
// ===========================================

/**
 * Creates a test wrapper for any Zustand store with comprehensive setup
 */
export function createStoreTestWrapper<T extends Record<string, unknown>>(
  storeHook: UseBoundStore<StoreApi<T>>,
  config: StoreTestConfig
) {
  const originalState = storeHook.getState()
  const stateHistory: StateSnapshot[] = []
  const performanceSnapshots: PerformanceSnapshot[] = []
  
  // Mock persistence layer if enabled
  const mockPersistence = config.enableMockPersistence ? {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn()
  } : null

  // Performance tracking wrapper
  const trackPerformance = <R>(operation: string, fn: () => R): R => {
    if (!config.trackPerformance) return fn()
    
    const startTime = performance.now()
    const startMemory = performance.memory?.usedJSHeapSize || 0
    const result = fn()
    const endTime = performance.now()
    const endMemory = performance.memory?.usedJSHeapSize || 0
    
    performanceSnapshots.push({
      storeName: config.storeName,
      operation,
      duration: endTime - startTime,
      memoryUsage: endMemory - startMemory,
      timestamp: Date.now(),
      stateSize: JSON.stringify(storeHook.getState()).length
    })
    
    return result
  }

  // State change tracking
  const unsubscribe = config.trackStateChanges ? storeHook.subscribe(
    (state, prevState) => {
      stateHistory.push({
        id: `${config.storeName}-${Date.now()}`,
        storeName: config.storeName,
        timestamp: Date.now(),
        state: JSON.parse(JSON.stringify(state)),
        prevState: JSON.parse(JSON.stringify(prevState)),
        diff: calculateStateDiff(prevState, state),
        metadata: {
          size: JSON.stringify(state).length,
          changeCount: stateHistory.length + 1
        }
      })
    }
  ) : () => {}

  return {
    // Store access
    store: storeHook,
    getState: () => storeHook.getState(),
    setState: (updater: Partial<T> | ((state: T) => Partial<T>)) => {
      return trackPerformance('setState', () => {
        act(() => {
          if (typeof updater === 'function') {
            const currentState = storeHook.getState()
            const updates = updater(currentState)
            storeHook.setState(updates as Partial<T>)
          } else {
            storeHook.setState(updater)
          }
        })
      })
    },

    // Mock utilities
    mockPersistence,
    mockAction: (actionName: string) => vi.fn().mockName(`${config.storeName}.${actionName}`),
    
    // Reset utilities
    reset: () => {
      act(() => {
        storeHook.setState(originalState)
      })
      stateHistory.length = 0
      performanceSnapshots.length = 0
    },
    
    // History and analytics
    getStateHistory: () => [...stateHistory],
    getPerformanceSnapshots: () => [...performanceSnapshots],
    getPerformanceSummary: () => {
      if (performanceSnapshots.length === 0) return null
      
      const durations = performanceSnapshots.map(s => s.duration)
      const memoryUsages = performanceSnapshots.map(s => s.memoryUsage)
      
      return {
        totalOperations: performanceSnapshots.length,
        avgDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
        maxDuration: Math.max(...durations),
        minDuration: Math.min(...durations),
        totalMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0),
        avgMemoryUsage: memoryUsages.reduce((a, b) => a + b, 0) / memoryUsages.length
      }
    },
    
    // Cleanup
    cleanup: () => {
      unsubscribe()
      if (config.resetBetweenTests) {
        act(() => {
          storeHook.setState(originalState)
        })
      }
    }
  }
}

// ===========================================
// MOCK DATA GENERATORS
// ===========================================

export const mockDataGenerators = {
  // Auth store mocks
  authState: (): Partial<AuthState> => ({
    user: {
      id: '12345',
      email: 'test@example.com',
      role: 'supplier',
      firstName: 'Test',
      lastName: 'User',
      avatar: 'https://example.com/avatar.jpg',
      preferences: {
        theme: 'light',
        timezone: 'America/New_York',
        language: 'en'
      }
    },
    isAuthenticated: true,
    isLoading: false,
    session: {
      accessToken: 'mock-access-token',
      refreshToken: 'mock-refresh-token',
      expiresAt: Date.now() + 3600000
    }
  }),

  // Blog store mocks
  blogPost: () => ({
    id: `post-${Math.random().toString(36).substr(2, 9)}`,
    title: 'Test Blog Post',
    content: 'This is test content for the blog post.',
    excerpt: 'Test excerpt',
    slug: 'test-blog-post',
    status: 'draft' as const,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    authorId: '12345',
    categoryId: 'cat-1',
    tags: ['test', 'demo'],
    featured: false,
    seoTitle: 'Test Blog Post',
    seoDescription: 'This is a test blog post for demonstration.',
    readingTime: 2
  }),

  blogEditorState: (): Partial<BlogEditorState> => ({
    draft: {
      title: 'Draft Post',
      content: 'Draft content...',
      excerpt: 'Draft excerpt',
      status: 'draft',
      tags: [],
      featured: false
    },
    isDraftSaved: false,
    lastSavedAt: new Date(),
    editorMode: 'markdown',
    previewMode: 'split',
    sidebarOpen: true,
    wordWrapEnabled: true,
    autosaveEnabled: true,
    autosaveInterval: 30
  }),

  // Campaign and buyer mocks
  campaign: () => ({
    id: `campaign-${Math.random().toString(36).substr(2, 9)}`,
    name: 'Test Campaign',
    description: 'Test campaign description',
    vertical: 'insurance',
    status: 'active' as const,
    budget: 1000,
    dailyBudget: 100,
    bidAmount: 25.50,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    buyerId: '12345',
    targeting: {
      states: ['NY', 'CA'],
      zipCodes: [],
      demographics: {
        ageMin: 25,
        ageMax: 65,
        income: 'middle'
      }
    },
    schedule: {
      timezone: 'America/New_York',
      hours: {
        monday: { start: '09:00', end: '17:00' },
        tuesday: { start: '09:00', end: '17:00' },
        wednesday: { start: '09:00', end: '17:00' },
        thursday: { start: '09:00', end: '17:00' },
        friday: { start: '09:00', end: '17:00' }
      }
    }
  }),

  // Performance metrics mock
  performanceMetrics: (): PerformanceMetrics => ({
    timestamp: Date.now(),
    storeUpdates: Math.floor(Math.random() * 100),
    selectorCalls: Math.floor(Math.random() * 500),
    renderCount: Math.floor(Math.random() * 50),
    memoryUsage: Math.floor(Math.random() * 1000000),
    updateDuration: Math.random() * 10,
    stateSize: Math.floor(Math.random() * 10000),
    subscriptionCount: Math.floor(Math.random() * 20)
  })
}

// ===========================================
// STATE ASSERTION UTILITIES
// ===========================================

export function createStateAssertions<T extends Record<string, unknown>>(
  testWrapper: ReturnType<typeof createStoreTestWrapper<T>>
) {
  return {
    // Basic state assertions
    expectState: (expectedState: Partial<T>) => {
      const currentState = testWrapper.getState()
      Object.keys(expectedState).forEach(key => {
        expect(currentState[key]).toEqual(expectedState[key])
      })
    },

    expectStateProperty: (property: keyof T, value: unknown) => {
      const currentState = testWrapper.getState()
      expect(currentState[property]).toEqual(value)
    },

    expectStateToHaveProperty: (property: keyof T) => {
      const currentState = testWrapper.getState()
      expect(currentState).toHaveProperty(property as string)
    },

    // State change assertions
    expectStateChanged: (property?: keyof T) => {
      const history = testWrapper.getStateHistory()
      expect(history.length).toBeGreaterThan(0)
      
      if (property) {
        const lastChange = history[history.length - 1]
        expect(lastChange.state[property as string]).not.toEqual(
          lastChange.prevState[property as string]
        )
      }
    },

    expectNoStateChanges: () => {
      const history = testWrapper.getStateHistory()
      expect(history.length).toBe(0)
    },

    // Performance assertions
    expectPerformanceWithin: (operation: string, maxDuration: number) => {
      const snapshots = testWrapper.getPerformanceSnapshots()
      const operationSnapshots = snapshots.filter(s => s.operation === operation)
      
      expect(operationSnapshots.length).toBeGreaterThan(0)
      operationSnapshots.forEach(snapshot => {
        expect(snapshot.duration).toBeLessThanOrEqual(maxDuration)
      })
    },

    expectMemoryUsageBelow: (maxMemoryMB: number) => {
      const summary = testWrapper.getPerformanceSummary()
      if (summary) {
        const maxMemoryBytes = maxMemoryMB * 1024 * 1024
        expect(summary.totalMemoryUsage).toBeLessThanOrEqual(maxMemoryBytes)
      }
    }
  }
}

// ===========================================
// INTEGRATION TEST HELPERS
// ===========================================

export interface CrossStoreTestScenario<T1, T2> {
  name: string
  store1: ReturnType<typeof createStoreTestWrapper<T1>>
  store2: ReturnType<typeof createStoreTestWrapper<T2>>
  setup: () => void | Promise<void>
  execute: () => void | Promise<void>
  verify: () => void | Promise<void>
  cleanup?: () => void | Promise<void>
}

export async function runCrossStoreTest<T1, T2>(
  scenario: CrossStoreTestScenario<T1, T2>
) {
  try {
    // Setup phase
    await scenario.setup()
    
    // Execute the test scenario
    await scenario.execute()
    
    // Verify results
    await scenario.verify()
    
  } finally {
    // Cleanup
    if (scenario.cleanup) {
      await scenario.cleanup()
    }
    scenario.store1.cleanup()
    scenario.store2.cleanup()
  }
}

// ===========================================
// UTILITY FUNCTIONS
// ===========================================

function calculateStateDiff(prevState: unknown, currentState: unknown): Record<string, unknown> {
  if (typeof prevState !== 'object' || typeof currentState !== 'object') {
    return { changed: prevState !== currentState }
  }

  const diff: Record<string, unknown> = {}
  const prev = prevState as Record<string, unknown>
  const current = currentState as Record<string, unknown>

  // Find changed properties
  Object.keys(current).forEach(key => {
    if (prev[key] !== current[key]) {
      diff[key] = {
        from: prev[key],
        to: current[key]
      }
    }
  })

  // Find removed properties
  Object.keys(prev).forEach(key => {
    if (!(key in current)) {
      diff[key] = {
        from: prev[key],
        to: undefined
      }
    }
  })

  return diff
}

/**
 * Creates a test suite runner for comprehensive store testing
 */
export function createStoreTestSuite<T extends Record<string, unknown>>(
  storeName: string,
  storeHook: UseBoundStore<StoreApi<T>>,
  testConfig?: Partial<StoreTestConfig>
) {
  const config: StoreTestConfig = {
    storeName,
    resetBetweenTests: true,
    enableMockPersistence: true,
    trackPerformance: true,
    trackStateChanges: true,
    ...testConfig
  }

  return {
    createWrapper: () => createStoreTestWrapper(storeHook, config),
    createAssertions: (wrapper: ReturnType<typeof createStoreTestWrapper<T>>) => 
      createStateAssertions(wrapper),
    mockDataGenerators,
    runIntegrationTest: runCrossStoreTest
  }
}

// ===========================================
// HOOK TESTING UTILITIES
// ===========================================

export function testStoreHook<T extends Record<string, unknown>>(
  hookFactory: () => T,
  testName: string = 'store hook'
) {
  return renderHook<T, unknown>(() => hookFactory(), {
    wrapper: ({ children }) => React.createElement('div', { 'data-testid': `${testName}-wrapper` }, children)
  })
}

// ===========================================
// EXPORTS
// ===========================================

export type {
  StoreTestConfig,
  MockStoreState,
  TestAssertions,
  PerformanceSnapshot,
  CrossStoreTestScenario
}