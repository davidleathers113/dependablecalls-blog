/**
 * Phase 3.1d - Storage Architecture Index
 * 
 * Main entry point for the unified storage architecture system
 * Exports all storage management functionality with consistent API
 */

// Core storage manager
export {
  StorageManager,
  storageManager,
  createStorageConfig,
  generateStorageKey,
  type StorageConfig
} from './storageManager'

// Key migration system
export {
  KeyMigrationManager,
  keyMigrationManager,
  migrateAllStorageKeys,
  previewStorageMigration,
  hasLegacyStorageKeys,
  getExistingLegacyKeys,
  type MigrationResult,
  type MigrationConfig
} from './keyMigration'

// Namespace isolation
export {
  NamespaceIsolationManager,
  namespaceIsolation,
  withNamespace,
  createIsolatedContext,
  IsolationLevel,
  type NamespaceConfig,
  type NamespaceContext
} from './namespaceIsolation'

// Storage cleanup
export {
  StorageCleanupManager,
  storageCleanup,
  cleanupStorage,
  getStorageHealth,
  previewStorageCleanup,
  type CleanupResult,
  type CleanupConfig,
  type StorageHealthMetrics
} from './cleanup'

// Utility functions for common storage operations
import { storageManager } from './storageManager'
import { keyMigrationManager } from './keyMigration'
import { namespaceIsolation } from './namespaceIsolation'
import { storageCleanup } from './cleanup'

/**
 * Initialize the storage architecture system
 * Should be called once during application startup
 */
export async function initializeStorageArchitecture(options?: {
  autoMigrate?: boolean
  autoCleanup?: boolean
  verbose?: boolean
}): Promise<{
  migrationResults?: import('./keyMigration').MigrationResult[]
  cleanupResults?: import('./cleanup').CleanupResult[]
  healthMetrics: import('./cleanup').StorageHealthMetrics
}> {
  const { autoMigrate = true, autoCleanup = false, verbose = false } = options || {}

  if (verbose) {
    console.log('🚀 Initializing DCE Storage Architecture...')
  }

  const result: {
    migrationResults?: import('./keyMigration').MigrationResult[]
    cleanupResults?: import('./cleanup').CleanupResult[]
    healthMetrics: import('./cleanup').StorageHealthMetrics
  } = {
    healthMetrics: await storageCleanup.getHealthMetrics()
  }

  // Auto-migrate legacy keys if enabled
  if (autoMigrate && keyMigrationManager.hasLegacyKeys()) {
    if (verbose) {
      console.log('🔄 Auto-migrating legacy storage keys...')
    }
    result.migrationResults = await keyMigrationManager.migrateAllKeys({
      verbose,
      validateData: true,
      keepLegacyKeys: true // Keep for safety during initial rollout
    })
  }

  // Auto-cleanup if enabled
  if (autoCleanup) {
    if (verbose) {
      console.log('🧹 Auto-cleaning storage...')
    }
    result.cleanupResults = await storageCleanup.performCleanup({
      verbose,
      removeOrphaned: true,
      removeExpired: true,
      removeLegacy: false, // Don't auto-remove legacy keys yet
      removeInvalid: false // Don't auto-remove invalid data yet
    })
  }

  // Update health metrics after initialization
  result.healthMetrics = await storageCleanup.getHealthMetrics()

  if (verbose) {
    console.log(`✅ Storage Architecture initialized (Health Score: ${result.healthMetrics.healthScore}/100)`)
  }

  return result
}

/**
 * Create a modernized Zustand persist configuration
 * Uses the new storage architecture with consistent naming
 */
export function createModernPersistConfig<T>(
  storeName: string,
  options?: {
    version?: number
    namespace?: string
    partialize?: (state: T) => Partial<T>
    onRehydrateStorage?: (state: T) => void
    skipHydration?: boolean
  }
) {
  return storageManager.createPersistConfig({
    storeName,
    version: options?.version,
    namespace: options?.namespace,
    partialize: options?.partialize,
    onRehydrateStorage: options?.onRehydrateStorage,
    skipHydration: options?.skipHydration
  })
}

/**
 * Get comprehensive storage status for debugging/monitoring
 */
