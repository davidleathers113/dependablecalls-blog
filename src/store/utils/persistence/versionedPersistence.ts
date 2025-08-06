/**
 * Versioned Persistence Middleware - Phase 3.1b
 * Integrates with Zustand to provide automatic schema versioning and migrations
 * Works with the migration registry to handle backward compatibility
 */

import { type StateCreator, type StoreMutatorIdentifier } from 'zustand'
import { 
  migrate, 
  getLatestMigrationVersion, 
  type MigrationResult 
} from '../migrations/index'
import { 
  getLatestSchema, 
  validateWithSchema
} from '../schemas/index'

// Storage key format: 'dce-store-${storeName}-v${version}'
const STORAGE_KEY_PREFIX = 'dce-store'
const VERSION_SUFFIX = '-version'
const METADATA_SUFFIX = '-metadata'

export interface VersionedPersistenceOptions {
  /** The name of the store (must match schema registration) */
  storeName: string
  
  /** Storage implementation (defaults to localStorage) */
  storage?: {
    getItem: (name: string) => string | null | Promise<string | null>
    setItem: (name: string, value: string) => void | Promise<void>
    removeItem: (name: string) => void | Promise<void>
  }
  
  /** Custom serialization (defaults to JSON) */
  serialize?: (state: unknown) => string
  deserialize?: (str: string) => unknown
  
  /** Migration options */
  migrations?: {
    /** Auto-migrate to latest version (default: true) */
    autoMigrate: boolean
    /** Log migration operations (default: true in development) */
    logMigrations: boolean
    /** Fail on migration errors (default: true) */
    failOnMigrationError: boolean
    /** Backup old data before migration (default: true) */
    backupBeforeMigration: boolean
  }
  
  /** Fields to persist (if undefined, persists entire state) */
  persistedFields?: string[]
  
  /** Version validation */
  validation?: {
    /** Validate data on load (default: true in development) */
    validateOnLoad: boolean
    /** Validate data on save (default: true in development) */
    validateOnSave: boolean
    /** Strict validation mode (default: false) */
    strict: boolean
  }
  
  /** Performance options */
  performance?: {
    /** Debounce persistence operations (default: 100ms) */
    debounceMs: number
    /** Use compression for large states (default: false) */
    useCompression: boolean
    /** Maximum state size before warning (default: 1MB) */
    maxStateSizeBytes: number
  }
  
  /** Development options */
  development?: {
    /** Log all persistence operations (default: false) */
    verbose: boolean
    /** Include metadata in storage (default: true) */
    includeMetadata: boolean
  }
}

export interface VersionedPersistenceState {
  /** Current schema version */
  _version: number
  /** Migration history */
  _migrationHistory?: Array<{
    fromVersion: number
    toVersion: number
    timestamp: string
    success: boolean
    error?: string
  }>
  /** Last persistence timestamp */
  _lastPersisted?: string
  /** Store metadata */
  _metadata?: {
    storeName: string
    schemaVersion: number
    dataVersion: number
    createdAt: string
    updatedAt: string
  }
}

export interface VersionedPersistenceApi {
  /** Manually trigger persistence */
  persist: () => Promise<void>
  /** Manually trigger rehydration */
  rehydrate: () => Promise<void>
  /** Clear persisted data */
  clearPersisted: () => Promise<void>
  /** Get migration status */
  getMigrationStatus: () => {
    currentVersion: number
    latestVersion: number
    hasPendingMigrations: boolean
    migrationHistory: VersionedPersistenceState['_migrationHistory']
  }
  /** Force migration to specific version */
  migrateTo: (targetVersion: number) => Promise<MigrationResult>
}

// Default options
const defaultOptions: Partial<VersionedPersistenceOptions> = {
  storage: typeof window !== 'undefined' ? localStorage : undefined,
  serialize: JSON.stringify,
  deserialize: JSON.parse,
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
  performance: {
    debounceMs: 100,
    useCompression: false,
    maxStateSizeBytes: 1024 * 1024, // 1MB
  },
  development: {
    verbose: false,
    includeMetadata: true,
  },
}

