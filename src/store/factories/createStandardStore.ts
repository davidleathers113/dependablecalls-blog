/**
 * Standard Store Factory
 * 
 * This factory creates Zustand stores with a consistent middleware chain
 * to resolve TypeScript type conflicts and ensure predictable behavior.
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import { devtools } from 'zustand/middleware'
import { subscribeWithSelector } from 'zustand/middleware'
import { persist, type PersistOptions } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import type { 
  StoreConfig, 
  StandardStoreConfig,
  StandardMutators,
  LightweightMutators
} from '../types/mutators'
import { isLightweightConfig } from '../types/mutators'

// Import our custom monitoring middleware if available

let createMonitoringMiddleware: (<T>(config: unknown) => (f: StateCreator<T, [], [], T>) => StateCreator<T, [], [], T>) | undefined
try {
  // Dynamic import to avoid circular dependencies
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const monitoringModule = require('../utils/monitoringIntegration')
  createMonitoringMiddleware = monitoringModule.createMonitoringMiddleware
} catch {
  // Monitoring middleware not available yet
}

/**
 * Creates a standardized Zustand store with consistent middleware ordering
 * 
 * @param config Store configuration
 * @returns Zustand store hook
 */
export function createStandardStore<T>(config: StoreConfig<T>) {
  // Lightweight stores skip most middleware
  if (isLightweightConfig(config)) {
    return create<T>()(
      immer(config.creator)
    )
  }

  // Standard stores use the full middleware chain
  const standardConfig = config as StandardStoreConfig<T>
  
  // Build middleware chain from inside out with proper typing
  // Correct order: immer (innermost) → subscribeWithSelector → persist → devtools (outermost)
  
  // Apply middleware in the correct order for type compatibility
  let storeCreator = standardConfig.creator

  // Apply immer for immutable updates (innermost)
  storeCreator = immer(storeCreator)

  // Apply subscribeWithSelector for granular subscriptions
  storeCreator = subscribeWithSelector(storeCreator)

  // Apply persist middleware if configured
  if (standardConfig.persist) {
    storeCreator = persist(storeCreator, {
      name: `${standardConfig.name}-storage`,
      ...standardConfig.persist,
    })
  }

  // Apply devtools in development (outermost)
  if (process.env.NODE_ENV === 'development') {
    storeCreator = devtools(storeCreator, {
      name: standardConfig.name,
      enabled: true,
      ...standardConfig.devtools,
    })
  }

  // Apply monitoring in development if available and enabled
  if (
    process.env.NODE_ENV === 'development' &&
    createMonitoringMiddleware &&
    standardConfig.monitoring?.enabled !== false
  ) {
    storeCreator = createMonitoringMiddleware({
      name: standardConfig.name,
      enabled: true,
      options: {
        trackPerformance: standardConfig.monitoring?.trackPerformance ?? true,
        trackStateChanges: standardConfig.monitoring?.trackStateChanges ?? true,
        trackSelectors: false, // Too noisy for most stores
        enableTimeTravel: false, // Memory intensive
        maxHistorySize: 100,
      },
    })(storeCreator)
  }

  // Create the store with the built middleware chain
  return create<T>()(storeCreator)
}

/**
 * Helper to migrate an existing store to the standard factory pattern
 * This allows incremental migration without breaking existing code
 */
export function migrateToStandardStore<T>(
  existingStore: ReturnType<typeof create<T>>,
  config: StoreConfig<T>
): ReturnType<typeof create<T>> {
  // If feature flag is off, return existing store
  if (process.env.VITE_USE_STANDARD_STORE !== 'true') {
    return existingStore
  }

  // Otherwise, create new standard store
  return createStandardStore(config)
}

// Export convenience creators for common patterns
export const createUIStore = <T>(
  name: string, 
  creator: StateCreator<T, LightweightMutators, [], T>
) =>
  createStandardStore<T>({
    name,
    creator,
    lightweight: true,
  })

export const createDataStore = <T>(
  name: string,
  creator: StateCreator<T, StandardMutators, [], T>,
  persistConfig?: Omit<PersistOptions<T>, 'name'>
) =>
  createStandardStore<T>({
    name,
    creator,
    persist: persistConfig,
    monitoring: {
      enabled: true,
      trackPerformance: true,
    },
  })

export const createAuthStore = <T>(
  name: string,
  creator: StateCreator<T, StandardMutators, [], T>,
  persistConfig?: Omit<PersistOptions<T>, 'name'>
) =>
  createStandardStore<T>({
    name,
    creator,
    persist: persistConfig,
    monitoring: {
      enabled: true,
      trackPerformance: true,
      trackStateChanges: true,
    },
    devtools: {
      trace: true, // Enable action tracing for auth debugging
      // SECURITY: Sanitize sensitive data from DevTools
      stateSanitizer: (state: T): T => {
        const authState = state as unknown as { 
          session?: { id?: string; expires_at?: string } 
        }
        return {
          ...state,
          session: authState.session 
            ? { 
                id: authState.session.id, 
                expires_at: authState.session.expires_at 
              } 
            : null,
          // Never expose tokens or sensitive session data
        } as T
      },
    },
  })