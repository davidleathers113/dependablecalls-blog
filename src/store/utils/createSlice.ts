// Utility for creating Zustand slices with consistent patterns
import type { StateCreator } from 'zustand'

export interface LoadingState {
  isLoading: boolean
  error: string | null
}

export interface BaseSlice {
  loading: LoadingState
  reset: () => void
}

// Create base actions for common slice patterns
export function createBaseActions() {
  return {
    setLoading: (isLoading: boolean) => ({ loading: { isLoading, error: null } }),
    setError: (error: string | null) => ({ loading: { isLoading: false, error } }),
    clearError: () => ({ loading: { isLoading: false, error: null } }),
  }
}

// Create a slice with base functionality
export function createSlice<T extends BaseSlice>(
  initialState: Omit<T, keyof BaseSlice>,
  actions: Record<string, unknown>
): StateCreator<T, [], [], T> {
  return (set, _get) => ({
    ...initialState,
    loading: { isLoading: false, error: null },
    reset: () => set(initialState as T),
    ...createBaseActions(),
    ...actions,
  } as T)
}