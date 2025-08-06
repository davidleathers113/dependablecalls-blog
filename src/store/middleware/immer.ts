/**
 * Phase 4 Performance Optimization: Immer Middleware
 *
 * This middleware integrates Immer for immutable updates with structural sharing,
 * reducing unnecessary re-renders and improving performance through efficient
 * state updates.
 *
 * Compatible with Zustand v5's strict setState overload system.
 */

import { produce, applyPatches } from 'immer'
import type { Patch, Draft } from 'immer'
import type { StateCreator, StoreMutatorIdentifier } from 'zustand'
import equal from 'fast-deep-equal'

export interface ImmerState {
  __immer_patches?: Patch[]
  __immer_inverse_patches?: Patch[]
}

// Configuration for patch history
const MAX_PATCH_HISTORY = 10 // Keep only last 10 patches to prevent memory leak

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

// Store mutator types for Zustand v5 compatibility
declare module 'zustand/vanilla' {
  interface StoreMutators<S, _> {
    'zustand/immer': WithImmer<S>
  }
}

// Enhanced type system for Zustand v5 compatibility
type WithImmer<S> = S extends {
  setState: (...args: unknown[]) => infer Sr
}
  ? S & {
      setState(
        nextStateOrUpdater: S | Partial<S> | ((state: Draft<S>) => void),
        shouldReplace?: boolean | undefined
      ): Sr
    }
  : S

/**
 * Enhanced Immer middleware with performance optimizations and Zustand v5 compatibility
 */
export const immer = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  initializer: StateCreator<T, [...Mps, ['zustand/immer', never]], Mcs>
): StateCreator<T, Mps, [['zustand/immer', never], ...Mcs]> => {
  return (set, get, store) => {
    type T_WithImmer = T & ImmerState

    // Create Immer-enhanced setState that works with Zustand v5
    const immerSetState = (
      partial: T_WithImmer | Partial<T_WithImmer> | ((draft: Draft<T_WithImmer>) => void),
      replace?: boolean | undefined
    ): void => {
      if (typeof partial === 'function') {
        // Use immer for function updates with patch tracking
        const currentState = get() as T_WithImmer
        let patches: Patch[] = []
        let inversePatches: Patch[] = []

        const nextState = produce(
          currentState,
          partial as (draft: Draft<T_WithImmer>) => void,
          (p, ip) => {
            patches = p
            inversePatches = ip
          }
        )

        // Only update if there are actual changes
        if (patches.length > 0) {
          // Rotate patch history to prevent memory leak
          const existingPatches = nextState.__immer_patches || []
          const existingInversePatches = nextState.__immer_inverse_patches || []

          const stateWithPatches: T_WithImmer = {
            ...nextState,
            __immer_patches: [...existingPatches, ...patches].slice(-MAX_PATCH_HISTORY),
            __immer_inverse_patches: [...existingInversePatches, ...inversePatches].slice(
              -MAX_PATCH_HISTORY
            ),
          }

          // Use the original set with proper typing
          if (replace === true) {
            set(stateWithPatches as T, true)
          } else {
            set(stateWithPatches as T | Partial<T>, false)
          }
        }
      } else {
        // Direct state updates
        if (replace === true) {
          set(partial as T, true)
        } else {
          set(partial as T | Partial<T>, false)
        }
      }
    }

    // Initialize state with immer support and proper typing
    const initialState = initializer(
      immerSetState as Parameters<typeof initializer>[0],
      get as unknown as Parameters<typeof initializer>[1],
      store as unknown as Parameters<typeof initializer>[2]
    )

    return {
      ...initialState,
      __immer_patches: [],
      __immer_inverse_patches: [],
    } as T & ImmerState
  }
}

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
 * Performance monitoring decorator for immer updates with Zustand v5 compatibility
 */
export const withPerformanceMonitoring = <
  T,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = [],
>(
  storeName: string,
  config: { enableLogging?: boolean; warnThreshold?: number } = {}
) => {
  const { enableLogging = false, warnThreshold = 16 } = config

  return (
    stateCreator: StateCreator<T, [...Mps, ['zustand/immer', never]], Mcs>
  ): StateCreator<T, [...Mps, ['zustand/immer', never]], Mcs> => {
    return (set, get, store) => {
      // Create properly typed monitored setState
      const monitoredSetState = (
        partial: T | Partial<T> | ((draft: Draft<T>) => void),
        replace?: boolean | undefined
      ): void => {
        const startTime = getPerformanceNow()

        if (typeof partial === 'function') {
          // Handle function updates with performance monitoring
          const wrappedUpdate = (draft: Draft<T>) => {
            const updateStart = getPerformanceNow()
            ;(partial as (draft: Draft<T>) => void)(draft)
            const updateTime = getPerformanceNow() - updateStart

            if (updateTime > warnThreshold) {
              console.warn(`[${storeName}] Slow immer update detected: ${updateTime.toFixed(2)}ms`)
            }

            if (enableLogging) {
              console.log(`[${storeName}] State update completed in ${updateTime.toFixed(2)}ms`)
            }
          }

          if (replace === true) {
            set(wrappedUpdate as T | ((state: T) => T), replace)
          } else {
            set(wrappedUpdate as T | Partial<T> | ((state: T) => T | Partial<T>), replace || false)
          }
        } else {
          // Handle direct state updates
          if (replace === true) {
            set(partial as T | ((state: T) => T), replace)
          } else {
            set(partial as T | Partial<T>, replace || false)
          }
        }

        const totalTime = getPerformanceNow() - startTime

        if (totalTime > warnThreshold) {
          console.warn(`[${storeName}] Slow state update detected: ${totalTime.toFixed(2)}ms`)
        }
      }

      return stateCreator(monitoredSetState as Parameters<typeof stateCreator>[0], get, store)
    }
  }
}

export type ImmerMiddleware = typeof immer