export async function getStorageStatus(): Promise<{
  health: import('./cleanup').StorageHealthMetrics
  registeredKeys: Array<{
    key: string
    storeName: string
    version: number
    namespace?: string
    size: number
  }>
  activeKeys: string[]
  legacyKeys: string[]
  namespaces: string[]
}> {
  const health = await storageCleanup.getHealthMetrics()
  const registeredKeys = storageManager.getAllKeys().map(key => ({
    key: key.fullKey,
    storeName: key.storeName,
    version: key.version,
    namespace: key.namespace,
    size: localStorage.getItem(key.fullKey)?.length || 0
  }))
  const activeKeys = storageManager.getActiveKeys()
  const legacyKeys = keyMigrationManager.getExistingLegacyKeys()
  const namespaces = Object.keys(namespaceIsolation.getRegisteredNamespaces())

  return {
    health,
    registeredKeys,
    activeKeys,
    legacyKeys,
    namespaces
  }
}

/**
 * Perform a complete storage audit and report issues
 */
export async function auditStorage(): Promise<{
  issues: Array<{
    type: 'orphaned' | 'legacy' | 'invalid' | 'oversized' | 'expired'
    key: string
    description: string
    severity: 'low' | 'medium' | 'high'
    recommendation: string
  }>
  summary: {
    totalIssues: number
    highSeverity: number
    mediumSeverity: number
    lowSeverity: number
  }
}> {
  const previewCleanup = await storageCleanup.performCleanup({ dryRun: true })
  
  const issues = previewCleanup.map(result => {
    let severity: 'low' | 'medium' | 'high' = 'low'
    let recommendation = ''

    switch (result.type) {
      case 'orphaned':
        severity = 'medium'
        recommendation = 'Remove orphaned keys or register corresponding stores'
        break
      case 'legacy':
        severity = 'low'
        recommendation = 'Migrate to new storage format and remove legacy keys'
        break
      case 'invalid':
        severity = 'high'
        recommendation = 'Fix data validation issues or remove corrupted data'
        break
      case 'oversized':
        severity = 'medium'
        recommendation = 'Optimize data structure or implement data compression'
        break
      case 'expired':
        severity = 'low'
        recommendation = 'Remove expired data to free up storage space'
        break
    }

    return {
      type: result.type,
      key: result.key,
      description: result.reason,
      severity,
      recommendation
    }
  })

  const summary = {
    totalIssues: issues.length,
    highSeverity: issues.filter(i => i.severity === 'high').length,
    mediumSeverity: issues.filter(i => i.severity === 'medium').length,
    lowSeverity: issues.filter(i => i.severity === 'low').length
  }

  return { issues, summary }
}

/**
 * Development utilities for storage debugging
 */
export const devUtils = {
  /**
   * Log all storage keys and their contents (development only)
   */
  logAllStorageData(): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Storage logging is disabled in production')
      return
    }

    const keys = storageManager.getActiveKeys()
    console.log('📦 Current Storage Contents:')
    
    keys.forEach(key => {
      const data = localStorage.getItem(key)
      const size = data?.length || 0
      
      try {
        const parsed = JSON.parse(data || '{}')
        console.log(`  ${key} (${size} bytes):`, parsed)
      } catch {
        console.log(`  ${key} (${size} bytes): [Invalid JSON]`)
      }
    })
  },

  /**
   * Clear all DCE storage data (development only)
   */
  clearAllDCEData(): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Storage clearing is disabled in production')
      return
    }

    const keys = storageManager.getActiveKeys()
    let cleared = 0

    keys.forEach(key => {
      localStorage.removeItem(key)
      cleared++
    })

    console.log(`🗑️  Cleared ${cleared} DCE storage keys`)
  },

  /**
   * Export all storage data for backup
   */
  exportStorageData(): Record<string, unknown> {
    const keys = storageManager.getActiveKeys()
    const data: Record<string, unknown> = {}

    keys.forEach(key => {
      const value = localStorage.getItem(key)
      if (value) {
        try {
          data[key] = JSON.parse(value)
        } catch {
          data[key] = value
        }
      }
    })

    return data
  },

  /**
   * Import storage data from backup
   */
  importStorageData(data: Record<string, unknown>): void {
    if (process.env.NODE_ENV === 'production') {
      console.warn('Storage import is disabled in production')
      return
    }

    let imported = 0

    Object.entries(data).forEach(([key, value]) => {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value)
      localStorage.setItem(key, serialized)
      imported++
    })

    console.log(`📥 Imported ${imported} storage keys`)
  }
}

// Export type helpers
export type StorageArchitectureConfig = {
  autoMigrate?: boolean
  autoCleanup?: boolean
  verbose?: boolean
}

export type StorageStatus = Awaited<ReturnType<typeof getStorageStatus>>
export type StorageAudit = Awaited<ReturnType<typeof auditStorage>>