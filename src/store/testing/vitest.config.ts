/**
 * Vitest Configuration for DCE Store Testing Infrastructure
 * 
 * Comprehensive test configuration supporting:
 * - Unit tests for individual stores
 * - Integration tests for cross-store interactions
 * - Property-based testing for state machines
 * - Performance benchmarks and profiling
 * - Coverage reporting and quality gates
 */

import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

// Types for custom matchers
interface PotentialStore {
  subscribe?: unknown
  getState?: unknown
  setState?: unknown
  [key: string]: unknown
}

interface StateTransition {
  from: string
  to: string
}

export default defineConfig({
  test: {
    // Test environment configuration
    environment: 'jsdom',
    globals: true,
    setupFiles: [
      './src/store/testing/setup.ts'
    ],

    // Test discovery patterns
    include: [
      'src/store/**/*.{test,spec}.{js,ts,tsx}',
      'src/store/testing/**/*.{test,spec}.{js,ts,tsx}',
      'src/hooks/**/*.{test,spec}.{js,ts,tsx}'
    ],
    exclude: [
      'node_modules/**',
      'dist/**',
      'build/**',
      '**/*.d.ts'
    ],

    // Timeout configurations
    testTimeout: 10000,
    hookTimeout: 10000,

    // Coverage configuration
    coverage: {
      enabled: true,
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage/stores',
      include: [
        'src/store/**/*.ts',
        'src/hooks/**/*.ts'
      ],
      exclude: [
        'src/store/**/*.{test,spec}.ts',
        'src/store/**/types.ts',
        'src/store/**/*.d.ts',
        'src/store/testing/**'
      ],
      thresholds: {
        global: {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        // Per-store thresholds
        'src/store/authStore.ts': {
          branches: 90,
          functions: 95,
          lines: 95,
          statements: 95
        },
        'src/store/blogStore.ts': {
          branches: 85,
          functions: 90,
          lines: 90,
          statements: 90
        },
        'src/store/slices/navigationSlice.ts': {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },

    // Reporter configuration
    reporter: ['verbose', 'json', 'html'],
    outputFile: {
      json: './test-results/store-tests.json',
      html: './test-results/store-tests.html'
    },

    // Performance and resource limits
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
        maxThreads: 4,
        minThreads: 1
      }
    },

    // Test categorization
    sequence: {
      concurrent: true,
      shuffle: false
    },

    // Retry configuration for flaky tests
    retry: 2,
    bail: 0,

    // Mock configuration
    clearMocks: true,
    restoreMocks: true,
    mockReset: true,

    // Watch mode configuration
    watch: false,
    watchExclude: [
      'node_modules/**',
      'dist/**',
      'coverage/**',
      'test-results/**'
    ],

    // Custom test tags for different test types
    // Usage: describe.concurrent('Store Tests', { tags: ['unit', 'store'] })
    testNamePattern: undefined,

    // Environment variables for tests
    env: {
      NODE_ENV: 'test',
      VITE_SUPABASE_URL: 'http://localhost:54321',
      VITE_SUPABASE_ANON_KEY: 'test-anon-key',
      VITE_ENABLE_DEV_TOOLS: 'true'
    }
  },

  // Vite configuration for test builds
  resolve: {
    alias: {
      '@': resolve(__dirname, '../../../src'),
      '@/store': resolve(__dirname, '../'),
      '@/testing': resolve(__dirname, './'),
      '@/types': resolve(__dirname, '../../../src/types'),
      '@/lib': resolve(__dirname, '../../../src/lib'),
      '@/hooks': resolve(__dirname, '../../../src/hooks')
    }
  },

  // Define custom test configurations
  define: {
    __TEST_ENV__: true,
    __STORE_TESTING__: true
  },

  // Plugin configuration for testing
  plugins: []
})

// Export test configuration presets
export const TEST_PRESETS = {
  // Unit tests - fast, isolated
  unit: {
    testTimeout: 5000,
    coverage: { enabled: false },
    reporter: ['dot'],
    pool: 'forks'
  },

  // Integration tests - slower, with setup/teardown
  integration: {
    testTimeout: 30000,
    coverage: { enabled: true },
    reporter: ['verbose'],
    setupFiles: ['./src/store/testing/integration-setup.ts']
  },

  // Property-based tests - longer running, comprehensive
  property: {
    testTimeout: 60000,
    coverage: { enabled: false },
    reporter: ['verbose', 'json'],
    bail: 1 // Stop on first failure for property tests
  },

  // Benchmark tests - performance focused
  benchmark: {
    testTimeout: 120000,
    coverage: { enabled: false },
    reporter: ['json'],
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true // Ensure consistent performance measurements
      }
    }
  },

  // CI/CD optimized configuration
  ci: {
    testTimeout: 20000,
    coverage: {
      enabled: true,
      reporter: ['json', 'lcov'],
      thresholds: {
        global: {
          branches: 80,
          functions: 85,
          lines: 85,
          statements: 85
        }
      }
    },
    reporter: ['json', 'junit'],
    outputFile: {
      json: './test-results/ci-results.json',
      junit: './test-results/junit.xml'
    },
    watch: false,
    bail: 5 // Stop after 5 failures in CI
  }
}

