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
import type { 
  StoreConfig, 
  StandardStoreConfig,
  StandardStateCreator,
  LightweightStateCreator
} from '../types/mutators'
import { isLightweightConfig } from '../types/mutators'

// Middleware composition types for Zustand v5
// Note: In v5, StateCreator parameters are: <T, Mutators, Composers, Result>
// where Mutators = [] and Composers contain the middleware chain

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
  
  // Create devtools configuration
  const devtoolsConfig = process.env.NODE_ENV === 'development' ? {
    name: standardConfig.name,
    enabled: true,
    ...standardConfig.devtools,
  } : null
  
  // Create persist configuration  
  const persistConfig = standardConfig.persist ? {
    name: `${standardConfig.name}-storage`,
    ...standardConfig.persist,
  } : null
  
  // Compose middleware following Zustand 5.0 pattern: devtools → persist → subscribeWithSelector → immer
  
  if (devtoolsConfig && persistConfig) {
    // Full middleware chain: devtools + persist + subscribeWithSelector + immer
    return create<T>()(
      devtools(
        persist(
          subscribeWithSelector(
            immer(standardConfig.creator)
          ),
          persistConfig
        ),
        devtoolsConfig
      )
    )
  }
  
  if (devtoolsConfig && !persistConfig) {
    // No persistence: devtools + subscribeWithSelector + immer
    return create<T>()(
      devtools(
        subscribeWithSelector(
          immer(standardConfig.creator)
        ),
        devtoolsConfig
      )
    )
  }
  
  if (!devtoolsConfig && persistConfig) {
    // No devtools: persist + subscribeWithSelector + immer
    return create<T>()(
      persist(
        subscribeWithSelector(
          immer(standardConfig.creator)
        ),
        persistConfig
      )
    )
  }
  
  // Minimal: just subscribeWithSelector + immer
  return create<T>()(
    subscribeWithSelector(
      immer(standardConfig.creator)
    )
  )
}

/**
 * Helper to migrate an existing store to the standard factory pattern
 * This allows incremental migration without breaking existing code
 */
export function migrateToStandardStore<T>(
  existingStore: () => T,
  config: StoreConfig<T>
): () => T {
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
  creator: LightweightStateCreator<T>
) =>
  createStandardStore<T>({
    name,
    creator,
    lightweight: true,
  })

export const createDataStore = <T>(
  name: string,
  creator: StandardStateCreator<T>,
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
  creator: StandardStateCreator<T>,
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