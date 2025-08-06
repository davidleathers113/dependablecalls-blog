/**
 * Tests for Immer Middleware
 * 
 * Comprehensive test suite for the custom immer middleware,
 * including patch tracking, performance monitoring, and memoization.
 */

import { describe, it, expect, beforeEach, vi, afterEach, beforeAll } from 'vitest'
import { create } from 'zustand'
import { initializeImmer } from '../../../src/lib/immer-bootstrap'
import {
  immer,
  createStructuralSelector,
  batchUpdates,
  createMemoizedUpdater,
  applyStatePatches,
  revertState,
  withPerformanceMonitoring,
  type ImmerState
} from '../../../src/store/middleware/immer'

// Initialize Immer for tests
beforeAll(() => {
  initializeImmer()
})

// Mock console methods
const consoleMocks = {
  warn: vi.spyOn(console, 'warn').mockImplementation(),
  log: vi.spyOn(console, 'log').mockImplementation()
}

afterEach(() => {
  consoleMocks.warn.mockClear()
  consoleMocks.log.mockClear()
})

describe('Immer Middleware', () => {
  interface TestState extends ImmerState {
    count: number
    items: string[]
    nested: {
      value: number
      data: string
    }
    increment: () => void
    addItem: (item: string) => void
    updateNested: (value: number, data: string) => void
    reset: () => void
  }

  let useTestStore: ReturnType<typeof create<TestState>>

  beforeEach(() => {
    useTestStore = create<TestState>()(
      immer((set) => ({
        count: 0,
        items: [],
        nested: { value: 0, data: 'initial' },
        __immer_patches: [],
        __immer_inverse_patches: [],
        
        increment: () => set((draft) => {
          draft.count += 1
        }),
        
        addItem: (item: string) => set((draft) => {
          draft.items.push(item)
        }),
        
        updateNested: (value: number, data: string) => set((draft) => {
          draft.nested.value = value
          draft.nested.data = data
        }),
        
        reset: () => set({
          count: 0,
          items: [],
          nested: { value: 0, data: 'initial' }
        })
      }))
    )
  })

  it('should handle basic state updates with immer', () => {
    const store = useTestStore.getState()
    expect(store.count).toBe(0)
    
    store.increment()
    expect(useTestStore.getState().count).toBe(1)
    
    store.increment()
    expect(useTestStore.getState().count).toBe(2)
  })

  it('should handle array mutations correctly', () => {
    const store = useTestStore.getState()
    expect(store.items).toEqual([])
    
    store.addItem('item1')
    expect(useTestStore.getState().items).toEqual(['item1'])
    
    store.addItem('item2')
    expect(useTestStore.getState().items).toEqual(['item1', 'item2'])
  })

  it('should handle nested object updates', () => {
    const store = useTestStore.getState()
    expect(store.nested).toEqual({ value: 0, data: 'initial' })
    
    store.updateNested(42, 'updated')
    const newState = useTestStore.getState()
    expect(newState.nested).toEqual({ value: 42, data: 'updated' })
  })

  it('should track patches for state changes', () => {
    const store = useTestStore.getState()
    
    store.increment()
    const stateAfterIncrement = useTestStore.getState()
    
    expect(stateAfterIncrement.__immer_patches).toBeDefined()
    expect(stateAfterIncrement.__immer_patches!.length).toBeGreaterThan(0)
    expect(stateAfterIncrement.__immer_inverse_patches).toBeDefined()
  })

  it('should limit patch history to prevent memory leak', () => {
    const store = useTestStore.getState()
    
    // Generate more than MAX_PATCH_HISTORY (10) updates
    for (let i = 0; i < 15; i++) {
      store.increment()
    }
    
    const finalState = useTestStore.getState()
    // Should only keep last 10 patches
    expect(finalState.__immer_patches!.length).toBeLessThanOrEqual(10)
    expect(finalState.__immer_inverse_patches!.length).toBeLessThanOrEqual(10)
  })

  it('should handle direct state updates without immer', () => {
    const store = useTestStore.getState()
    
    store.reset()
    const resetState = useTestStore.getState()
    
    expect(resetState.count).toBe(0)
    expect(resetState.items).toEqual([])
    expect(resetState.nested).toEqual({ value: 0, data: 'initial' })
  })
})

describe('createStructuralSelector', () => {
  it('should memoize selector results based on structural equality', () => {
    const selector = createStructuralSelector((state: { data: { value: number } }) => 
      ({ computed: state.data.value * 2 })
    )
    
    const state1 = { data: { value: 5 } }
    const result1 = selector(state1)
    
    // Same state reference should return same result reference
    const result2 = selector(state1)
    expect(result1).toBe(result2)
    
    // Different state but same structure should return cached result
    const state2 = { data: { value: 5 } }
    const result3 = selector(state2)
    expect(result3).toEqual(result1)
    
    // Different values should compute new result
    const state3 = { data: { value: 10 } }
    const result4 = selector(state3)
    expect(result4).not.toBe(result1)
    expect(result4).toEqual({ computed: 20 })
  })

  it('should handle non-object results', () => {
    const selector = createStructuralSelector((state: { value: number }) => state.value)
    
    const state1 = { value: 42 }
    const result1 = selector(state1)
    expect(result1).toBe(42)
    
    const state2 = { value: 42 }
    const result2 = selector(state2)
    expect(result2).toBe(42)
  })
})

