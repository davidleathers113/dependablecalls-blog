/**
 * Monitoring Integration Utilities
 * Phase 2.4 - Integration helpers for existing stores and middleware
 */

import type { StateCreator } from 'zustand'
import { usePerformanceMonitor } from '../monitoring/performanceMonitor'
import { useStateDebugger } from '../debugging/stateDebugger'
import { useMetricsCollector } from '../monitoring/metricsCollector'
import { useDevToolsExtension } from '../debugging/devToolsExtension'
import { createEnhancedDevToolsMiddleware } from '../debugging/devToolsExtension'
import type {
  StateAction,
  StateChangeMetric,
  EntityAdapterMetrics,
  MonitoringConfig,
  MiddlewareConfig,
} from '../monitoring/types'

// ==================== Monitoring Middleware ====================

export function createMonitoringMiddleware<T>(
  config: Partial<MiddlewareConfig> = {}
) {
  const finalConfig: MiddlewareConfig = {
    name: 'MonitoredStore',
    enabled: process.env.NODE_ENV === 'development',
    options: {
      trackPerformance: true,
      trackStateChanges: true,
      trackSelectors: false,
      enableTimeTravel: false,
      maxHistorySize: 1000,
      ...config.options,
    },
    ...config,
  }

  return (f: StateCreator<T, [], [], T>, name?: string): StateCreator<T, [], [], T> => {
    if (!finalConfig.enabled) {
      return f
    }

    const storeName = name || finalConfig.name

    return (set, get, api) => {
      // Get monitoring services
      const performanceMonitor = usePerformanceMonitor.getState()
      const stateDebugger = useStateDebugger.getState()
      const metricsCollector = useMetricsCollector.getState()

      // Wrap the set function to track state changes
      const monitoredSet = (partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean) => {
        const startTime = performance.now()
        const prevState = get()
        const prevStateSize = JSON.stringify(prevState).length

        // Execute the state update
        if (replace) {
          // When replacing, ensure we have a complete state
          if (typeof partial === 'function' && !Array.isArray(partial)) {
            const updaterFn = partial as (state: T) => T | Partial<T>
            const newState = updaterFn(prevState)
            set(newState as T, true)
          } else {
            set(partial as T, true)
          }
        } else {
          set(partial)
        }

        const endTime = performance.now()
        const newState = get()
        const newStateSize = JSON.stringify(newState).length
        const computationTime = endTime - startTime

        // Track performance metrics
        if (finalConfig.options.trackPerformance) {
          const metric: StateChangeMetric = {
            timestamp: Date.now(),
            storeName,
            actionType: typeof partial === 'function' ? 'function' : 'object',
            stateSize: newStateSize,
            computationTime,
            affectedSelectors: [], // Would need selector tracking
            reRenderTriggers: 1, // Simplified - would need component tracking
          }

          performanceMonitor.recordStateChange(metric)
        }

        // Track state changes for debugging
        if (finalConfig.options.trackStateChanges) {
          const action: StateAction = {
            type: typeof partial === 'function' ? 'FUNCTION_UPDATE' : 'OBJECT_UPDATE',
            payload: typeof partial === 'function' ? null : partial,
            timestamp: Date.now(),
            source: 'user',
          }

          stateDebugger.recordStateChange(storeName, newState, action)
        }

        // Record state hydration metrics if this looks like initial load
        if (prevStateSize === 0 && newStateSize > 0) {
          metricsCollector.recordStateHydration({
            storeName,
            duration: computationTime,
            dataSize: newStateSize,
            source: 'cache', // Would need to detect actual source
            success: true,
          })
        }
      }

      // Create the store with monitoring
      const store = f(monitoredSet, get, api)

      // Set up store-specific monitoring
      setupStoreMonitoring(storeName, store, finalConfig.options)

      return store
    }
  }
}

// ==================== Store Integration Helpers ====================

