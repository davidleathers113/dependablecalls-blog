/**
 * Immer Middleware - Zustand v5 Compatible
 *
 * This file re-exports Zustand's built-in immer middleware and provides
 * additional utilities for performance monitoring and patch tracking.
 * 
 * IMPORTANT: We use Zustand's built-in immer middleware to avoid
 * StoreMutators interface conflicts in v5.
 */

import { immer as zustandImmer } from 'zustand/middleware/immer'
import { applyPatches } from 'immer'
import type { Patch } from 'immer'
import type { StateCreator, StoreMutatorIdentifier } from 'zustand'
import equal from 'fast-deep-equal'

// Re-export Zustand's built-in immer middleware
export const immer = zustandImmer

export interface ImmerState {
  __immer_patches?: Patch[]
  __immer_inverse_patches?: Patch[]
}

// Configuration for patch history (used by utility functions)
// const MAX_PATCH_HISTORY = 10 // Keep only last 10 patches to prevent memory leak (currently unused)

/**
 * Safe performance.now() wrapper for cross-platform compatibility
 */
function getPerformanceNow(): number {
  if (typeof performance !== 'undefined' && performance.now) {
    return performance.now()
  }
  // Fallback to Date.now() for environments without performance API
  return Date.now()
}

// Export helper type for mutator chains - use Zustand's built-in types
export type WithImmerMutators<M extends [StoreMutatorIdentifier, unknown][]> = 
  [...M, ['zustand/immer', never]]

/**
 * Enhanced Immer utilities for patch tracking and performance monitoring
 * These work alongside Zustand's built-in immer middleware
 */

/**
 * Performance optimized selector that uses structural sharing
 */
export const createStructuralSelector = <T, U>(selector: (state: T) => U) => {
  let lastResult: U
  let lastState: T

  return (state: T): U => {
    if (state === lastState) {
      return lastResult
    }

    const result = selector(state)

    // Use structural comparison for complex objects
    if (typeof result === 'object' && result !== null) {
      if (equal(result, lastResult)) {
        return lastResult
      }
    }

    lastState = state
    lastResult = result
    return result
  }
}

/**
 * Batch multiple state updates for better performance
 */
export const batchUpdates = <T>(updates: Array<(draft: T) => void>) => {
  return (draft: T) => {
    updates.forEach((update) => update(draft))
  }
}

/**
 * Create a memoized state updater that prevents unnecessary updates
 */
export const createMemoizedUpdater = <T, Args extends unknown[]>(
  updater: (...args: Args) => (draft: T) => void,
  isEqual: (a: Args, b: Args) => boolean = equal
) => {
  let lastArgs: Args | undefined
  let memoizedUpdate: (draft: T) => void

  return (...args: Args) => {
    if (!lastArgs || !isEqual(args, lastArgs)) {
      memoizedUpdate = updater(...args)
      lastArgs = args
    }
    return memoizedUpdate
  }
}

/**
 * Utility to apply patches for time travel debugging
 */
export const applyStatePatches = <T>(state: T & ImmerState, patches: Patch[]): T => {
  return applyPatches(state, patches) as T
}

/**
 * Utility to revert state using inverse patches
 */
export const revertState = <T>(state: T & ImmerState): T => {
  if (state.__immer_inverse_patches?.length) {
    return applyPatches(state, state.__immer_inverse_patches) as T
  }
  return state
}

/**
 * Performance monitoring wrapper for stores using Zustand's immer middleware
 * This provides monitoring without interfering with the built-in middleware
 */
export const withPerformanceMonitoring = <T>(
  storeName: string,
  config: { enableLogging?: boolean; warnThreshold?: number } = {}
) => {
  const { enableLogging = false, warnThreshold = 16 } = config

  return (stateCreator: StateCreator<T, [], [], T>): StateCreator<T, [], [], T> => {
    return (set, get, store) => {
      // Zustand v5 compatible monitored set with proper overload handling
      function monitoredSet(partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: false | undefined): void
      function monitoredSet(state: T | ((state: T) => T), replace: true): void
      function monitoredSet(partial: T | Partial<T> | ((state: T) => T | Partial<T>), replace?: boolean): void {
        const startTime = getPerformanceNow()
        
        // Handle both overloads correctly
        let result: void
        if (replace === true) {
          // Full replacement overload
          result = set(partial as T | ((state: T) => T), replace)
        } else {
          // Partial update overload (replace is false | undefined)
          result = set(partial, replace as false | undefined)
        }
        
        const totalTime = getPerformanceNow() - startTime

        if (totalTime > warnThreshold) {
          console.warn(`[${storeName}] Slow state update detected: ${totalTime.toFixed(2)}ms`)
        }

        if (enableLogging) {
          console.log(`[${storeName}] State update completed in ${totalTime.toFixed(2)}ms`)
        }

        return result
      }

      return stateCreator(monitoredSet, get, store)
    }
  }
}

// Re-export the built-in immer middleware type
export type ImmerMiddleware = typeof zustandImmer
