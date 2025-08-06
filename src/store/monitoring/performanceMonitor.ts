/**
 * Performance Monitoring System
 * Phase 2.4 - Real-time performance tracking and optimization
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { onCLS, onFCP, onINP, onLCP, onTTFB } from 'web-vitals'
import type {
  PerformanceMetrics,
  StateChangeMetric,
  QueryCacheMetrics,
  EntityAdapterMetrics,
  PerformanceReport,
  PerformanceSummary,
  PerformanceRecommendation,
  PerformanceTrend,
  PERFORMANCE_THRESHOLDS,
  WindowWithMonitoring,
  ExtendedPerformance,
} from './types'

// ==================== Core Performance Monitor ====================

interface PerformanceMonitorState {
  // Current metrics
  metrics: PerformanceMetrics
  webVitals: WebVitals
  storeMetrics: Map<string, StorePerformance>
  
  // Historical data
  metricsHistory: PerformanceMetrics[]
  stateChangeHistory: StateChangeMetric[]
  
  // Analysis
  currentReport: PerformanceReport | null
  isAnalyzing: boolean
  
  // Configuration
  isEnabled: boolean
  samplingRate: number
  maxHistorySize: number
  
  // Actions
  startMonitoring: () => void
  stopMonitoring: () => void
  recordStateChange: (metric: StateChangeMetric) => void
  recordQueryMetrics: (metrics: QueryCacheMetrics) => void
  recordEntityMetrics: (storeName: string, metrics: EntityAdapterMetrics) => void
  generateReport: () => Promise<PerformanceReport>
  clearHistory: () => void
  updateConfig: (config: Partial<PerformanceMonitorConfig>) => void
}

interface WebVitals {
  cls: number | null
  fcp: number | null
  fid: number | null
  lcp: number | null
  ttfb: number | null
  lastUpdated: number
}

interface StorePerformance {
  name: string
  updateCount: number
  averageUpdateTime: number
  totalRenders: number
  selectorCalls: number
  memoryUsage: number
  lastActivity: number
}

interface PerformanceMonitorConfig {
  isEnabled: boolean
  samplingRate: number
  maxHistorySize: number
  webVitalsEnabled: boolean
  storeTrackingEnabled: boolean
  queryTrackingEnabled: boolean
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

const initialWebVitals: WebVitals = {
  cls: null,
  fcp: null,
  fid: null,
  lcp: null,
  ttfb: null,
  lastUpdated: 0,
}

// ==================== Performance Monitor Store ====================

export const usePerformanceMonitor = create<PerformanceMonitorState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    metrics: initialMetrics,
    webVitals: initialWebVitals,
    storeMetrics: new Map(),
    metricsHistory: [],
    stateChangeHistory: [],
    currentReport: null,
    isAnalyzing: false,
    isEnabled: process.env.NODE_ENV === 'development',
    samplingRate: 0.1,
    maxHistorySize: 1000,

    startMonitoring: () => {
      const state = get()
      if (!state.isEnabled || typeof window === 'undefined') return

      set({ isEnabled: true })

      // Start Web Vitals collection
      onCLS((metric) => {
        set((state: PerformanceMonitorState) => ({
          webVitals: {
            ...state.webVitals,
            cls: metric.value,
            lastUpdated: Date.now(),
          },
        }))
      })

      onFCP((metric) => {
        set((state: PerformanceMonitorState) => ({
          webVitals: {
            ...state.webVitals,
            fcp: metric.value,
            lastUpdated: Date.now(),
          },
        }))
      })

      onINP((metric) => {
        set((state: PerformanceMonitorState) => ({
          webVitals: {
            ...state.webVitals,
            fid: metric.value,
            lastUpdated: Date.now(),
          },
        }))
      })

      onLCP((metric) => {
        set((state: PerformanceMonitorState) => ({
          webVitals: {
            ...state.webVitals,
            lcp: metric.value,
            lastUpdated: Date.now(),
          },
        }))
      })

      onTTFB((metric) => {
        set((state: PerformanceMonitorState) => ({
          webVitals: {
            ...state.webVitals,
            ttfb: metric.value,
            lastUpdated: Date.now(),
          },
        }))
      })

      // Start performance monitoring loop
      const intervalId = setInterval(() => {
        const currentState = get()
        if (!currentState.isEnabled) {
          clearInterval(intervalId)
          return
        }

        // Collect memory usage
        const extendedPerformance = performance as ExtendedPerformance
        if (extendedPerformance.memory) {
          const memInfo = extendedPerformance.memory
          set((state: PerformanceMonitorState) => ({
            metrics: {
              ...state.metrics,
              memoryUsage: memInfo.usedJSHeapSize,
            },
          }))
        }

        // Update metrics history
        set((state: PerformanceMonitorState) => {
          const newHistory = [...state.metricsHistory, state.metrics].slice(-state.maxHistorySize)
          return { metricsHistory: newHistory }
        })
      }, 1000)

      // Store interval ID for cleanup
      const windowWithMonitoring = window as WindowWithMonitoring
      windowWithMonitoring.__performanceMonitorInterval = intervalId
    },

    stopMonitoring: () => {
      set({ isEnabled: false })
      
      if (typeof window !== 'undefined') {
        const windowWithMonitoring = window as WindowWithMonitoring
        if (windowWithMonitoring.__performanceMonitorInterval) {
          clearInterval(windowWithMonitoring.__performanceMonitorInterval as NodeJS.Timeout)
          delete windowWithMonitoring.__performanceMonitorInterval
        }
      }
    },

    recordStateChange: (metric: StateChangeMetric) => {
      const state = get()
      if (!state.isEnabled || Math.random() > state.samplingRate) return

      set((state: PerformanceMonitorState) => {
        const newHistory = [...state.stateChangeHistory, metric].slice(-state.maxHistorySize)
        
        // Update store-specific metrics
        const storeMetrics = new Map(state.storeMetrics)
        const existing = storeMetrics.get(metric.storeName) || {
          name: metric.storeName,
          updateCount: 0,
          averageUpdateTime: 0,
          totalRenders: 0,
          selectorCalls: 0,
          memoryUsage: 0,
          lastActivity: 0,
        }

        const newUpdateCount = existing.updateCount + 1
        const newAverageTime = (
          (existing.averageUpdateTime * existing.updateCount + metric.computationTime) / 
          newUpdateCount
        )

        storeMetrics.set(metric.storeName, {
          ...existing,
          updateCount: newUpdateCount,
          averageUpdateTime: newAverageTime,
          totalRenders: existing.totalRenders + metric.reRenderTriggers,
          selectorCalls: existing.selectorCalls + metric.affectedSelectors.length,
          lastActivity: metric.timestamp,
        })

        // Update global metrics
        const metrics = {
          ...state.metrics,
          storeUpdateFrequency: calculateUpdateFrequency(newHistory),
          selectorComputationTime: metric.computationTime,
          reRenderCount: state.metrics.reRenderCount + metric.reRenderTriggers,
          stateSize: metric.stateSize,
        }

        return {
          stateChangeHistory: newHistory,
          storeMetrics,
          metrics,
        }
      })
    },

    recordQueryMetrics: (queryMetrics: QueryCacheMetrics) => {
      const state = get()
      if (!state.isEnabled) return

      set((state: PerformanceMonitorState) => ({
        metrics: {
          ...state.metrics,
          queryCacheSize: queryMetrics.cacheSize,
        },
      }))
    },

    recordEntityMetrics: (storeName: string, entityMetrics: EntityAdapterMetrics) => {
      const state = get()
      if (!state.isEnabled) return

      set((state: PerformanceMonitorState) => {
        const storeMetrics = new Map(state.storeMetrics)
        const existing = storeMetrics.get(storeName) || {
          name: storeName,
          updateCount: 0,
          averageUpdateTime: 0,
          totalRenders: 0,
          selectorCalls: 0,
          memoryUsage: 0,
          lastActivity: 0,
        }

        storeMetrics.set(storeName, {
          ...existing,
          memoryUsage: entityMetrics.normalizedSize,
          lastActivity: Date.now(),
        })

        return {
          storeMetrics,
          metrics: {
            ...state.metrics,
            entityAdapterPerformance: entityMetrics,
          },
        }
      })
    },

    generateReport: async (): Promise<PerformanceReport> => {
      set({ isAnalyzing: true })

      try {
        const state = get()
        const report = await generatePerformanceReport(state)
        
        set({ 
          currentReport: report,
          isAnalyzing: false,
        })

        return report
      } catch (error) {
        set({ isAnalyzing: false })
        throw error
      }
    },

    clearHistory: () => {
      set({
        metricsHistory: [],
        stateChangeHistory: [],
        currentReport: null,
      })
    },

    updateConfig: (config: Partial<PerformanceMonitorConfig>) => {
      set((state: PerformanceMonitorState) => ({
        isEnabled: config.isEnabled ?? state.isEnabled,
        samplingRate: config.samplingRate ?? state.samplingRate,
        maxHistorySize: config.maxHistorySize ?? state.maxHistorySize,
      }))
    },
  }))
)

// ==================== Performance Analysis ====================

function calculateUpdateFrequency(history: StateChangeMetric[]): number {
  if (history.length < 2) return 0

  const timeWindow = 10000 // 10 seconds
  const now = Date.now()
  const recentUpdates = history.filter(
    (metric) => now - metric.timestamp < timeWindow
  )

  return (recentUpdates.length / timeWindow) * 1000 // Updates per second
}

async function generatePerformanceReport(state: PerformanceMonitorState): Promise<PerformanceReport> {
  const { metrics, webVitals, storeMetrics, metricsHistory } = state

  // Analyze performance bottlenecks
  const bottlenecks: string[] = []
  const improvements: string[] = []
  const warnings: string[] = []

  // Check Web Vitals
  if (webVitals.lcp && webVitals.lcp > 2500) {
    bottlenecks.push('Large Contentful Paint (LCP) is slow')
  }
  
  if (webVitals.fid && webVitals.fid > 100) {
    bottlenecks.push('First Input Delay (FID) is high')
  }
  
  if (webVitals.cls && webVitals.cls > 0.1) {
    bottlenecks.push('Cumulative Layout Shift (CLS) is excessive')
  }

  // Check store performance
  for (const [name, storePerf] of storeMetrics) {
    if (storePerf.averageUpdateTime > PERFORMANCE_THRESHOLDS.STATE_UPDATE_TIME) {
      bottlenecks.push(`Store "${name}" has slow updates (${storePerf.averageUpdateTime.toFixed(2)}ms)`)
    }
    
    if (storePerf.updateCount > 100 && storePerf.totalRenders / storePerf.updateCount > 5) {
      warnings.push(`Store "${name}" triggers excessive re-renders`)
    }
  }

  // Check memory usage
  if (metrics.memoryUsage > PERFORMANCE_THRESHOLDS.MEMORY_USAGE) {
    warnings.push('High memory usage detected')
  }

  // Generate recommendations
  const recommendations: PerformanceRecommendation[] = []

  if (bottlenecks.length > 0) {
    recommendations.push({
      type: 'critical',
      category: 'performance',
      description: 'Performance bottlenecks detected',
      solution: 'Review and optimize identified bottlenecks',
      impact: 'high',
      effort: 'medium',
    })
  }

  // Analyze trends
  const trends: PerformanceTrend[] = []
  if (metricsHistory.length > 10) {
    const memoryTrend = analyzeMetricTrend(
      metricsHistory.map(m => m.memoryUsage)
    )
    trends.push({
      metric: 'memoryUsage',
      values: metricsHistory.map(m => m.memoryUsage),
      timestamps: metricsHistory.map((_, i) => Date.now() - (metricsHistory.length - i) * 1000),
      trend: memoryTrend,
    })
  }

  const summary: PerformanceSummary = {
    overallScore: calculateOverallScore(metrics, webVitals, bottlenecks, warnings),
    bottlenecks,
    improvements,
    warnings,
  }

  return {
    summary,
    recommendations,
    metrics,
    trends,
  }
}

function analyzeMetricTrend(values: number[]): 'improving' | 'degrading' | 'stable' {
  if (values.length < 3) return 'stable'

  const recentValues = values.slice(-5)
  const recentAvg = recentValues.reduce((a, b) => a + b, 0) / recentValues.length

  const olderValues = values.slice(0, Math.max(1, values.length - 5))
  const olderAvg = olderValues.reduce((a, b) => a + b, 0) / olderValues.length

  const changeThreshold = 0.1 // 10% change
  const change = (recentAvg - olderAvg) / olderAvg

  if (change > changeThreshold) return 'degrading'
  if (change < -changeThreshold) return 'improving'
  return 'stable'
}

function calculateOverallScore(
  metrics: PerformanceMetrics,
  webVitals: WebVitals,
  bottlenecks: string[],
  warnings: string[]
): number {
  let score = 100

  // Deduct for bottlenecks
  score -= bottlenecks.length * 15

  // Deduct for warnings
  score -= warnings.length * 5

  // Web Vitals scoring
  if (webVitals.lcp) {
    if (webVitals.lcp > 4000) score -= 20
    else if (webVitals.lcp > 2500) score -= 10
  }

  if (webVitals.fid) {
    if (webVitals.fid > 300) score -= 15
    else if (webVitals.fid > 100) score -= 8
  }

  if (webVitals.cls) {
    if (webVitals.cls > 0.25) score -= 15
    else if (webVitals.cls > 0.1) score -= 8
  }

  return Math.max(0, Math.min(100, score))
}

// ==================== Development-only Utilities ====================

if (process.env.NODE_ENV === 'development') {
  // Auto-start monitoring in development
  if (typeof window !== 'undefined') {
    const monitor = usePerformanceMonitor.getState()
    monitor.startMonitoring()

    // Expose to global for debugging
    const windowWithMonitoring = window as WindowWithMonitoring
    windowWithMonitoring.__performanceMonitor = {
      getState: usePerformanceMonitor.getState,
    }
  }
}

// ==================== Cleanup ====================

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    const monitor = usePerformanceMonitor.getState()
    monitor.stopMonitoring()
  })
}

// ==================== Exports ====================

export type { PerformanceMonitorState, PerformanceMonitorConfig }
export { initialMetrics, initialWebVitals }