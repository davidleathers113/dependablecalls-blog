/**
 * Test Setup Configuration for DCE Store Testing Infrastructure
 * 
 * Global test setup including:
 * - Mock configurations for external services
 * - Custom matchers and assertions
 * - Global test utilities and helpers
 * - Performance monitoring setup
 * - Test environment initialization
 */

import { beforeAll, beforeEach, afterEach, afterAll, expect, vi } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom'
import React from 'react'

// Import custom matchers
import { CUSTOM_MATCHERS } from './vitest.config'

// Type definitions for test setup
interface MockPerformance extends Performance {
  memory?: {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}

interface ZustandStore<T = unknown> {
  getState: () => T
  setState: (partial: Partial<T>) => void
  subscribe: (listener: (state: T) => void) => () => void
}

interface ModalState {
  type: null | 'create' | 'edit' | 'delete' | 'bulk_delete' | 'bulk_edit' | 'preview'
  id?: string | number
}

interface ReactRouterProps {
  children: React.ReactNode
}

// ===========================================
// GLOBAL TEST SETUP
// ===========================================

beforeAll(async () => {
  console.log('🧪 Setting up DCE Store Testing Environment...')

  // Configure test environment
  setupTestEnvironment()
  
  // Setup custom matchers
  setupCustomMatchers()
  
  // Mock external services
  setupMockServices()
  
  // Configure performance monitoring for tests
  setupPerformanceMonitoring()
  
  console.log('✅ Test environment setup complete')
})

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks()
  vi.restoreAllMocks()
  
  // Reset DOM cleanup
  cleanup()
  
  // Reset performance counters
  if (performance.mark) {
    performance.clearMarks()
    performance.clearMeasures()
  }
})

afterEach(() => {
  // Cleanup after each test
  cleanup()
  
  // Clear any remaining timers
  vi.clearAllTimers()
  
  // Reset fake timers if used
  vi.useRealTimers()
})

afterAll(() => {
  console.log('🧹 Cleaning up test environment...')
  
  // Final cleanup
  cleanup()
  
  // Clear performance monitoring
  cleanupPerformanceMonitoring()
  
  console.log('✅ Test environment cleanup complete')
})

// ===========================================
// TEST ENVIRONMENT CONFIGURATION
// ===========================================

function setupTestEnvironment(): void {
  // Configure global test variables
  global.__TEST_ENV__ = true
  global.__STORE_TESTING__ = true
  
  // Mock browser APIs not available in Node.js
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(), // deprecated
      removeListener: vi.fn(), // deprecated
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })

  // Mock IntersectionObserver
  global.IntersectionObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock ResizeObserver
  global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
  }))

  // Mock localStorage
  const localStorageMock = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    length: 0,
    key: vi.fn(),
  }
  Object.defineProperty(window, 'localStorage', {
    value: localStorageMock
  })

  // Mock sessionStorage
  Object.defineProperty(window, 'sessionStorage', {
    value: { ...localStorageMock }
  })

  // Mock performance API
  if (!global.performance) {
    global.performance = {
      now: vi.fn(() => Date.now()),
      mark: vi.fn(),
      measure: vi.fn(),
      clearMarks: vi.fn(),
      clearMeasures: vi.fn(),
      getEntriesByName: vi.fn(() => []),
      getEntriesByType: vi.fn(() => []),
      memory: {
        usedJSHeapSize: 1000000,
        totalJSHeapSize: 2000000,
        jsHeapSizeLimit: 4000000
      }
    } as MockPerformance
  }

  // Mock URL API for Node.js compatibility
  if (typeof URL === 'undefined') {
    global.URL = class MockURL {
      public href: string
      constructor(href: string) {
        this.href = href
      }
      toString() { return this.href }
    } as typeof URL
  }
}

// ===========================================
// CUSTOM MATCHERS SETUP
// ===========================================

