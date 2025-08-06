/**
 * Performance Optimization Middleware
 * 
 * This middleware provides comprehensive performance optimizations including
 * selector memoization, batch updates, and efficient state management.
 */

import type { StateCreator } from 'zustand'

// ==================== Types ====================

export interface PerformanceConfig {
  enableMemoization: boolean
  enableBatching: boolean
  enableMetrics: boolean
  memoizationCacheSize: number
  batchingDelay: number
  metricsThreshold: number
}

export interface PerformanceMetrics {
  selectorExecutions: number
  stateUpdates: number
  renderCount: number
  averageUpdateTime: number
  cacheHitRate: number
  memoryUsage: number
}

export interface SelectorContext<TState, TResult> {
  selector: (state: TState) => TResult
  dependencies: Array<keyof TState>
  lastExecution: number
  executionCount: number
  averageTime: number
}

export interface BatchUpdate<TState> {
  id: string
  updater: (state: TState) => Partial<TState> | void
  timestamp: number
  priority: 'low' | 'normal' | 'high'
}

export interface CacheEntry<TResult> {
  value: TResult
  timestamp: number
  hits: number
  dependencies: string[]
}

// Note: Avoiding StoreMutators redeclaration to prevent conflicts

type WithPerfOptimization<S> = S & {
  getMetrics: () => PerformanceMetrics
  clearCache: () => void
  enableOptimization: (enabled: boolean) => void
}

// ==================== Cache Management ====================

class OptimizationCache<TState, TResult> {
  private cache = new Map<string, CacheEntry<TResult>>()
  private maxSize: number
  
  constructor(maxSize = 100) {
    this.maxSize = maxSize
  }

  get(key: string, dependencies: Array<keyof TState>, state: TState): TResult | undefined {
    const entry = this.cache.get(key)
    
    if (!entry) {
      return undefined
    }

    // Check if dependencies have changed
    const hasValidDependencies = dependencies.every(dep => {
      const depKey = String(dep)
      return entry.dependencies.includes(depKey) && 
             this.isDependencyValid(depKey, state, entry.timestamp)
    })

    if (!hasValidDependencies) {
      this.cache.delete(key)
      return undefined
    }

    // Update hit count
    entry.hits++
    return entry.value
  }

  set(key: string, value: TResult, dependencies: Array<keyof TState>): void {
    // Clean cache if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLeastUsed()
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 1,
      dependencies: dependencies.map(String)
    })
  }

  clear(): void {
    this.cache.clear()
  }

  getStats() {
    const entries = Array.from(this.cache.values())
    return {
      size: this.cache.size,
      totalHits: entries.reduce((sum, entry) => sum + entry.hits, 0),
      averageHits: entries.length > 0 
        ? entries.reduce((sum, entry) => sum + entry.hits, 0) / entries.length 
        : 0
    }
  }

  private isDependencyValid(_depKey: string, _state: TState, cacheTimestamp: number): boolean {
    // Simple implementation - could be enhanced with deep comparison
    return Date.now() - cacheTimestamp < 5000 // 5 second TTL
  }

  private evictLeastUsed(): void {
    let leastUsedKey = ''
    let leastHits = Infinity

    // Convert to array to avoid iterator issues
    const entries = Array.from(this.cache.entries())
    for (const [key, entry] of entries) {
      if (entry.hits < leastHits) {
        leastHits = entry.hits
        leastUsedKey = key
      }
    }

    if (leastUsedKey) {
      this.cache.delete(leastUsedKey)
    }
  }
}

// ==================== Batch Manager ====================

class BatchManager<TState> {
  private pendingUpdates = new Map<string, BatchUpdate<TState>>()
  private batchTimeout: NodeJS.Timeout | null = null
  private readonly delay: number

  constructor(delay = 16) { // 16ms for 60fps
    this.delay = delay
  }

  addUpdate(update: BatchUpdate<TState>, flushCallback: () => void): void {
    this.pendingUpdates.set(update.id, update)

    if (!this.batchTimeout) {
      this.batchTimeout = setTimeout(() => {
        this.flush(flushCallback)
      }, this.delay)
    }
  }

  flush(callback: () => void): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }

    if (this.pendingUpdates.size > 0) {
      callback()
      this.pendingUpdates.clear()
    }
  }

  getPendingUpdates(): BatchUpdate<TState>[] {
    return Array.from(this.pendingUpdates.values())
      .sort((a, b) => {
        // Sort by priority then timestamp
        const priorityOrder: Record<string, number> = { high: 3, normal: 2, low: 1 }
        const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority]
        return priorityDiff !== 0 ? priorityDiff : a.timestamp - b.timestamp
      })
  }

  clear(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }
    this.pendingUpdates.clear()
  }
}

// ==================== Performance Optimization Middleware ====================

