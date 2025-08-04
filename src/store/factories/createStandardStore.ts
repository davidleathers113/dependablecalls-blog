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
import { persist } from 'zustand/middleware'
import type { 
  StoreConfig, 
  StandardStoreConfig,
  LightweightStoreConfig,
  recordStoreUpdate
} from '../types/mutators'
import { isLightweightConfig } from '../types/mutators'

// Import our custom monitoring middleware if available
let createMonitoringMiddleware: any
try {
  // Dynamic import to avoid circular dependencies
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
  
  // Build middleware chain from inside out
  let middleware = standardConfig.creator

  // Apply persist middleware if configured
  if (standardConfig.persist) {
    middleware = persist(middleware as any, {
      name: `${standardConfig.name}-storage`,
      ...standardConfig.persist,
    }) as any
  }

  // Apply subscribeWithSelector for granular subscriptions
  middleware = subscribeWithSelector(middleware as any) as any

  // Apply devtools in development
  if (process.env.NODE_ENV === 'development') {
    middleware = devtools(middleware as any, {
      name: standardConfig.name,
      enabled: true,
      ...standardConfig.devtools,
    }) as any
  }

  // Apply immer for immutable updates
  middleware = immer(middleware as any) as any

  // Apply monitoring in development if available and enabled
  if (
    process.env.NODE_ENV === 'development' &&
    createMonitoringMiddleware &&
    standardConfig.monitoring?.enabled !== false
  ) {
    middleware = createMonitoringMiddleware({
      name: standardConfig.name,
      enabled: true,
      options: {
        trackPerformance: standardConfig.monitoring?.trackPerformance ?? true,
        trackStateChanges: standardConfig.monitoring?.trackStateChanges ?? true,
        trackSelectors: false, // Too noisy for most stores
        enableTimeTravel: false, // Memory intensive
        maxHistorySize: 100,
      },
    })(middleware as any) as any
  }

  // Create the store with the built middleware chain
  return create<T>()(middleware as any)
}

/**
 * Helper to migrate an existing store to the standard factory pattern
 * This allows incremental migration without breaking existing code
 */
export function migrateToStandardStore<T>(
  existingStore: any,
  config: StoreConfig<T>
): any {
  // If feature flag is off, return existing store
  if (import.meta.env.VITE_USE_STANDARD_STORE !== 'true') {
    return existingStore
  }

  // Otherwise, create new standard store
  return createStandardStore(config)
}

// Export convenience creators for common patterns
export const createUIStore = <T>(name: string, creator: any) =>
  createStandardStore<T>({
    name,
    creator,
    lightweight: true,
  })

export const createDataStore = <T>(
  name: string,
  creator: any,
  persistConfig?: any
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
  creator: any,
  persistConfig?: any
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
    },
  })