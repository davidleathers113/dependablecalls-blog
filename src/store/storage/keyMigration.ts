/**
 * Phase 3.1d - Key Migration System
 * 
 * Automated migration from old storage key formats to standardized format
 * Handles data transformation and cleanup of legacy keys
 */

import { storageManager } from './storageManager'
import type { StorageConfig } from './storageManager' 
import { getLatestSchemaVersion } from '../utils/schemas'

// Migration result interface
export interface MigrationResult {
  storeName: string
  legacyKey: string
  newKey: string
  success: boolean
  dataSize: number
  error?: string
}

// Migration configuration
export interface MigrationConfig {
  dryRun?: boolean // Preview changes without applying
  keepLegacyKeys?: boolean // Keep old keys after migration
  validateData?: boolean // Validate data with schemas
  verbose?: boolean // Detailed logging
}

// Legacy key mapping with data transformations
interface LegacyKeyMapping {
  legacyKey: string
  storeName: string
  dataTransform?: (data: unknown) => unknown
  validation?: (data: unknown) => boolean
}

// Known legacy mappings
const LEGACY_MAPPINGS: LegacyKeyMapping[] = [
  {
    legacyKey: 'dce-user-preferences',
    storeName: 'auth',
    dataTransform: (data: unknown) => {
      // Transform auth preferences structure if needed
      if (typeof data === 'object' && data !== null) {
        const authData = data as Record<string, unknown>
        return {
          preferences: authData.preferences || {},
          // Remove any sensitive data that shouldn't be persisted
          user: undefined,
          session: undefined,
          loading: undefined,
        }
      }
      return data
    },
    validation: (data: unknown) => {
      return typeof data === 'object' && data !== null && 'preferences' in (data as Record<string, unknown>)
    }
  },
  {
    legacyKey: 'settings-storage',
    storeName: 'settings',
    dataTransform: (data: unknown) => {
      // Settings data is already in correct format
      return data
    }
  },
  {
    legacyKey: 'blog-editor-storage',
    storeName: 'blog-editor',
    dataTransform: (data: unknown) => {
      // Ensure blog editor data structure is correct
      if (typeof data === 'object' && data !== null) {
        const editorData = data as Record<string, unknown>
        return {
          draft: editorData.draft || null,
          editorMode: editorData.editorMode || 'markdown',
          previewMode: editorData.previewMode || 'split',
          wordWrapEnabled: editorData.wordWrapEnabled ?? true,
          autosaveEnabled: editorData.autosaveEnabled ?? true,
          autosaveInterval: editorData.autosaveInterval || 30,
          // Remove transient state
          isDraftSaved: undefined,
          lastSavedAt: undefined,
          sidebarOpen: undefined,
        }
      }
      return data
    }
  },
  {
    legacyKey: 'blog-ui-storage',
    storeName: 'blog-ui',
    dataTransform: (data: unknown) => {
      // Transform blog UI state machine data
      if (typeof data === 'object' && data !== null) {
        const uiData = data as Record<string, unknown>
        return {
          // Migrate from old boolean flags to state machine
          modalState: uiData.modalState || {
            type: 'closed',
            metadata: {}
          },
          // Preserve other UI state
          ...uiData
        }
      }
      return data
    }
  },
  {
    legacyKey: 'blog-filter-storage',
    storeName: 'blog-filter'
  },
  {
    legacyKey: 'buyer-store',
    storeName: 'buyer',
    dataTransform: (data: unknown) => {
      // Handle buyer store data - remove sensitive financial data from persistence
      if (typeof data === 'object' && data !== null) {
        const buyerData = data as Record<string, unknown>
        return {
          // Only persist safe, non-sensitive data
          campaigns: buyerData.campaigns || [],
          savedSearches: buyerData.savedSearches || [],
          // Remove sensitive data
          currentBalance: undefined,
          creditLimit: undefined,
          metrics: undefined,
          dashboardData: undefined,
        }
      }
      return data
    },
    validation: (data: unknown) => {
      // Ensure no sensitive financial data is persisted
      if (typeof data === 'object' && data !== null) {
        const buyerData = data as Record<string, unknown>
        return !('currentBalance' in buyerData) && !('creditLimit' in buyerData)
      }
      return true
    }
  },
  {
    legacyKey: 'supplier-store',
    storeName: 'supplier',
    dataTransform: (data: unknown) => {
      // Handle supplier store data
      if (typeof data === 'object' && data !== null) {
        const supplierData = data as Record<string, unknown>
        return {
          listings: supplierData.listings || [],
          leadSources: supplierData.leadSources || [],
          // Remove transient state
          metrics: undefined,
          sales: undefined,
          dashboardData: undefined,
          loading: undefined,
          error: undefined,
        }
      }
      return data
    }
  },
  {
    legacyKey: 'network-store',
    storeName: 'network',
    dataTransform: () => {
      // Network store doesn't persist data
      return {}
    }
  }
]

// Key migration manager
export class KeyMigrationManager {
  private migrationHistory: MigrationResult[] = []

  /**
   * Migrate all legacy keys to new format
   */
  async migrateAllKeys(config: MigrationConfig = {}): Promise<MigrationResult[]> {
    const results: MigrationResult[] = []
    
    if (config.verbose) {
      console.log('🔄 Starting key migration process...')
    }

    for (const mapping of LEGACY_MAPPINGS) {
      try {
        const result = await this.migrateKey(mapping, config)
        if (result) {
          results.push(result)
          this.migrationHistory.push(result)
        }
      } catch (error) {
        const failedResult: MigrationResult = {
          storeName: mapping.storeName,
          legacyKey: mapping.legacyKey,
          newKey: `dce-${mapping.storeName}-v1`,
          success: false,
          dataSize: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        }
        results.push(failedResult)
        this.migrationHistory.push(failedResult)
      }
    }

    if (config.verbose) {
      this.logMigrationSummary(results)
    }

    return results
  }