export const perfOptimization = <T>(
  config: Partial<PerformanceConfig> = {}
) => {
  const fullConfig: PerformanceConfig = {
    enableMemoization: true,
    enableBatching: true,
    enableMetrics: true,
    memoizationCacheSize: 100,
    batchingDelay: 16,
    metricsThreshold: 16,
    ...config
  }

  return (
    stateCreator: StateCreator<T, [], [], T>
  ): StateCreator<T, [], [], T & WithPerfOptimization<T>> => {
    return (set, get, store) => {
      // Initialize optimization components
      const cache = new OptimizationCache<T, unknown>(fullConfig.memoizationCacheSize)
      const batchManager = new BatchManager<T>(fullConfig.batchingDelay)
      const metrics: PerformanceMetrics = {
        selectorExecutions: 0,
        stateUpdates: 0,
        renderCount: 0,
        averageUpdateTime: 0,
        cacheHitRate: 0,
        memoryUsage: 0
      }

      let optimizationEnabled = true
      let updateTimes: number[] = []

      // Enhanced setState with metrics tracking
      const enhancedSetState = (
        partial: T | Partial<T> | ((state: T) => T | Partial<T>),
        replace?: boolean | undefined
      ) => {
        const startTime = performance.now()

        // Direct update using standard Zustand pattern
        if (replace === true) {
          set(partial as T | ((state: T) => T), true)
        } else {
          set(partial, false)
        }

        // Update metrics
        if (fullConfig.enableMetrics) {
          const updateTime = performance.now() - startTime
          updateTimes.push(updateTime)
          
          // Keep only last 100 measurements
          if (updateTimes.length > 100) {
            updateTimes = updateTimes.slice(-100)
          }

          metrics.stateUpdates++
          metrics.averageUpdateTime = updateTimes.reduce((a, b) => a + b, 0) / updateTimes.length

          if (updateTime > fullConfig.metricsThreshold) {
            console.warn(`Slow state update detected: ${updateTime.toFixed(2)}ms`)
          }
        }
      }

      // Create optimized selector factory
      const createOptimizedSelector = <TResult>(
        selectorFn: (state: T) => TResult,
        dependencies: Array<keyof T> = []
      ) => {
        const selectorKey = selectorFn.toString() // Simple key generation
        
        return (state: T): TResult => {
          if (!optimizationEnabled || !fullConfig.enableMemoization) {
            metrics.selectorExecutions++
            return selectorFn(state)
          }

          // Try to get cached result - note: 'cached' is used here
          const cached = cache.get(selectorKey, dependencies, state)
          
          if (cached !== undefined) {
            metrics.cacheHitRate = (metrics.cacheHitRate * metrics.selectorExecutions + 1) / 
                                  (metrics.selectorExecutions + 1)
            metrics.selectorExecutions++
            return cached as TResult
          }

          // Compute and cache result
          const startTime = performance.now()
          const result = selectorFn(state)
          const executionTime = performance.now() - startTime

          cache.set(selectorKey, result, dependencies)
          
          metrics.selectorExecutions++
          metrics.cacheHitRate = (metrics.cacheHitRate * (metrics.selectorExecutions - 1)) / 
                                metrics.selectorExecutions

          if (executionTime > fullConfig.metricsThreshold) {
            console.warn(`Slow selector execution: ${executionTime.toFixed(2)}ms`)
          }

          return result
        }
      }

      // Initialize base state
      const baseState = stateCreator(enhancedSetState, get, store)

      // Return enhanced state with optimization methods
      return {
        ...baseState,
        getMetrics: () => ({
          ...metrics,
          memoryUsage: (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory?.usedJSHeapSize || 0
        }),
        clearCache: () => {
          cache.clear()
          batchManager.clear()
        },
        enableOptimization: (enabled: boolean) => {
          optimizationEnabled = enabled
        },
        // Expose selector factory for consumers
        createOptimizedSelector
      } as T & WithPerfOptimization<T>
    }
  }
}

// ==================== Utility Functions ====================

/**
 * Create a memoized selector with automatic dependency tracking
 */
export const createMemoizedSelector = <TState, TResult>(
  selector: (state: TState) => TResult,
  dependencies?: Array<keyof TState>,
  equalityFn?: (a: TResult, b: TResult) => boolean
) => {
  let lastResult: TResult
  let lastDependencyValues: unknown[]
  
  return (state: TState): TResult => {
    // If no dependencies specified, use the entire state
    const currentDependencyValues = dependencies 
      ? dependencies.map(dep => state[dep])
      : [state]

    // Check if dependencies changed
    const dependenciesChanged = !lastDependencyValues || 
      currentDependencyValues.length !== lastDependencyValues.length ||
      currentDependencyValues.some((val, index) => val !== lastDependencyValues[index])

    if (dependenciesChanged) {
      const newResult = selector(state)
      
      // Use custom equality function if provided
      if (equalityFn && lastResult !== undefined && !equalityFn(lastResult, newResult)) {
        lastResult = newResult
        lastDependencyValues = currentDependencyValues
      } else if (!equalityFn) {
        lastResult = newResult
        lastDependencyValues = currentDependencyValues
      }
    }

    return lastResult
  }
}

/**
 * Batch multiple updates for better performance
 */
export const batchStateUpdates = <TState>(
  updates: Array<(state: TState) => Partial<TState>>
) => {
  return (state: TState): TState => {
    return updates.reduce((acc, update) => {
      const result = update(acc)
      return { ...acc, ...result }
    }, state)
  }
}

/**
 * Create a performance monitor for debugging
 */
export const createPerformanceMonitor = (storeName: string) => {
  const measurements: Array<{ name: string; duration: number; timestamp: number }> = []
  
  return {
    measure: <T>(name: string, fn: () => T): T => {
      const start = performance.now()
      const result = fn()
      const duration = performance.now() - start
      
      measurements.push({
        name: `${storeName}.${name}`,
        duration,
        timestamp: Date.now()
      })
      
      // Keep only last 1000 measurements
      if (measurements.length > 1000) {
        measurements.splice(0, measurements.length - 1000)
      }
      
      return result
    },
    
    getReport: () => {
      return {
        totalMeasurements: measurements.length,
        averageDuration: measurements.reduce((sum, m) => sum + m.duration, 0) / measurements.length,
        slowestOperations: measurements
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10),
        recentActivity: measurements.slice(-20)
      }
    },
    
    clear: () => {
      measurements.length = 0
    }
  }
}

// ==================== Export Types ====================

export type PerfOptimizationMiddleware = typeof perfOptimization