// Utility functions
function getStorageKey(storeName: string, version?: number): string {
  const base = `${STORAGE_KEY_PREFIX}-${storeName}`
  return version ? `${base}-v${version}` : base
}

function getVersionKey(storeName: string): string {
  return `${STORAGE_KEY_PREFIX}-${storeName}${VERSION_SUFFIX}`
}

function getMetadataKey(storeName: string): string {
  return `${STORAGE_KEY_PREFIX}-${storeName}${METADATA_SUFFIX}`
}

function extractPersistedFields<T extends object>(
  state: T, 
  fields?: string[]
): Partial<T> {
  if (!fields || fields.length === 0) {
    return state
  }
  
  const result: Partial<T> = {}
  for (const field of fields) {
    if (field in state) {
      (result as Record<string, unknown>)[field] = (state as Record<string, unknown>)[field]
    }
  }
  return result
}

// Debounce utility
function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): T {
  let timeoutId: NodeJS.Timeout | undefined
  
  return ((...args: Parameters<T>) => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }) as T
}

/**
 * Versioned Persistence Middleware
 * Provides automatic schema versioning and migration for Zustand stores
 */
export const versionedPersistence = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  stateCreator: StateCreator<
    T & VersionedPersistenceState & VersionedPersistenceApi,
    Mps,
    Mcs,
    T
  >,
  options: VersionedPersistenceOptions
): StateCreator<
  T & VersionedPersistenceState & VersionedPersistenceApi,
  Mps,
  Mcs,
  T & VersionedPersistenceState & VersionedPersistenceApi