  /**
   * Migrate a specific legacy key
   */
  private async migrateKey(mapping: LegacyKeyMapping, config: MigrationConfig): Promise<MigrationResult | null> {
    const { legacyKey, storeName, dataTransform, validation } = mapping
    
    // Check if legacy key exists
    const rawData = localStorage.getItem(legacyKey)
    if (!rawData) {
      if (config.verbose) {
        console.log(`⏭️  No data found for legacy key: ${legacyKey}`)
      }
      return null
    }

    try {
      // Parse legacy data
      const parsedData = JSON.parse(rawData)
      let transformedData = parsedData

      // Apply data transformation
      if (dataTransform) {
        transformedData = dataTransform(parsedData)
      }

      // Validate transformed data
      if (validation && !validation(transformedData)) {
        throw new Error('Data validation failed after transformation')
      }

      // Generate new storage key
      const storageConfig: StorageConfig = {
        storeName,
        version: getLatestSchemaVersion(storeName) || 1
      }
      const newKey = storageManager.generateKey(storageConfig).fullKey

      const result: MigrationResult = {
        storeName,
        legacyKey,
        newKey,
        success: false,
        dataSize: rawData.length,
      }

      if (config.dryRun) {
        result.success = true
        if (config.verbose) {
          console.log(`📋 [DRY RUN] Would migrate: ${legacyKey} → ${newKey}`)
        }
        return result
      }

      // Perform actual migration
      if (config.validateData) {
        // Use storage manager with validation
        const success = await storageManager.setData(storageConfig, transformedData)
        if (!success) {
          throw new Error('Failed to store data with validation')
        }
      } else {
        // Direct storage without validation
        localStorage.setItem(newKey, JSON.stringify(transformedData))
      }

      // Remove legacy key unless configured to keep it
      if (!config.keepLegacyKeys) {
        localStorage.removeItem(legacyKey)
      }

      result.success = true

      if (config.verbose) {
        console.log(`✅ Migrated: ${legacyKey} → ${newKey} (${rawData.length} bytes)`)
      }

      return result

    } catch (error) {
      const result: MigrationResult = {
        storeName,
        legacyKey,
        newKey: `dce-${storeName}-v1`,
        success: false,
        dataSize: rawData.length,
        error: error instanceof Error ? error.message : 'Unknown error'
      }

      if (config.verbose) {
        console.error(`❌ Failed to migrate ${legacyKey}:`, error)
      }

      return result
    }
  }

  /**
   * Preview migration without applying changes
   */
  async previewMigration(): Promise<MigrationResult[]> {
    return this.migrateAllKeys({ dryRun: true, verbose: true })
  }

  /**
   * Get migration history
   */
  getMigrationHistory(): MigrationResult[] {
    return [...this.migrationHistory]
  }

  /**
   * Check if any legacy keys exist
   */
  hasLegacyKeys(): boolean {
    return LEGACY_MAPPINGS.some(mapping => 
      localStorage.getItem(mapping.legacyKey) !== null
    )
  }

  /**
   * Get all existing legacy keys
   */
  getExistingLegacyKeys(): string[] {
    return LEGACY_MAPPINGS
      .map(mapping => mapping.legacyKey)
      .filter(key => localStorage.getItem(key) !== null)
  }

  /**
   * Log migration summary
   */
  private logMigrationSummary(results: MigrationResult[]): void {
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const totalSize = results.reduce((sum, r) => sum + r.dataSize, 0)

    console.log(`
📊 Migration Summary:
   ✅ Successful: ${successful}
   ❌ Failed: ${failed}
   📦 Total data migrated: ${this.formatBytes(totalSize)}
   
   ${results.map(r => 
     `${r.success ? '✅' : '❌'} ${r.legacyKey} → ${r.newKey}${r.error ? ` (${r.error})` : ''}`
   ).join('\n   ')}
    `)
  }

  /**
   * Format bytes for human reading
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Rollback migration for a specific store
   */
  async rollbackMigration(storeName: string): Promise<boolean> {
    const history = this.migrationHistory.find(h => h.storeName === storeName && h.success)
    if (!history) {
      console.warn(`No successful migration found for store: ${storeName}`)
      return false
    }

    try {
      // Check if new key exists
      const newData = localStorage.getItem(history.newKey)
      if (!newData) {
        console.warn(`New key ${history.newKey} not found for rollback`)
        return false
      }

      // Restore to legacy key
      localStorage.setItem(history.legacyKey, newData)
      
      // Remove new key
      localStorage.removeItem(history.newKey)
      
      console.log(`🔄 Rolled back migration: ${history.newKey} → ${history.legacyKey}`)
      return true

    } catch (error) {
      console.error(`Failed to rollback migration for ${storeName}:`, error)
      return false
    }
  }
}

// Export singleton instance
export const keyMigrationManager = new KeyMigrationManager()

// Convenience functions
export async function migrateAllStorageKeys(options?: MigrationConfig): Promise<MigrationResult[]> {
  return keyMigrationManager.migrateAllKeys(options)
}

export async function previewStorageMigration(): Promise<MigrationResult[]> {
  return keyMigrationManager.previewMigration()
}

export function hasLegacyStorageKeys(): boolean {
  return keyMigrationManager.hasLegacyKeys()
}

export function getExistingLegacyKeys(): string[] {
  return keyMigrationManager.getExistingLegacyKeys()
}