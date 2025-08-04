/**
 * Phase 4 Performance Optimization: Performance Benchmarks
 * 
 * This module provides comprehensive performance monitoring and benchmarking
 * for Zustand stores with detailed metrics and reporting.
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  PerformanceMetrics,
  StateChangeMetric,
} from '../monitoring/types'

export interface BenchmarkResult {
  name: string
  executionTime: number
  memoryDelta: number
  renderCount: number
  selectorCalls: number
  stateSize: number
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface BenchmarkSuite {
  name: string
  results: BenchmarkResult[]
  averageExecutionTime: number
  totalMemoryUsage: number
  performanceScore: number
  recommendations: string[]
}

export interface PerformanceBenchmarkState {
  // Current benchmarks
  activeBenchmarks: Map<string, BenchmarkContext>
  completedSuites: BenchmarkSuite[]
  
  // Global metrics
  globalMetrics: PerformanceMetrics
  baseline: PerformanceMetrics | null
  
  // Configuration
  isEnabled: boolean
  autoRunBenchmarks: boolean
  benchmarkInterval: number
  maxHistorySize: number
  
  // Actions
  startBenchmark: (name: string, config?: BenchmarkConfig) => string
  endBenchmark: (id: string) => BenchmarkResult | null
  runBenchmarkSuite: (suite: BenchmarkDefinition[]) => Promise<BenchmarkSuite>
  compareWithBaseline: () => PerformanceComparison | null
  generateReport: () => PerformanceReport
  clearHistory: () => void
  setBaseline: (metrics?: PerformanceMetrics) => void
  
  // Real-time monitoring
  trackStateChange: (metric: StateChangeMetric) => void
  trackSelectorUsage: (selectorName: string, executionTime: number) => void
  trackMemoryUsage: () => void
}

interface BenchmarkContext {
  id: string
  name: string
  startTime: number
  startMemory: number
  renderCount: number
  selectorCalls: number
  config: BenchmarkConfig
}

export interface BenchmarkConfig {
  trackMemory?: boolean
  trackRenders?: boolean
  trackSelectors?: boolean
  warmupRuns?: number
  iterations?: number
  timeout?: number
  metadata?: Record<string, unknown>
}

export interface BenchmarkDefinition {
  name: string
  setup?: () => void | Promise<void>
  execute: () => void | Promise<void>
  teardown?: () => void | Promise<void>
  config?: BenchmarkConfig
}

export interface PerformanceComparison {
  current: PerformanceMetrics
  baseline: PerformanceMetrics
  improvements: Record<string, number>
  regressions: Record<string, number>
  overallScore: number
}

export interface PerformanceReport {
  timestamp: number
  totalBenchmarks: number
  averagePerformanceScore: number
  topBottlenecks: Array<{
    name: string
    impact: number
    recommendation: string
  }>
  memoryAnalysis: {
    totalUsage: number
    trends: Array<{ timestamp: number; usage: number }>
    leakSuspects: string[]
  }
  recommendations: string[]
  exportData: {
    benchmarks: BenchmarkSuite[]
    metrics: PerformanceMetrics
    comparison: PerformanceComparison | null
  }
}

const initialMetrics: PerformanceMetrics = {
  storeUpdateFrequency: 0,
  selectorComputationTime: 0,
  reRenderCount: 0,
  memoryUsage: 0,
  stateSize: 0,
  queryCacheSize: 0,
  entityAdapterPerformance: {
    entityCount: 0,
    normalizedSize: 0,
    indexBuildTime: 0,
    selectorExecutionTime: 0,
    cacheHitRate: 0,
  },
}

export const usePerformanceBenchmark = create<PerformanceBenchmarkState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    activeBenchmarks: new Map(),
    completedSuites: [],
    globalMetrics: { ...initialMetrics },
    baseline: null,
    isEnabled: process.env.NODE_ENV === 'development',
    autoRunBenchmarks: false,
    benchmarkInterval: 60000, // 1 minute
    maxHistorySize: 100,

    // Start a new benchmark
    startBenchmark: (name: string, config: BenchmarkConfig = {}) => {
      if (!get().isEnabled) return ''
      
      const id = `${name}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
      const startMemory = performance.memory?.usedJSHeapSize || 0
      
      const context: BenchmarkContext = {
        id,
        name,
        startTime: performance.now(),
        startMemory,
        renderCount: 0,
        selectorCalls: 0,
        config: {
          trackMemory: true,
          trackRenders: true,
          trackSelectors: true,
          warmupRuns: 0,
          iterations: 1,
          timeout: 10000,
          ...config,
        },
      }
      
      set(state => ({
        activeBenchmarks: new Map(state.activeBenchmarks).set(id, context)
      }))
      
      return id
    },

    // End a benchmark and record results
    endBenchmark: (id: string) => {
      const state = get()
      const context = state.activeBenchmarks.get(id)
      
      if (!context) return null
      
      const endTime = performance.now()
      const endMemory = performance.memory?.usedJSHeapSize || 0
      const executionTime = endTime - context.startTime
      const memoryDelta = endMemory - context.startMemory
      
      const result: BenchmarkResult = {
        name: context.name,
        executionTime,
        memoryDelta,
        renderCount: context.renderCount,
        selectorCalls: context.selectorCalls,
        stateSize: JSON.stringify(state).length,
        timestamp: Date.now(),
        metadata: context.config.metadata,
      }
      
      // Remove from active benchmarks
      const newActiveBenchmarks = new Map(state.activeBenchmarks)
      newActiveBenchmarks.delete(id)
      
      set({ activeBenchmarks: newActiveBenchmarks })
      
      return result
    },

    // Run a complete benchmark suite
    runBenchmarkSuite: async (suite: BenchmarkDefinition[]) => {
      const state = get()
      if (!state.isEnabled) {
        throw new Error('Benchmarks are disabled')
      }
      
      const results: BenchmarkResult[] = []
      const suiteName = `Suite-${Date.now()}`
      
      for (const benchmark of suite) {
        try {
          // Setup phase
          if (benchmark.setup) {
            await benchmark.setup()
          }
          
          // Warmup runs
          const warmupRuns = benchmark.config?.warmupRuns || 0
          for (let i = 0; i < warmupRuns; i++) {
            await benchmark.execute()
          }
          
          // Actual benchmark runs
          const iterations = benchmark.config?.iterations || 1
          const benchmarkResults: BenchmarkResult[] = []
          
          for (let i = 0; i < iterations; i++) {
            const benchmarkId = get().startBenchmark(benchmark.name, benchmark.config)
            
            try {
              await benchmark.execute()
            } catch (error) {
              console.error(`Benchmark ${benchmark.name} failed:`, error)
              get().endBenchmark(benchmarkId) // Clean up
              continue
            }
            
            const result = get().endBenchmark(benchmarkId)
            if (result) {
              benchmarkResults.push(result)
            }
          }
          
          // Calculate average result
          if (benchmarkResults.length > 0) {
            const avgResult: BenchmarkResult = {
              name: benchmark.name,
              executionTime: benchmarkResults.reduce((sum, r) => sum + r.executionTime, 0) / benchmarkResults.length,
              memoryDelta: benchmarkResults.reduce((sum, r) => sum + r.memoryDelta, 0) / benchmarkResults.length,
              renderCount: benchmarkResults.reduce((sum, r) => sum + r.renderCount, 0) / benchmarkResults.length,
              selectorCalls: benchmarkResults.reduce((sum, r) => sum + r.selectorCalls, 0) / benchmarkResults.length,
              stateSize: benchmarkResults.reduce((sum, r) => sum + r.stateSize, 0) / benchmarkResults.length,
              timestamp: Date.now(),
              metadata: {
                ...benchmark.config?.metadata,
                iterations: benchmarkResults.length,
                variance: calculateVariance(benchmarkResults.map(r => r.executionTime)),
              },
            }
            results.push(avgResult)
          }
          
          // Teardown phase
          if (benchmark.teardown) {
            await benchmark.teardown()
          }
        } catch (error) {
          console.error(`Benchmark suite failed at ${benchmark.name}:`, error)
        }
      }
      
      // Create suite result
      const averageExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
      const totalMemoryUsage = results.reduce((sum, r) => sum + Math.abs(r.memoryDelta), 0)
      const performanceScore = calculatePerformanceScore(results)
      const recommendations = generateRecommendations(results)
      
      const suiteResult: BenchmarkSuite = {
        name: suiteName,
        results,
        averageExecutionTime,
        totalMemoryUsage,
        performanceScore,
        recommendations,
      }
      
      // Add to completed suites
      set(state => {
        const newSuites = [...state.completedSuites, suiteResult]
        if (newSuites.length > state.maxHistorySize) {
          newSuites.splice(0, newSuites.length - state.maxHistorySize)
        }
        return { completedSuites: newSuites }
      })
      
      return suiteResult
    },

    // Compare current metrics with baseline
    compareWithBaseline: () => {
      const state = get()
      if (!state.baseline) return null
      
      const current = state.globalMetrics
      const baseline = state.baseline
      
      const improvements: Record<string, number> = {}
      const regressions: Record<string, number> = {}
      
      // Compare key metrics
      const metrics = [
        'storeUpdateFrequency',
        'selectorComputationTime',
        'reRenderCount',
        'memoryUsage'
      ] as const
      
      metrics.forEach(metric => {
        const currentValue = current[metric]
        const baselineValue = baseline[metric]
        const change = currentValue - baselineValue
        const percentChange = (change / baselineValue) * 100
        
        if (percentChange < 0) {
          improvements[metric] = Math.abs(percentChange)
        } else if (percentChange > 5) { // 5% threshold for regression
          regressions[metric] = percentChange
        }
      })
      
      const overallScore = calculateOverallScore(improvements, regressions)
      
      return {
        current,
        baseline,
        improvements,
        regressions,
        overallScore,
      }
    },

    // Generate comprehensive performance report
    generateReport: () => {
      const state = get()
      const timestamp = Date.now()
      
      const totalBenchmarks = state.completedSuites.reduce(
        (sum, suite) => sum + suite.results.length, 0
      )
      
      const averagePerformanceScore = state.completedSuites.reduce(
        (sum, suite) => sum + suite.performanceScore, 0
      ) / state.completedSuites.length || 0
      
      // Identify bottlenecks
      const allResults = state.completedSuites.flatMap(suite => suite.results)
      const topBottlenecks = findBottlenecks(allResults)
      
      // Memory analysis
      const memoryTrends = allResults.map(result => ({
        timestamp: result.timestamp,
        usage: Math.abs(result.memoryDelta)
      })).sort((a, b) => a.timestamp - b.timestamp)
      
      const leakSuspects = findMemoryLeakSuspects(allResults)
      
      const report: PerformanceReport = {
        timestamp,
        totalBenchmarks,
        averagePerformanceScore,
        topBottlenecks,
        memoryAnalysis: {
          totalUsage: state.globalMetrics.memoryUsage,
          trends: memoryTrends,
          leakSuspects,
        },
        recommendations: generateGlobalRecommendations(state),
        exportData: {
          benchmarks: state.completedSuites,
          metrics: state.globalMetrics,
          comparison: state.compareWithBaseline(),
        },
      }
      
      return report
    },

    // Utility methods
    clearHistory: () => {
      set({
        completedSuites: [],
        activeBenchmarks: new Map(),
      })
    },

    setBaseline: (metrics?: PerformanceMetrics) => {
      set({
        baseline: metrics || get().globalMetrics
      })
    },

    trackStateChange: (metric: StateChangeMetric) => {
      if (!get().isEnabled) return
      
      set(state => ({
        globalMetrics: {
          ...state.globalMetrics,
          storeUpdateFrequency: state.globalMetrics.storeUpdateFrequency + 1,
          stateSize: metric.newStateSize || state.globalMetrics.stateSize,
        }
      }))
    },

    trackSelectorUsage: (selectorName: string, executionTime: number) => {
      if (!get().isEnabled) return
      
      set(state => ({
        globalMetrics: {
          ...state.globalMetrics,
          selectorComputationTime: state.globalMetrics.selectorComputationTime + executionTime,
        }
      }))
    },

    trackMemoryUsage: () => {
      if (!get().isEnabled) return
      
      const memoryUsage = performance.memory?.usedJSHeapSize || 0
      set(state => ({
        globalMetrics: {
          ...state.globalMetrics,
          memoryUsage,
        }
      }))
    },
  }))
)

// Helper functions
const calculateVariance = (values: number[]): number => {
  const mean = values.reduce((sum, val) => sum + val, 0) / values.length
  const squaredDiffs = values.map(val => Math.pow(val - mean, 2))
  return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length
}

const calculatePerformanceScore = (results: BenchmarkResult[]): number => {
  if (results.length === 0) return 0
  
  // Weighted scoring based on execution time and memory usage
  const scores = results.map(result => {
    const timeScore = Math.max(0, 100 - (result.executionTime / 10)) // 10ms = 90 score
    const memoryScore = Math.max(0, 100 - (Math.abs(result.memoryDelta) / 1000)) // 1MB = 99 score
    return (timeScore * 0.6) + (memoryScore * 0.4)
  })
  
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

const calculateOverallScore = (
  improvements: Record<string, number>,
  regressions: Record<string, number>
): number => {
  const improvementScore = Object.values(improvements).reduce((sum, val) => sum + val, 0)
  const regressionPenalty = Object.values(regressions).reduce((sum, val) => sum + val, 0)
  
  return Math.max(0, 100 + improvementScore - regressionPenalty)
}

const findBottlenecks = (results: BenchmarkResult[]) => {
  return results
    .sort((a, b) => b.executionTime - a.executionTime)
    .slice(0, 5)
    .map(result => ({
      name: result.name,
      impact: result.executionTime,
      recommendation: getRecommendationForBottleneck(result),
    }))
}

const findMemoryLeakSuspects = (results: BenchmarkResult[]): string[] => {
  return results
    .filter(result => result.memoryDelta > 1000000) // 1MB threshold
    .map(result => result.name)
}

const getRecommendationForBottleneck = (result: BenchmarkResult): string => {
  if (result.executionTime > 100) {
    return 'Consider optimizing state updates or using immer for immutable updates'
  }
  if (result.memoryDelta > 1000000) {
    return 'Check for memory leaks or large object allocations'
  }
  if (result.selectorCalls > 100) {
    return 'Consider memoizing selectors to reduce computation'
  }
  return 'Monitor for consistent performance across runs'
}

const generateRecommendations = (results: BenchmarkResult[]): string[] => {
  const recommendations: string[] = []
  
  const avgExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0) / results.length
  const avgMemoryDelta = results.reduce((sum, r) => sum + Math.abs(r.memoryDelta), 0) / results.length
  
  if (avgExecutionTime > 50) {
    recommendations.push('Consider using immer middleware for more efficient state updates')
  }
  
  if (avgMemoryDelta > 500000) {
    recommendations.push('Implement resource cleanup to prevent memory leaks')
  }
  
  if (results.some(r => r.selectorCalls > 50)) {
    recommendations.push('Add selector memoization to reduce redundant computations')
  }
  
  return recommendations
}

const generateGlobalRecommendations = (state: PerformanceBenchmarkState): string[] => {
  const recommendations: string[] = []
  
  if (state.globalMetrics.memoryUsage > 50000000) { // 50MB
    recommendations.push('High memory usage detected - consider implementing lazy loading')
  }
  
  if (state.globalMetrics.storeUpdateFrequency > 1000) {
    recommendations.push('High update frequency - consider batching state updates')
  }
  
  if (state.completedSuites.length === 0) {
    recommendations.push('No benchmark data available - run performance tests to establish baseline')
  }
  
  return recommendations
}

export type PerformanceBenchmarkStore = typeof usePerformanceBenchmark