export function integrateExistingStore<T>(
  storeName: string,
  storeGetter: () => T,
  config: Partial<MonitoringConfig> = {}
) {
  const finalConfig: MonitoringConfig = {
    enabled: true,
    samplingRate: 0.1,
    maxHistorySize: 1000,
    performanceThresholds: {
      stateUpdateTime: 5,
      selectorComputationTime: 2,
      memoryUsage: 50 * 1024 * 1024,
      queryCacheSize: 100,
      reRenderThreshold: 10,
    },
    debugLevel: 'basic',
    features: [
      { name: 'stateTracking', enabled: true },
      { name: 'performanceMonitoring', enabled: true },
    ],
    ...config,
  }

  if (process.env.NODE_ENV !== 'development' && !finalConfig.enabled) {
    return
  }

  console.log(`🔍 Integrating monitoring for store: ${storeName}`)

  // Monitor state changes
  let prevState = storeGetter()
  let prevStateSize = JSON.stringify(prevState).length

  const checkForChanges = () => {
    const currentState = storeGetter()
    const currentStateSize = JSON.stringify(currentState).length

    if (currentState !== prevState) {
      const stateDebugger = useStateDebugger.getState()
      const action: StateAction = {
        type: 'EXTERNAL_UPDATE',
        timestamp: Date.now(),
        source: 'system',
      }

      stateDebugger.recordStateChange(storeName, currentState, action)

      // Track size changes
      if (currentStateSize !== prevStateSize) {
        const metricsCollector = useMetricsCollector.getState()
        metricsCollector.recordStateHydration({
          storeName,
          duration: 0, // Can't measure external updates
          dataSize: currentStateSize,
          source: 'cache',
          success: true,
        })
      }

      prevState = currentState
      prevStateSize = currentStateSize
    }
  }

  // Poll for changes (not ideal, but works for external stores)
  const interval = setInterval(checkForChanges, 1000)

  // Return cleanup function
  return () => {
    clearInterval(interval)
    console.log(`🔍 Stopped monitoring store: ${storeName}`)
  }
}

// ==================== Entity Adapter Integration ====================

export function trackEntityAdapterPerformance<T, E = unknown>(
  storeName: string,
  adapter: {
    selectAll: (state: T) => E[]
    selectById: (state: T, id: string) => E | undefined
    selectIds: (state: T) => string[]
  },
  state: T
) {
  if (process.env.NODE_ENV !== 'development') return

  const startTime = performance.now()
  
  // Measure selector performance
  const allEntities = adapter.selectAll(state)
  adapter.selectIds(state) // Execute for performance timing measurement
  const selectAllTime = performance.now() - startTime

  // Calculate metrics
  const entityCount = allEntities.length
  const normalizedSize = JSON.stringify(allEntities).length
  const indexBuildTime = 0 // Would need to measure actual index building

  const metrics: EntityAdapterMetrics = {
    entityCount,
    normalizedSize,
    indexBuildTime,
    selectorExecutionTime: selectAllTime,
    cacheHitRate: 0, // Would need cache tracking
  }

  const performanceMonitor = usePerformanceMonitor.getState()
  performanceMonitor.recordEntityMetrics(storeName, metrics)
}

// ==================== Query Integration ====================

export function trackQueryPerformance(
  queryKey: string,
  duration: number,
  cacheHit: boolean,
  error?: Error
) {
  if (process.env.NODE_ENV !== 'development') return

  const metricsCollector = useMetricsCollector.getState()
  
  metricsCollector.recordAPICall({
    url: queryKey,
    method: 'GET',
    status: error ? 500 : 200,
    duration,
    size: { request: 0, response: 0 }, // Would need actual size tracking
    error: error?.message,
    retryCount: 0,
    cacheHit,
  })
}

// ==================== Selector Performance Tracking ====================

export function createTrackedSelector<T, R>(
  selectorName: string,
  selector: (state: T) => R,
  dependencies: string[] = []
) {
  if (process.env.NODE_ENV !== 'development') {
    return selector
  }

  return (state: T): R => {
    const startTime = performance.now()
    const result = selector(state)
    const endTime = performance.now()
    const computationTime = endTime - startTime

    // Record selector performance
    const stateDebugger = useStateDebugger.getState()
    stateDebugger.recordSelectorCall(selectorName, dependencies, computationTime)

    return result
  }
}

// ==================== Batch Monitoring Setup ====================

