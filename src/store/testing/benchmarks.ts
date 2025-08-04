/**
 * Performance Benchmarks for DCE Zustand Store Architecture
 * 
 * Comprehensive performance testing suite covering:
 * - Store operation benchmarks (CRUD, subscriptions, selectors)
 * - Memory usage profiling and leak detection
 * - Scalability testing under various loads
 * - Real-time update performance
 * - State persistence and hydration benchmarks
 * - Cross-store communication performance
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { act } from '@testing-library/react'
import { performance } from 'perf_hooks'
import { 
  createStoreTestWrapper, 
  mockDataGenerators 
} from './storeTestUtils'

// Import stores used in benchmarks
import { useAuthStore } from '../authStore'
import { useBlogUIStore, useBlogEditorStore } from '../blogStore'
import { useBuyerStore } from '../buyerStore'
import { useSettingsStore } from '../settingsStore'
import { useNavigationStore } from '../slices/navigationSlice'
import { usePerformanceMonitor } from '../monitoring/performanceMonitor'

// ===========================================
// BENCHMARK CONFIGURATION
// ===========================================

interface BenchmarkConfig {
  name: string
  iterations: number
  warmupIterations: number
  timeoutMs: number
  targetOpsPerSecond?: number
  maxMemoryMB?: number
  collectGCStats?: boolean
}

interface BenchmarkResult {
  name: string
  iterations: number
  totalTime: number
  averageTime: number
  minTime: number
  maxTime: number
  opsPerSecond: number
  memoryUsage: {
    initial: number
    final: number
    peak: number
    delta: number
  }
  gcStats?: {
    collections: number
    totalGCTime: number
  }
  passed: boolean
  errors: string[]
}

interface BenchmarkSuite {
  name: string
  results: BenchmarkResult[]
  summary: {
    totalBenchmarks: number
    passedBenchmarks: number
    failedBenchmarks: number
    averageOpsPerSecond: number
    totalMemoryDelta: number
  }
}

// ===========================================
// BENCHMARK RUNNER
// ===========================================

class BenchmarkRunner {
  private gcStats: { collections: number; totalGCTime: number } = { collections: 0, totalGCTime: 0 }

  async runBenchmark<T>(
    benchmarkFn: () => T | Promise<T>,
    config: BenchmarkConfig
  ): Promise<BenchmarkResult> {
    const result: BenchmarkResult = {
      name: config.name,
      iterations: config.iterations,
      totalTime: 0,
      averageTime: 0,
      minTime: Infinity,
      maxTime: 0,
      opsPerSecond: 0,
      memoryUsage: {
        initial: 0,
        final: 0,
        peak: 0,
        delta: 0
      },
      passed: false,
      errors: []
    }

    try {
      // Warmup phase
      for (let i = 0; i < config.warmupIterations; i++) {
        await benchmarkFn()
      }

      // Force garbage collection before measurement
      if (global.gc) {
        global.gc()
      }

      // Record initial memory
      result.memoryUsage.initial = this.getMemoryUsage()
      let peakMemory = result.memoryUsage.initial

      const times: number[] = []
      const startTime = performance.now()

      // Run benchmark iterations
      for (let i = 0; i < config.iterations; i++) {
        const iterationStart = performance.now()
        
        await benchmarkFn()
        
        const iterationEnd = performance.now()
        const iterationTime = iterationEnd - iterationStart
        
        times.push(iterationTime)
        result.minTime = Math.min(result.minTime, iterationTime)
        result.maxTime = Math.max(result.maxTime, iterationTime)

        // Track peak memory usage
        const currentMemory = this.getMemoryUsage()
        peakMemory = Math.max(peakMemory, currentMemory)

        // Check for timeout
        if (performance.now() - startTime > config.timeoutMs) {
          throw new Error(`Benchmark timed out after ${config.timeoutMs}ms`)
        }
      }

      const endTime = performance.now()
      result.totalTime = endTime - startTime
      result.averageTime = times.reduce((a, b) => a + b, 0) / times.length
      result.opsPerSecond = (config.iterations / result.totalTime) * 1000

      // Record final memory usage
      result.memoryUsage.final = this.getMemoryUsage()
      result.memoryUsage.peak = peakMemory
      result.memoryUsage.delta = result.memoryUsage.final - result.memoryUsage.initial

      // Collect GC stats if enabled
      if (config.collectGCStats) {
        result.gcStats = { ...this.gcStats }
      }

      // Validate against targets
      const validationErrors: string[] = []
      
      if (config.targetOpsPerSecond && result.opsPerSecond < config.targetOpsPerSecond) {
        validationErrors.push(
          `Operations per second ${result.opsPerSecond.toFixed(2)} below target ${config.targetOpsPerSecond}`
        )
      }

      if (config.maxMemoryMB) {
        const memoryMB = result.memoryUsage.delta / (1024 * 1024)
        if (memoryMB > config.maxMemoryMB) {
          validationErrors.push(
            `Memory usage ${memoryMB.toFixed(2)}MB exceeds limit ${config.maxMemoryMB}MB`
          )
        }
      }

      result.errors = validationErrors
      result.passed = validationErrors.length === 0

    } catch (error) {
      result.errors.push(error instanceof Error ? error.message : String(error))
      result.passed = false
    }

    return result
  }

  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && performance.memory) {
      return performance.memory.usedJSHeapSize
    }
    return 0
  }

  async runBenchmarkSuite(
    suiteName: string,
    benchmarks: Array<{ config: BenchmarkConfig; fn: () => unknown | Promise<unknown> }>
  ): Promise<BenchmarkSuite> {
    const results: BenchmarkResult[] = []

    for (const benchmark of benchmarks) {
      const result = await this.runBenchmark(benchmark.fn, benchmark.config)
      results.push(result)
    }

    const summary = {
      totalBenchmarks: results.length,
      passedBenchmarks: results.filter(r => r.passed).length,
      failedBenchmarks: results.filter(r => !r.passed).length,
      averageOpsPerSecond: results.reduce((sum, r) => sum + r.opsPerSecond, 0) / results.length,
      totalMemoryDelta: results.reduce((sum, r) => sum + r.memoryUsage.delta, 0)
    }

    return {
      name: suiteName,
      results,
      summary
    }
  }
}

// ===========================================
// STORE OPERATION BENCHMARKS
// ===========================================

describe('DCE Store Performance Benchmarks', () => {
  let benchmarkRunner: BenchmarkRunner

  beforeEach(() => {
    benchmarkRunner = new BenchmarkRunner()
  })

  describe('Basic Store Operations', () => {
    it('should benchmark auth store operations', async () => {
      const authWrapper = createStoreTestWrapper(useAuthStore, {
        storeName: 'auth-benchmark',
        trackPerformance: true
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Auth Store Operations', [
        {
          config: {
            name: 'login-operation',
            iterations: 1000,
            warmupIterations: 100,
            timeoutMs: 10000,
            targetOpsPerSecond: 500,
            maxMemoryMB: 5
          },
          fn: () => {
            const mockUser = mockDataGenerators.authState().user!
            act(() => {
              authWrapper.store.getState().login(mockUser, {
                accessToken: 'test-token',
                refreshToken: 'test-refresh',
                expiresAt: Date.now() + 3600000
              })
            })
          }
        },
        {
          config: {
            name: 'logout-operation',
            iterations: 1000,
            warmupIterations: 100,
            timeoutMs: 10000,
            targetOpsPerSecond: 800,
            maxMemoryMB: 2
          },
          fn: () => {
            act(() => {
              authWrapper.store.getState().logout()
            })
          }
        },
        {
          config: {
            name: 'state-subscription',
            iterations: 500,
            warmupIterations: 50,
            timeoutMs: 5000,
            targetOpsPerSecond: 200
          },
          fn: () => {
            return new Promise<void>(resolve => {
              const unsubscribe = authWrapper.store.subscribe(
                state => state.isAuthenticated,
                (_isAuthenticated) => {
                  unsubscribe()
                  resolve()
                }
              )
              
              act(() => {
                authWrapper.setState({ isAuthenticated: !authWrapper.getState().isAuthenticated })
              })
            })
          }
        }
      ])

      // Assertions
      expect(suite.summary.passedBenchmarks).toBeGreaterThanOrEqual(2)
      expect(suite.summary.averageOpsPerSecond).toBeGreaterThan(100)
      
      console.log(`Auth Store Benchmarks - ${suite.summary.passedBenchmarks}/${suite.summary.totalBenchmarks} passed`)
      suite.results.forEach(result => {
        if (!result.passed) {
          console.warn(`❌ ${result.name}: ${result.errors.join(', ')}`)
        } else {
          console.log(`✅ ${result.name}: ${result.opsPerSecond.toFixed(0)} ops/sec`)
        }
      })

      authWrapper.cleanup()
    })

    it('should benchmark blog store operations', async () => {
      const blogUIWrapper = createStoreTestWrapper(useBlogUIStore, {
        storeName: 'blog-ui-benchmark',
        trackPerformance: true
      })

      const blogEditorWrapper = createStoreTestWrapper(useBlogEditorStore, {
        storeName: 'blog-editor-benchmark',
        trackPerformance: true
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Blog Store Operations', [
        {
          config: {
            name: 'modal-state-transitions',
            iterations: 2000,
            warmupIterations: 200,
            timeoutMs: 15000,
            targetOpsPerSecond: 1000,
            maxMemoryMB: 3
          },
          fn: () => {
            const actions = [
              () => blogUIWrapper.store.getState().openCreateModal(),
              () => blogUIWrapper.store.getState().openEditModal('post-123'),
              () => blogUIWrapper.store.getState().openDeleteModal('post-123'),
              () => blogUIWrapper.store.getState().closeEditModal()
            ]
            
            const randomAction = actions[Math.floor(Math.random() * actions.length)]
            act(() => {
              randomAction()
            })
          }
        },
        {
          config: {
            name: 'draft-operations',
            iterations: 1000,
            warmupIterations: 100,
            timeoutMs: 10000,
            targetOpsPerSecond: 300,
            maxMemoryMB: 10
          },
          fn: () => {
            const mockDraft = mockDataGenerators.blogPost()
            act(() => {
              blogEditorWrapper.store.getState().updateDraft(mockDraft)
            })
          }
        },
        {
          config: {
            name: 'view-mode-switching',
            iterations: 1500,
            warmupIterations: 150,
            timeoutMs: 8000,
            targetOpsPerSecond: 800
          },
          fn: () => {
            const modes = ['grid', 'list', 'compact'] as const
            const randomMode = modes[Math.floor(Math.random() * modes.length)]
            act(() => {
              blogUIWrapper.store.getState().setViewMode(randomMode)
            })
          }
        }
      ])

      expect(suite.summary.passedBenchmarks).toBeGreaterThanOrEqual(2)
      expect(suite.summary.totalMemoryDelta).toBeLessThan(50 * 1024 * 1024) // 50MB max

      blogUIWrapper.cleanup()
      blogEditorWrapper.cleanup()
    })
  })

  describe('Selector Performance Benchmarks', () => {
    it('should benchmark selector performance under load', async () => {
      const buyerWrapper = createStoreTestWrapper(useBuyerStore, {
        storeName: 'buyer-selector-benchmark',
        trackPerformance: true
      })

      // Populate store with test data
      const campaigns = Array.from({ length: 1000 }, () => mockDataGenerators.campaign())
      act(() => {
        buyerWrapper.setState({ campaigns })
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Selector Performance', [
        {
          config: {
            name: 'active-campaigns-selector',
            iterations: 5000,
            warmupIterations: 500,
            timeoutMs: 20000,
            targetOpsPerSecond: 2000
          },
          fn: () => {
            const state = buyerWrapper.getState()
            return state.campaigns?.filter(c => c.status === 'active') || []
          }
        },
        {
          config: {
            name: 'campaign-metrics-computation',
            iterations: 1000,
            warmupIterations: 100,
            timeoutMs: 10000,
            targetOpsPerSecond: 200
          },
          fn: () => {
            const state = buyerWrapper.getState()
            return state.campaigns?.reduce((metrics, campaign) => {
              return {
                totalBudget: metrics.totalBudget + campaign.budget,
                averageBid: (metrics.averageBid + campaign.bidAmount) / 2,
                campaignCount: metrics.campaignCount + 1
              }
            }, { totalBudget: 0, averageBid: 0, campaignCount: 0 })
          }
        },
        {
          config: {
            name: 'filtered-search-selector',
            iterations: 2000,
            warmupIterations: 200,
            timeoutMs: 15000,
            targetOpsPerSecond: 500
          },
          fn: () => {
            const state = buyerWrapper.getState()
            const searchTerm = 'test'
            return state.campaigns?.filter(c => 
              c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
              c.description.toLowerCase().includes(searchTerm.toLowerCase())
            ) || []
          }
        }
      ])

      expect(suite.summary.passedBenchmarks).toBeGreaterThanOrEqual(2)
      
      // Verify selector performance didn't degrade
      const activeCampaignsBench = suite.results.find(r => r.name === 'active-campaigns-selector')
      expect(activeCampaignsBench?.opsPerSecond).toBeGreaterThan(1000)

      buyerWrapper.cleanup()
    })
  })

  describe('Memory Usage Benchmarks', () => {
    it('should detect memory leaks in store subscriptions', async () => {
      const settingsWrapper = createStoreTestWrapper(useSettingsStore, {
        storeName: 'settings-memory-benchmark',
        trackPerformance: true
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Memory Leak Detection', [
        {
          config: {
            name: 'subscription-memory-leak-test',
            iterations: 1000,
            warmupIterations: 100,
            timeoutMs: 30000,
            maxMemoryMB: 20,
            collectGCStats: true
          },
          fn: () => {
            // Create and immediately destroy subscriptions
            const unsubscribe = settingsWrapper.store.subscribe(
              state => state.preferences,
              (preferences) => {
                // Simulate some work
                JSON.stringify(preferences)
              }
            )
            
            // Update state to trigger subscription
            act(() => {
              settingsWrapper.setState({
                preferences: {
                  ...settingsWrapper.getState().preferences,
                  lastUpdate: Date.now()
                }
              })
            })
            
            unsubscribe()
          }
        },
        {
          config: {
            name: 'large-state-object-handling',
            iterations: 500,
            warmupIterations: 50,
            timeoutMs: 20000,
            maxMemoryMB: 100
          },
          fn: () => {
            // Create large state object
            const largeData = Array.from({ length: 10000 }, (_, i) => ({
              id: i,
              data: `large-data-item-${i}`,
              timestamp: Date.now(),
              metadata: {
                processed: false,
                priority: Math.floor(Math.random() * 10)
              }
            }))
            
            act(() => {
              settingsWrapper.setState({
                bulkData: largeData
              })
            })
            
            // Clear the data
            act(() => {
              settingsWrapper.setState({
                bulkData: null
              })
            })
          }
        }
      ])

      // Memory leak detection
      const subscriptionTest = suite.results.find(r => r.name === 'subscription-memory-leak-test')
      if (subscriptionTest) {
        expect(subscriptionTest.memoryUsage.delta).toBeLessThan(10 * 1024 * 1024) // 10MB max
        expect(subscriptionTest.passed).toBe(true)
      }

      settingsWrapper.cleanup()
    })
  })

  describe('Concurrent Operations Benchmarks', () => {
    it('should benchmark concurrent store updates', async () => {
      const navigationWrapper = createStoreTestWrapper(useNavigationStore, {
        storeName: 'navigation-concurrent-benchmark',
        trackPerformance: true
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Concurrent Operations', [
        {
          config: {
            name: 'concurrent-navigation-updates',
            iterations: 100, // Lower iterations for concurrent tests
            warmupIterations: 10,
            timeoutMs: 30000,
            targetOpsPerSecond: 50
          },
          fn: async () => {
            // Simulate concurrent navigation updates
            const concurrentUpdates = Array.from({ length: 10 }, (_, i) => 
              new Promise<void>(resolve => {
                setTimeout(() => {
                  act(() => {
                    const elements = ['mobile_menu', 'desktop_sidebar', 'user_dropdown'] as const
                    const randomElement = elements[i % elements.length]
                    navigationWrapper.store.getState().toggleElement(randomElement)
                  })
                  resolve()
                }, Math.random() * 10) // Random delay up to 10ms
              })
            )
            
            await Promise.all(concurrentUpdates)
          }
        },
        {
          config: {
            name: 'rapid-state-machine-transitions',
            iterations: 500,
            warmupIterations: 50,
            timeoutMs: 15000,
            targetOpsPerSecond: 100
          },
          fn: () => {
            // Rapid fire state machine transitions
            const transitions = [
              () => navigationWrapper.store.getState().expandElement('mobile_menu'),
              () => navigationWrapper.store.getState().collapseElement('mobile_menu'),
              () => navigationWrapper.store.getState().toggleElement('desktop_sidebar'),
              () => navigationWrapper.store.getState().updateAriaStates()
            ]
            
            // Execute 5 random transitions rapidly
            for (let i = 0; i < 5; i++) {
              const randomTransition = transitions[Math.floor(Math.random() * transitions.length)]
              act(() => {
                randomTransition()
              })
            }
          }
        }
      ])

      expect(suite.summary.passedBenchmarks).toBeGreaterThan(0)
      
      // Verify state consistency after concurrent operations
      const finalState = navigationWrapper.getState()
      expect(finalState.mobileMenu.type).toMatch(/^(collapsed|expanded)$/)
      expect(finalState.desktopSidebar.type).toMatch(/^(collapsed|expanded)$/)

      navigationWrapper.cleanup()
    })
  })

  describe('Real-time Performance Benchmarks', () => {
    it('should benchmark real-time update performance', async () => {
      const performanceWrapper = createStoreTestWrapper(usePerformanceMonitor, {
        storeName: 'realtime-performance-benchmark',
        trackPerformance: false // Don't track performance of performance monitor
      })

      // Start monitoring
      act(() => {
        performanceWrapper.store.getState().startMonitoring()
      })

      const suite = await benchmarkRunner.runBenchmarkSuite('Real-time Updates', [
        {
          config: {
            name: 'high-frequency-updates',
            iterations: 200,
            warmupIterations: 20,
            timeoutMs: 20000,
            targetOpsPerSecond: 10 // Lower target for complex real-time operations
          },
          fn: async () => {
            // Simulate high-frequency real-time updates
            const updates = Array.from({ length: 50 }, (_, i) => 
              new Promise<void>(resolve => {
                setTimeout(() => {
                  act(() => {
                    performanceWrapper.store.getState().recordMetric({
                      timestamp: Date.now(),
                      type: 'state_update',
                      duration: Math.random() * 10,
                      storeId: `store-${i % 5}`,
                      metadata: { iteration: i }
                    })
                  })
                  resolve()
                }, i * 2) // 2ms between updates
              })
            )
            
            await Promise.all(updates)
          }
        }
      ])

      expect(suite.results[0].passed).toBe(true)

      performanceWrapper.cleanup()
    })
  })
})

// ===========================================
// BENCHMARK REPORTING AND ANALYSIS
// ===========================================

export function generateBenchmarkReport(suites: BenchmarkSuite[]): string {
  const totalBenchmarks = suites.reduce((sum, s) => sum + s.summary.totalBenchmarks, 0)
  const totalPassed = suites.reduce((sum, s) => sum + s.summary.passedBenchmarks, 0)
  const totalMemoryUsage = suites.reduce((sum, s) => sum + s.summary.totalMemoryDelta, 0)

  let report = `# DCE Store Performance Benchmark Report

## Summary
- **Total Benchmarks:** ${totalBenchmarks}
- **Passed:** ${totalPassed} (${Math.round((totalPassed / totalBenchmarks) * 100)}%)
- **Failed:** ${totalBenchmarks - totalPassed}
- **Total Memory Usage:** ${(totalMemoryUsage / (1024 * 1024)).toFixed(2)} MB

## Suite Results

`

  suites.forEach(suite => {
    report += `### ${suite.name}
- **Passed:** ${suite.summary.passedBenchmarks}/${suite.summary.totalBenchmarks}
- **Average Ops/sec:** ${suite.summary.averageOpsPerSecond.toFixed(0)}
- **Memory Delta:** ${(suite.summary.totalMemoryDelta / (1024 * 1024)).toFixed(2)} MB

| Benchmark | Status | Ops/sec | Avg Time | Memory Delta |
|-----------|--------|---------|----------|--------------|
`

    suite.results.forEach(result => {
      const status = result.passed ? '✅' : '❌'
      const memoryMB = (result.memoryUsage.delta / (1024 * 1024)).toFixed(2)
      report += `| ${result.name} | ${status} | ${result.opsPerSecond.toFixed(0)} | ${result.averageTime.toFixed(2)}ms | ${memoryMB}MB |\n`
    })

    report += '\n'
  })

  return report
}

export function analyzeBenchmarkTrends(
  currentResults: BenchmarkSuite[],
  previousResults?: BenchmarkSuite[]
): {
  improvements: string[]
  regressions: string[]
  newBenchmarks: string[]
} {
  const analysis = {
    improvements: [] as string[],
    regressions: [] as string[],
    newBenchmarks: [] as string[]
  }

  if (!previousResults) {
    return analysis
  }

  currentResults.forEach(currentSuite => {
    const previousSuite = previousResults.find(s => s.name === currentSuite.name)
    
    if (!previousSuite) {
      analysis.newBenchmarks.push(currentSuite.name)
      return
    }

    currentSuite.results.forEach(currentResult => {
      const previousResult = previousSuite.results.find(r => r.name === currentResult.name)
      
      if (!previousResult) {
        analysis.newBenchmarks.push(`${currentSuite.name}:${currentResult.name}`)
        return
      }

      const opsChange = ((currentResult.opsPerSecond - previousResult.opsPerSecond) / previousResult.opsPerSecond) * 100
      const memoryChange = ((currentResult.memoryUsage.delta - previousResult.memoryUsage.delta) / Math.abs(previousResult.memoryUsage.delta)) * 100

      if (opsChange > 10) {
        analysis.improvements.push(`${currentSuite.name}:${currentResult.name} - ${opsChange.toFixed(1)}% faster`)
      } else if (opsChange < -10) {
        analysis.regressions.push(`${currentSuite.name}:${currentResult.name} - ${Math.abs(opsChange).toFixed(1)}% slower`)
      }

      if (memoryChange > 20) {
        analysis.regressions.push(`${currentSuite.name}:${currentResult.name} - ${memoryChange.toFixed(1)}% more memory`)
      } else if (memoryChange < -20) {
        analysis.improvements.push(`${currentSuite.name}:${currentResult.name} - ${Math.abs(memoryChange).toFixed(1)}% less memory`)
      }
    })
  })

  return analysis
}

// ===========================================
// EXPORTS
// ===========================================

export {
  BenchmarkRunner,
  generateBenchmarkReport,
  analyzeBenchmarkTrends,
  type BenchmarkConfig,
  type BenchmarkResult,
  type BenchmarkSuite
}