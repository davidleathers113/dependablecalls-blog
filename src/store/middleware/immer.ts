/**
 * Phase 4 Performance Optimization: Immer Middleware
 * 
 * This middleware integrates Immer for immutable updates with structural sharing,
 * reducing unnecessary re-renders and improving performance through efficient
 * state updates.
 */

import { produce, enableMapSet, enablePatches, Patch, applyPatches } from 'immer'
import type { StateCreator, StoreMutatorIdentifier } from 'zustand'

// Enable additional Immer features
enableMapSet()
enablePatches()

export interface ImmerState {
  __immer_patches?: Patch[]
  __immer_inverse_patches?: Patch[]
}

// StoreMutators declaration moved to resourceCleanup.ts to avoid conflicts
// declare module 'zustand/vanilla' {
//   interface StoreMutators<S, A, T, U> {
//     'zustand/immer': WithImmer<S>
//   }
// }

type WithImmer<S> = S extends { getState: () => infer T; setState: infer SetState }
  ? S & {
      setState: SetState extends (...a: unknown[]) => infer Sr
        ? (
            partial: T | Partial<T> | ((draft: T) => void),
            replace?: boolean | undefined
          ) => Sr
        : never
    }
  : never

type ImmerStateCreator<T> = StateCreator<
  T,
  [StoreMutatorIdentifier, unknown][],
  [],
  T
>

/**
 * Enhanced Immer middleware with performance optimizations
 */
export const immer = <T>(
  initializer: ImmerStateCreator<T>
): StateCreator<T, [], [], T & ImmerState> => {
  return (set, get, store) => {
    type T_WithImmer = T & ImmerState
    
    // Enhanced setState with immer and patch tracking
    const setState = (
      partial: T_WithImmer | Partial<T_WithImmer> | ((draft: T_WithImmer) => void),
      replace?: boolean | undefined
    ) => {
      if (typeof partial === 'function') {
        // Use immer for function updates with patch tracking
        const currentState = get() as T_WithImmer
        let patches: Patch[] = []
        let inversePatches: Patch[] = []
        
        const nextState = produce(
          currentState,
          partial as (draft: T_WithImmer) => void,
          (p, ip) => {
            patches = p
            inversePatches = ip
          }
        )
        
        // Only update if there are actual changes
        if (patches.length > 0) {
          const stateWithPatches = {
            ...nextState,
            __immer_patches: patches,
            __immer_inverse_patches: inversePatches,
          }
          
          // Use the original set function
          const originalSet = store.setState as typeof set
          originalSet(stateWithPatches, replace)
          
          // Emit patch events for debugging/time travel
          if (process.env.NODE_ENV === 'development') {
            store.dispatchEvent?.(new CustomEvent('immer-patches', {
              detail: { patches, inversePatches }
            }))
          }
        }
      } else {
        // Direct state updates
        const originalSet = store.setState as typeof set
        originalSet(partial, replace)
      }
    }

    // Initialize state with immer support
    const initialState = initializer(setState, get, store)
    
    return {
      ...initialState,
      __immer_patches: [],
      __immer_inverse_patches: [],
    } as T_WithImmer
  }
}

/**
 * Performance optimized selector that uses structural sharing
 */
export const createStructuralSelector = <T, U>(
  selector: (state: T) => U
) => {
  let lastResult: U
  let lastState: T
  
  return (state: T): U => {
    if (state === lastState) {
      return lastResult
    }
    
    const result = selector(state)
    
    // Use structural comparison for complex objects
    if (typeof result === 'object' && result !== null) {
      if (JSON.stringify(result) === JSON.stringify(lastResult)) {
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
export const batchUpdates = <T>(
  updates: Array<(draft: T) => void>
) => {
  return (draft: T) => {
    updates.forEach(update => update(draft))
  }
}

/**
 * Create a memoized state updater that prevents unnecessary updates
 */
export const createMemoizedUpdater = <T, Args extends unknown[]>(
  updater: (...args: Args) => (draft: T) => void,
  isEqual: (a: Args, b: Args) => boolean = (a, b) => JSON.stringify(a) === JSON.stringify(b)
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
export const applyStatePatches = <T>(
  state: T & ImmerState,
  patches: Patch[]
): T => {
  return applyPatches(state, patches) as T
}

/**
 * Utility to revert state using inverse patches
 */
export const revertState = <T>(
  state: T & ImmerState
): T => {
  if (state.__immer_inverse_patches?.length) {
    return applyPatches(state, state.__immer_inverse_patches) as T
  }
  return state
}

/**
 * Performance monitoring decorator for immer updates
 */
export const withPerformanceMonitoring = <T>(
  storeName: string,
  config: { enableLogging?: boolean; warnThreshold?: number } = {}
) => {
  const { enableLogging = false, warnThreshold = 16 } = config
  
  return (stateCreator: ImmerStateCreator<T>): ImmerStateCreator<T> => {
    return (set, get, store) => {
      const wrappedSet = (
        partial: T | Partial<T> | ((draft: T) => void),
        replace?: boolean
      ) => {
        const startTime = performance.now()
        
        if (typeof partial === 'function') {
          set((draft) => {
            const updateStart = performance.now()
            partial(draft as T)
            const updateTime = performance.now() - updateStart
            
            if (updateTime > warnThreshold) {
              console.warn(
                `[${storeName}] Slow immer update detected: ${updateTime.toFixed(2)}ms`
              )
            }
            
            if (enableLogging) {
              console.log(
                `[${storeName}] State update completed in ${updateTime.toFixed(2)}ms`
              )
            }
          }, replace)
        } else {
          set(partial, replace)
        }
        
        const totalTime = performance.now() - startTime
        
        if (totalTime > warnThreshold) {
          console.warn(
            `[${storeName}] Slow state update detected: ${totalTime.toFixed(2)}ms`
          )
        }
      }
      
      return stateCreator(wrappedSet, get, store)
    }
  }
}

export type ImmerMiddleware = typeof immer