export function setupMonitoringForAllStores(storeConfigs: Array<{
  name: string
  getter: () => unknown
  config?: Partial<MonitoringConfig>
}>) {
  const cleanupFunctions: Array<() => void> = []

  storeConfigs.forEach(({ name, getter, config }) => {
    const cleanup = integrateExistingStore(name, getter, config)
    if (cleanup) {
      cleanupFunctions.push(cleanup)
    }
  })

  // Return master cleanup function
  return () => {
    cleanupFunctions.forEach(cleanup => cleanup())
    console.log('🔍 All store monitoring stopped')
  }
}

// ==================== Store Monitoring Setup ====================

function setupStoreMonitoring<T>(
  storeName: string,
  store: T,
  options: MiddlewareConfig['options']
) {
  // Set up periodic health checks
  if (options.trackPerformance) {
    const healthCheckInterval = setInterval(() => {
      checkStoreHealth(storeName, store)
    }, 10000) // Every 10 seconds

    // Store cleanup reference
    interface WindowWithCleanup extends Window {
      __storeCleanup?: Map<string, () => void>
    }
    const windowWithCleanup = window as WindowWithCleanup
    windowWithCleanup.__storeCleanup = windowWithCleanup.__storeCleanup || new Map()
    windowWithCleanup.__storeCleanup.set(storeName, () => {
      clearInterval(healthCheckInterval)
    })
  }

  // Set up selector tracking if enabled
  if (options.trackSelectors) {
    // This would hook into selector calls - implementation depends on store structure
  }
}

function checkStoreHealth<T>(storeName: string, store: T) {
  try {
    const stateSize = JSON.stringify(store).length
    
    // Check for memory leaks (state growing without bounds)
    const threshold = 1024 * 1024 // 1MB
    if (stateSize > threshold) {
      const metricsCollector = useMetricsCollector.getState()
      metricsCollector.recordError({
        type: 'performance',
        severity: 'medium',
        message: `Store ${storeName} has grown large`,
        context: {
          storeName,
        },
        resolved: false,
      })
    }
  } catch (error) {
    console.warn(`Health check failed for store ${storeName}:`, error)
  }
}

// ==================== DevTools Integration ====================

export function setupEnhancedDevTools(storeNames: string[]) {
  if (process.env.NODE_ENV !== 'development') return

  const devTools = useDevToolsExtension.getState()
  
  // Connect to DevTools
  devTools.connect()

  // Configure DevTools for our stores
  devTools.updateConfig({
    name: 'DCE Platform Monitor',
    enabled: true,
    features: {
      stateInspection: true,
      timeTraveling: true,
      performanceMonitoring: true,
      stateMachineDebugging: true,
      selectorProfiling: true,
      actionReplay: true,
      exportImport: true,
    },
    filters: {
      stores: storeNames,
      actions: [],
      performance: true,
    },
  })

  console.log('🛠️ Enhanced DevTools configured for stores:', storeNames)
}

// ==================== React Integration Hook ====================

export function useMonitoringIntegration(
  _storeName: string,
  enabled: boolean = process.env.NODE_ENV === 'development'
) {
  if (!enabled) return null

  // This hook would integrate with React's lifecycle
  // For now, return basic monitoring info
  return {
    isMonitoring: true,
    recordInteraction: (type: 'click' | 'scroll' | 'navigation' | 'input' | 'hover', target: string) => {
      const metricsCollector = useMetricsCollector.getState()
      metricsCollector.recordUserInteraction({
        type,
        target,
      })
    },
  }
}

// ==================== Automatic Store Detection ====================

export function autoDetectAndMonitorStores() {
  if (process.env.NODE_ENV !== 'development') return

  // This would automatically detect Zustand stores and add monitoring
  // Implementation would depend on how stores are registered globally
  
  const detectedStores: string[] = []
  
  // Check for common store patterns in window object
  Object.keys(window).forEach(key => {
    if (key.startsWith('use') && key.endsWith('Store')) {
      detectedStores.push(key)
    }
  })

  if (detectedStores.length > 0) {
    console.log('🔍 Auto-detected stores for monitoring:', detectedStores)
    setupEnhancedDevTools(detectedStores)
  }
}

// ==================== Export Utilities ====================

export {
  createEnhancedDevToolsMiddleware,
}

// Auto-initialize in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Auto-detect stores after a delay to allow stores to initialize
  setTimeout(autoDetectAndMonitorStores, 2000)
}