function setupCustomMatchers(): void {
  // Extend expect with custom matchers
  expect.extend({
    ...CUSTOM_MATCHERS,
    
    // Additional store-specific matchers
    toHaveStoreAction: (store: ZustandStore, actionName: string) => {
      const state = store.getState()
      const hasAction = typeof (state as Record<string, unknown>)[actionName] === 'function'
      
      return {
        pass: hasAction,
        message: () => hasAction 
          ? `Store has action ${actionName}`
          : `Store missing action ${actionName}`
      }
    },

    toHaveStateProperty: (store: ZustandStore, propertyName: string, expectedValue?: unknown) => {
      const state = store.getState() as Record<string, unknown>
      const hasProperty = propertyName in state
      const valueMatches = expectedValue === undefined || state[propertyName] === expectedValue
      
      return {
        pass: hasProperty && valueMatches,
        message: () => {
          if (!hasProperty) return `Store missing property ${propertyName}`
          if (!valueMatches) return `Store property ${propertyName} has value ${state[propertyName]}, expected ${expectedValue}`
          return `Store has property ${propertyName} with correct value`
        }
      }
    },

    toHaveValidModal: (modalState: ModalState) => {
      const validTypes = [null, 'create', 'edit', 'delete', 'bulk_delete', 'bulk_edit', 'preview']
      const isValidType = validTypes.includes(modalState.type)
      const hasRequiredFields = modalState.type === null || 
        (modalState.type && (modalState.type === 'create' || modalState.id))
      
      return {
        pass: isValidType && hasRequiredFields,
        message: () => {
          if (!isValidType) return `Invalid modal type: ${modalState.type}`
          if (!hasRequiredFields) return `Modal missing required fields for type ${modalState.type}`
          return 'Modal state is valid'
        }
      }
    }
  })
}

// ===========================================
// MOCK SERVICES SETUP
// ===========================================

function setupMockServices(): void {
  // Mock Supabase client
  vi.mock('@supabase/supabase-js', () => ({
    createClient: vi.fn(() => ({
      auth: {
        signIn: vi.fn().mockResolvedValue({ user: null, error: null }),
        signOut: vi.fn().mockResolvedValue({ error: null }),
        signUp: vi.fn().mockResolvedValue({ user: null, error: null }),
        getUser: vi.fn().mockResolvedValue({ user: null, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } }
        })
      },
      from: vi.fn(() => ({
        select: vi.fn().mockReturnThis(),
        insert: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null })
      })),
      realtime: {
        channel: vi.fn(() => ({
          on: vi.fn().mockReturnThis(),
          subscribe: vi.fn(),
          unsubscribe: vi.fn()
        }))
      }
    }))
  }))

  // Mock Stripe
  vi.mock('@stripe/stripe-js', () => ({
    loadStripe: vi.fn().mockResolvedValue({
      elements: vi.fn(() => ({
        create: vi.fn(),
        getElement: vi.fn()
      })),
      confirmPayment: vi.fn().mockResolvedValue({ error: null }),
      createPaymentMethod: vi.fn().mockResolvedValue({ 
        paymentMethod: { id: 'pm_test' }, 
        error: null 
      })
    })
  }))

  // Mock Analytics
  vi.mock('../../../lib/analytics', () => ({
    analytics: {
      track: vi.fn(),
      identify: vi.fn(),
      page: vi.fn(),
      reset: vi.fn()
    }
  }))

  // Mock React Router
  vi.mock('react-router-dom', () => ({
    useNavigate: () => vi.fn(),
    useLocation: () => ({ pathname: '/test', search: '', hash: '', state: null }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), vi.fn()],
    BrowserRouter: ({ children }: ReactRouterProps) => children,
    Routes: ({ children }: ReactRouterProps) => children,
    Route: ({ children }: ReactRouterProps) => children,
    Link: vi.fn(({ children }: { children: React.ReactNode }) => children)
  }))
}

// ===========================================
// PERFORMANCE MONITORING SETUP
// ===========================================

interface PerformanceMetrics {
  testStartTime: number
  memoryUsage: number
  renderTime?: number
}

let performanceMetrics: PerformanceMetrics | null = null

function setupPerformanceMonitoring(): void {
  performanceMetrics = {
    testStartTime: performance.now(),
    memoryUsage: (performance as MockPerformance).memory?.usedJSHeapSize || 0
  }
  
  // Setup performance observers if available
  if (typeof PerformanceObserver !== 'undefined') {
    const observer = new PerformanceObserver((list) => {
      const entries = list.getEntries()
      entries.forEach((entry) => {
        if (entry.entryType === 'measure' && entry.name.includes('test')) {
          console.log(`📊 Performance: ${entry.name} took ${entry.duration}ms`)
        }
      })
    })
    
    try {
      observer.observe({ entryTypes: ['measure'] })
    } catch {
      // Performance observer not supported in test environment
    }
  }
}

function cleanupPerformanceMonitoring(): void {
  if (performanceMetrics) {
    const testDuration = performance.now() - performanceMetrics.testStartTime
    const finalMemory = (performance as MockPerformance).memory?.usedJSHeapSize || 0
    const memoryDelta = finalMemory - performanceMetrics.memoryUsage
    
    console.log(`🔍 Test Suite Performance:`)
    console.log(`  Duration: ${testDuration.toFixed(2)}ms`)
    console.log(`  Memory Delta: ${(memoryDelta / 1024 / 1024).toFixed(2)}MB`)
    
    performanceMetrics = null
  }
}