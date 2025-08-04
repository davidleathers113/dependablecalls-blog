/**
 * Middleware Index - Phase 3.1b
 * Exports all middleware components for easy consumption
 */

// Versioned Persistence Middleware
export {
  versionedPersistence,
  type VersionedPersistenceOptions,
  type VersionedPersistenceState,
  type VersionedPersistenceApi,
  type VersionedPersistenceMiddleware,
} from '../persistence/versionedPersistence'

// Runtime Validation Middleware
export {
  runtimeValidation,
  type RuntimeValidationOptions,
  type RuntimeValidationState,
  type RuntimeValidationApi,
  type RuntimeValidationMiddleware,
  type ValidationResult,
  type PIIScanResult,
} from './runtimeValidation'

// Combined middleware configuration helper
export interface DCEStoreMiddlewareConfig {
  storeName: string
  persistence?: {
    enabled: boolean
    options?: Partial<import('../persistence/versionedPersistence').VersionedPersistenceOptions>
  }
  validation?: {
    enabled: boolean
    options?: Partial<import('./runtimeValidation').RuntimeValidationOptions>
  }
}

/**
 * Helper function to create standardized middleware configuration
 * for DCE stores with consistent defaults
 */
export function createDCEStoreConfig(
  storeName: string,
  config?: Partial<DCEStoreMiddlewareConfig>
): DCEStoreMiddlewareConfig {
  return {
    storeName,
    persistence: {
      enabled: true,
      options: {
        storeName,
        migrations: {
          autoMigrate: true,
          logMigrations: process.env.NODE_ENV === 'development',
          failOnMigrationError: true,
          backupBeforeMigration: true,
        },
        validation: {
          validateOnLoad: process.env.NODE_ENV === 'development',
          validateOnSave: process.env.NODE_ENV === 'development',
          strict: false,
        },
        ...config?.persistence?.options,
      },
      ...config?.persistence,
    },
    validation: {
      enabled: process.env.NODE_ENV === 'development',
      options: {
        storeName,
        triggers: {
          onChange: true,
          onInit: true,
          beforePersist: true,
          afterRehydrate: true,
        },
        behavior: {
          throwOnError: false,
          logToConsole: true,
          includeStackTrace: process.env.NODE_ENV === 'development',
          debounceMs: 100,
        },
        security: {
          scanForPII: process.env.NODE_ENV === 'development',
          piiScanTrigger: 'onChange',
          reportPII: true,
          throwOnPII: false,
        },
        ...config?.validation?.options,
      },
      ...config?.validation,
    },
    ...config,
  }
}

// Development utilities interface
interface DCEMiddlewareDev {
  createDCEStoreConfig: typeof createDCEStoreConfig
}

// Extend global Window interface for development utilities
declare global {
  interface Window {
    __dceMiddleware?: DCEMiddlewareDev
  }
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  window.__dceMiddleware = {
    createDCEStoreConfig,
  }
}