> => (set, get, api) => {
  const opts = { ...defaultOptions, ...options }
  const { storeName, storage, serialize, deserialize } = opts
  
  if (!storage) {
    console.warn(`⚠️ [${storeName}] No storage available, persistence disabled`)
    return {
      ...stateCreator(set, get, api),
      _version: 1,
      persist: async () => {},
      rehydrate: async () => {},
      clearPersisted: async () => {},
      getMigrationStatus: () => ({
        currentVersion: 1,
        latestVersion: 1,
        hasPendingMigrations: false,
        migrationHistory: [],
      }),
      migrateTo: async () => ({ success: true, migrationsApplied: [], version: 1 }),
    }
  }
  
  let isRehydrating = false
  
  // Create debounced persist function
  const debouncedPersist = debounce(async () => {
    if (isRehydrating) return
    
    const state = get()
    const persistedData = extractPersistedFields(state, opts.persistedFields)
    const currentVersion = state._version || 1
    
    // Validation on save
    if (opts.validation?.validateOnSave) {
      const schema = getLatestSchema(storeName)
      if (schema) {
        const validation = validateWithSchema(storeName, currentVersion, persistedData)
        if (!validation.success) {
          const errorMessage = validation.error.message
          if (opts.validation?.strict) {
            throw new Error(`Validation failed for ${storeName}: ${errorMessage}`)
          } else {
            console.warn(`⚠️ [${storeName}] Validation warning:`, errorMessage)
          }
        }
      }
    }
    
    // Size check
    const serialized = serialize!(persistedData)
    if (opts.performance?.maxStateSizeBytes && serialized.length > opts.performance.maxStateSizeBytes) {
      console.warn(`⚠️ [${storeName}] Large state detected: ${serialized.length} bytes`)
    }
    
    try {
      // Store data
      await storage.setItem(getStorageKey(storeName, currentVersion), serialized)
      
      // Store version
      await storage.setItem(getVersionKey(storeName), currentVersion.toString())
      
      // Store metadata if enabled
      if (opts.development?.includeMetadata) {
        const metadata = {
          storeName,
          schemaVersion: currentVersion,
          dataVersion: currentVersion,
          createdAt: state._metadata?.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        await storage.setItem(getMetadataKey(storeName), serialize!(metadata))
      }
      
      // Update state with persistence timestamp
      ;(set as (updater: (state: T & VersionedPersistenceState) => void) => void)((state: T & VersionedPersistenceState) => {
        state._lastPersisted = new Date().toISOString()
        return state
      })
      
      if (opts.development?.verbose) {
        console.log(`💾 [${storeName}] Persisted state (v${currentVersion})`)
      }
      
    } catch (error) {
      console.error(`❌ [${storeName}] Persistence failed:`, error)
    }
  }, opts.performance?.debounceMs || 100)
  
  // Rehydration function
  const rehydrate = async (): Promise<void> => {
    if (isRehydrating) return
    isRehydrating = true
    
    try {
      // Get stored version
      const storedVersionStr = await storage.getItem(getVersionKey(storeName))
      const storedVersion = storedVersionStr ? parseInt(storedVersionStr, 10) : 1
      const latestVersion = getLatestMigrationVersion(storeName) || 1
      
      if (opts.development?.verbose) {
        console.log(`🔄 [${storeName}] Rehydrating: stored v${storedVersion}, latest v${latestVersion}`)
      }
      
      // Load stored data
      const storedDataStr = await storage.getItem(getStorageKey(storeName, storedVersion))
      if (!storedDataStr) {
        if (opts.development?.verbose) {
          console.log(`📭 [${storeName}] No stored data found`)
        }
        return
      }
      
      let data = deserialize!(storedDataStr)
      
      // Apply migrations if needed
      if (storedVersion < latestVersion && opts.migrations?.autoMigrate) {
        if (opts.migrations?.backupBeforeMigration) {
          // Backup original data
          await storage.setItem(
            `${getStorageKey(storeName, storedVersion)}-backup-${Date.now()}`,
            storedDataStr
          )
        }
        
        const migrationResult = await migrate(storeName, data, storedVersion, latestVersion)
        
        if (migrationResult.success) {
          data = migrationResult.data
          
          // Update migration history
          const migrationHistory = [
            ...(get()._migrationHistory || []),
            {
              fromVersion: storedVersion,
              toVersion: latestVersion,
              timestamp: new Date().toISOString(),
              success: true,
            },
          ]
          
          ;(set as (updater: (state: T & VersionedPersistenceState) => void) => void)((state: T & VersionedPersistenceState) => {
            state._migrationHistory = migrationHistory
            return state
          })
          
          if (opts.migrations?.logMigrations) {
            console.log(`🔄 [${storeName}] Migrated from v${storedVersion} to v${latestVersion}`)
            console.log(`Applied migrations: ${migrationResult.migrationsApplied.join(', ')}`)
          }
          
        } else {
          const errorMsg = `Migration failed: ${migrationResult.error}`
          console.error(`❌ [${storeName}] ${errorMsg}`)
          
          if (opts.migrations?.failOnMigrationError) {
            throw new Error(errorMsg)
          }
          
          // Record failed migration
          const migrationHistory = [
            ...(get()._migrationHistory || []),
            {
              fromVersion: storedVersion,
              toVersion: latestVersion,
              timestamp: new Date().toISOString(),
              success: false,
              error: migrationResult.error,
            },
          ]
          
          ;(set as (updater: (state: T & VersionedPersistenceState) => void) => void)((state: T & VersionedPersistenceState) => {
            state._migrationHistory = migrationHistory
            return state
          })
          
          return // Don't apply failed migration data
        }
      }
      
      // Validation on load
      if (opts.validation?.validateOnLoad) {
        const targetVersion = Math.min(storedVersion, latestVersion)
        const validation = validateWithSchema(storeName, targetVersion, data)
        if (!validation.success) {
          const errorMessage = validation.error.message
          if (opts.validation?.strict) {
            throw new Error(`Validation failed for ${storeName}: ${errorMessage}`)
          } else {
            console.warn(`⚠️ [${storeName}] Validation warning:`, errorMessage)
          }
        }
      }
      
      // Apply rehydrated data to state
      // Ensure data is an object type before spreading
      const rehydratedData = (typeof data === 'object' && data !== null) ? data as Record<string, unknown> : {}
      ;(set as (updater: (state: T & VersionedPersistenceState) => void) => void)((state: T & VersionedPersistenceState) => {
        Object.assign(state, rehydratedData)
        state._version = latestVersion
        state._lastPersisted = new Date().toISOString()
        return state
      })
      
      if (opts.development?.verbose) {
        console.log(`✅ [${storeName}] Rehydration complete`)
      }
      
    } catch (error) {
      console.error(`❌ [${storeName}] Rehydration failed:`, error)
    } finally {
      isRehydrating = false
    }
  }
  
  // Clear persisted data
  const clearPersisted = async (): Promise<void> => {
    try {
      await storage.removeItem(getStorageKey(storeName))
      await storage.removeItem(getVersionKey(storeName))
      await storage.removeItem(getMetadataKey(storeName))
      
      if (opts.development?.verbose) {
        console.log(`🗑️ [${storeName}] Cleared persisted data`)
      }
    } catch (error) {
      console.error(`❌ [${storeName}] Failed to clear persisted data:`, error)
    }
  }
  
  // Get migration status
  const getMigrationStatus = () => {
    const state = get()
    const currentVersion = state._version || 1
    const latestVersion = getLatestMigrationVersion(storeName) || 1
    
    return {
      currentVersion,
      latestVersion,
      hasPendingMigrations: currentVersion < latestVersion,
      migrationHistory: state._migrationHistory || [],
    }
  }
  
  // Force migration to specific version
  const migrateTo = async (targetVersion: number): Promise<MigrationResult> => {
    const state = get()
    const currentVersion = state._version || 1
    const persistedData = extractPersistedFields(state, opts.persistedFields)
    
    const result = await migrate(storeName, persistedData, currentVersion, targetVersion)
    
    if (result.success) {
      // Ensure result.data is an object type before spreading
      const migrationData = (typeof result.data === 'object' && result.data !== null) ? result.data as Record<string, unknown> : {}
      ;(set as (updater: (state: T & VersionedPersistenceState) => void) => void)((state: T & VersionedPersistenceState) => {
        Object.assign(state, migrationData)
        state._version = targetVersion
        return state
      })
      
      await debouncedPersist() // Persist the migrated data
    }
    
    return result
  }
  
  // Initialize store with base state and persistence API
  const initialState = stateCreator(set, get, api)
  const latestVersion = getLatestMigrationVersion(storeName) || 1
  
  // Auto-rehydrate on initialization
  if (typeof window !== 'undefined') {
    setTimeout(() => rehydrate(), 0)
  }
  
  return {
    ...initialState,
    _version: latestVersion,
    _migrationHistory: [],
    _lastPersisted: undefined,
    _metadata: {
      storeName,
      schemaVersion: latestVersion,
      dataVersion: latestVersion,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    
    // Persistence API
    persist: debouncedPersist,
    rehydrate,
    clearPersisted,
    getMigrationStatus,
    migrateTo,
  }
}

// Export type for store creators
export type VersionedPersistenceMiddleware = typeof versionedPersistence

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  // Safely extend window object with proper typing
  interface WindowWithDCE extends Window {
    __dceVersionedPersistence?: {
      getStorageKey: typeof getStorageKey
      getVersionKey: typeof getVersionKey
      getMetadataKey: typeof getMetadataKey
      extractPersistedFields: typeof extractPersistedFields
    }
  }
  
  const windowWithDCE = window as WindowWithDCE
  windowWithDCE.__dceVersionedPersistence = {
    getStorageKey,
    getVersionKey,
    getMetadataKey,
    extractPersistedFields,
  }
}