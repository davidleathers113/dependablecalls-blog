/**
 * Unified Mutator Type System for Zustand Stores
 * 
 * This file defines the standardized middleware chain and type definitions
 * to resolve the cascading TypeScript failures across the store system.
 * 
 * Standard Middleware Order:
 * 1. immer (for immutable updates)
 * 2. devtools (for Redux DevTools)
 * 3. subscribeWithSelector (for granular subscriptions)
 * 4. persist (for localStorage/IndexedDB persistence)
 * 
 * Optional middleware (applied conditionally):
 * - createMonitoringMiddleware (dev only)
 * - errorHandling (for critical stores)
 * - perfOptimization (for heavy stores)
 */

import type { StateCreator } from 'zustand'
import type { DevtoolsOptions } from 'zustand/middleware'
import type { PersistOptions } from 'zustand/middleware'

// Define the standard mutator chain for all stores
export type StandardMutators = [
  ['zustand/immer', never],
  ['zustand/devtools', never],
  ['zustand/subscribeWithSelector', never],
  ['zustand/persist', unknown]
]

// Lightweight mutator chain for simple UI stores
export type LightweightMutators = [
  ['zustand/immer', never]
]

// Type helper for creating stores with standard middleware
export type StandardStateCreator<T> = StateCreator<
  T,
  StandardMutators,
  [],
  T
>

// Type helper for creating lightweight stores
export type LightweightStateCreator<T> = StateCreator<
  T,
  LightweightMutators,
  [],
  T
>

// Configuration options for standard stores
export interface StandardStoreConfig<T> {
  name: string
  creator: StandardStateCreator<T>
  persist?: Omit<PersistOptions<T>, 'name'>
  devtools?: Omit<DevtoolsOptions, 'name' | 'enabled'>
  lightweight?: false
  monitoring?: {
    enabled?: boolean
    trackPerformance?: boolean
    trackStateChanges?: boolean
  }
}

// Configuration options for lightweight stores
export interface LightweightStoreConfig<T> {
  name: string
  creator: LightweightStateCreator<T>
  lightweight: true
}

// Union type for all store configurations
export type StoreConfig<T> = StandardStoreConfig<T> | LightweightStoreConfig<T>

// Type guard for lightweight stores
export function isLightweightConfig<T>(
  config: StoreConfig<T>
): config is LightweightStoreConfig<T> {
  return config.lightweight === true
}

// Feature flag check
export function shouldUseStandardStore(): boolean {
  return import.meta.env.VITE_USE_STANDARD_STORE === 'true'
}

// Performance measurement utilities
export interface PerformanceMetrics {
  updateCount: number
  totalDuration: number
  avgDuration: number
  slowUpdates: number
}

export const storeMetrics = new Map<string, PerformanceMetrics>()

export function recordStoreUpdate(storeName: string, duration: number): void {
  const metrics = storeMetrics.get(storeName) || {
    updateCount: 0,
    totalDuration: 0,
    avgDuration: 0,
    slowUpdates: 0,
  }

  metrics.updateCount++
  metrics.totalDuration += duration
  metrics.avgDuration = metrics.totalDuration / metrics.updateCount

  if (duration > 5) {
    metrics.slowUpdates++
  }

  storeMetrics.set(storeName, metrics)

  // Send to performance monitoring
  if (typeof window !== 'undefined' && 'performance' in window) {
    performance.mark(`store-update-${storeName}`)
    performance.measure(
      `store-update-${storeName}-${metrics.updateCount}`,
      {
        start: performance.now() - duration,
        duration,
      }
    )
  }
}

// Export monitoring utilities for development
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as any).__dceStoreMetrics = {
    getMetrics: (storeName?: string) => {
      if (storeName) {
        return storeMetrics.get(storeName)
      }
      return Object.fromEntries(storeMetrics)
    },
    clearMetrics: () => storeMetrics.clear(),
  }
}