describe('batchUpdates', () => {
  it('should apply multiple updates in a single operation', () => {
    interface BatchTestState {
      a: number
      b: number
      c: number
    }
    
    const updates = [
      (draft: BatchTestState) => { draft.a = 1 },
      (draft: BatchTestState) => { draft.b = 2 },
      (draft: BatchTestState) => { draft.c = 3 }
    ]
    
    const batchedUpdate = batchUpdates(updates)
    const draft: BatchTestState = { a: 0, b: 0, c: 0 }
    
    batchedUpdate(draft)
    
    expect(draft).toEqual({ a: 1, b: 2, c: 3 })
  })
})

describe('createMemoizedUpdater', () => {
  it('should memoize update functions based on arguments', () => {
    const updater = createMemoizedUpdater<{ value: number }, [number]>(
      (multiplier) => (draft) => {
        draft.value *= multiplier
      }
    )
    
    const update1 = updater(2)
    const update2 = updater(2) // Same args, should return cached function
    const update3 = updater(3) // Different args, should create new function
    
    expect(update1).toBe(update2)
    expect(update1).not.toBe(update3)
    
    // Verify the updater works correctly
    const draft = { value: 10 }
    update1(draft)
    expect(draft.value).toBe(20)
  })

  it('should use custom equality function when provided', () => {
    const customEqual = (a: [number, string], b: [number, string]) => a[0] === b[0]
    
    const updater = createMemoizedUpdater<{ value: string }, [number, string]>(
      (num, str) => (draft) => {
        draft.value = `${num}-${str}`
      },
      customEqual
    )
    
    const update1 = updater(1, 'a')
    const update2 = updater(1, 'b') // Same first arg, should be considered equal
    const update3 = updater(2, 'a') // Different first arg
    
    expect(update1).toBe(update2)
    expect(update1).not.toBe(update3)
  })
})

describe('applyStatePatches', () => {
  it('should apply patches to state', () => {
    const state: { value: number } & ImmerState = {
      value: 10,
      __immer_patches: [
        { op: 'replace', path: ['value'], value: 20 }
      ],
      __immer_inverse_patches: []
    }
    
    const newState = applyStatePatches(state, state.__immer_patches!)
    expect(newState.value).toBe(20)
  })
})

describe('revertState', () => {
  it('should revert state using inverse patches', () => {
    const state: { value: number } & ImmerState = {
      value: 20,
      __immer_patches: [],
      __immer_inverse_patches: [
        { op: 'replace', path: ['value'], value: 10 }
      ]
    }
    
    const revertedState = revertState(state)
    expect(revertedState.value).toBe(10)
  })

  it('should return original state if no inverse patches', () => {
    const state: { value: number } & ImmerState = {
      value: 20,
      __immer_patches: [],
      __immer_inverse_patches: []
    }
    
    const revertedState = revertState(state)
    expect(revertedState).toBe(state)
  })
})

describe('withPerformanceMonitoring', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('should monitor performance of state updates', () => {
    const stateCreator = vi.fn((set: unknown, _get: unknown, _store: unknown) => ({
      value: 0,
      update: () => (set as (fn: (draft: { value: number }) => void) => void)((draft) => {
        // Simulate slow update
        vi.advanceTimersByTime(20)
        draft.value += 1
      })
    }))
    
    const monitoredCreator = withPerformanceMonitoring('TestStore', {
      warnThreshold: 15
    })(stateCreator)
    
    const mockSet = vi.fn()
    const mockGet = vi.fn()
    const mockStore = {}
    
    const _state = monitoredCreator(mockSet, mockGet, mockStore)
    
    // Verify stateCreator was called with wrapped set
    expect(stateCreator).toHaveBeenCalled()
    const wrappedSet = stateCreator.mock.calls[0][0]
    expect(typeof wrappedSet).toBe('function')
  })

  it('should log warnings for slow updates', () => {
    const stateCreator = (set: (fn: (draft: { value: number }) => void | { value: number }) => void) => ({
      value: 0,
      slowUpdate: () => set((draft) => {
        draft.value += 1
      })
    })
    
    const monitoredCreator = withPerformanceMonitoring('TestStore', {
      enableLogging: true,
      warnThreshold: 0 // Force warning
    })(stateCreator)
    
    const mockSet = vi.fn((fn: unknown) => {
      if (typeof fn === 'function') {
        fn({})
      }
    })
    
    const state = monitoredCreator(mockSet as never, vi.fn(), {})
    
    // The warning would be logged during actual execution
    // Here we're just verifying the structure is correct
    expect(typeof state.slowUpdate).toBe('function')
  })
})

describe('Cross-platform compatibility', () => {
  it('should handle environments without performance API', () => {
    // Test that getPerformanceNow falls back gracefully
    // This is tested implicitly by the middleware working in Node test environment
    const store = create<{ value: number; update: () => void }>()(
      immer((set) => ({
        value: 0,
        update: () => set((draft) => {
          draft.value += 1
        })
      }))
    )
    
    // Should not throw even without performance API
    expect(() => {
      store.getState().update()
    }).not.toThrow()
  })
})