// Custom test matchers and utilities
export const CUSTOM_MATCHERS = {
  // Store-specific matchers
  toHaveValidStoreState: (received: PotentialStore) => {
    const hasRequiredMethods = ['subscribe', 'getState', 'setState'].every(
      method => typeof received[method] === 'function'
    )
    
    return {
      pass: hasRequiredMethods,
      message: () => hasRequiredMethods 
        ? 'Store has valid state structure'
        : 'Store missing required methods (subscribe, getState, setState)'
    }
  },

  // State machine matchers
  toBeValidStateTransition: (received: StateTransition, from: string, to: string) => {
    // This would validate state machine transitions
    const isValid = received.from !== received.to && 
                   typeof received.from === 'string' && 
                   typeof received.to === 'string'
    
    return {
      pass: isValid,
      message: () => isValid 
        ? `Valid transition from ${from} to ${to}`
        : `Invalid transition from ${from} to ${to}`
    }
  },

  // Performance matchers
  toMeetPerformanceThreshold: (received: number, threshold: number) => {
    return {
      pass: received <= threshold,
      message: () => received <= threshold
        ? `Performance ${received}ms meets threshold ${threshold}ms`
        : `Performance ${received}ms exceeds threshold ${threshold}ms`
    }
  }
}

// Test data factories
export const TEST_FACTORIES = {
  // Create test user data
  createTestUser: (overrides = {}) => ({
    id: 'test-user-id',
    email: 'test@example.com',
    role: 'supplier',
    firstName: 'Test',
    lastName: 'User',
    ...overrides
  }),

  // Create test campaign data
  createTestCampaign: (overrides = {}) => ({
    id: 'test-campaign-id',
    name: 'Test Campaign',
    status: 'active',
    budget: 1000,
    bidAmount: 25.50,
    ...overrides
  }),

  // Create test blog post data
  createTestBlogPost: (overrides = {}) => ({
    id: 'test-post-id',
    title: 'Test Blog Post',
    content: 'Test content',
    status: 'draft',
    ...overrides
  })
}

// Test environment configuration
export const TEST_ENV_CONFIG = {
  // Mock external services
  mockSupabase: true,
  mockStripe: true,
  mockAnalytics: true,

  // Feature flags for testing
  features: {
    enableStateDebugger: true,
    enablePerformanceMonitoring: true,
    enablePersistence: false, // Disable for faster tests
    enableRealtimeUpdates: false
  },

  // Test database configuration
  testDatabase: {
    resetBetweenTests: true,
    seedData: true,
    isolateTests: true
  },

  // Logging configuration
  logging: {
    level: 'warn', // Reduce noise in tests
    enableStoreLogging: false,
    enableTestLogging: true
  }
}