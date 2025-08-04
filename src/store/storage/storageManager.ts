/**
 * Phase 3.1d - Unified Storage Manager
 * 
 * Provides consistent storage key management with standardized naming:
 * Format: dce-{store}-v{version}
 * 
 * Features:
 * - Consistent key naming across all stores
 * - Version management integration
 * - Namespace isolation
 * - Migration support
 * - Type safety with schema validation
 */

import { getLatestSchemaVersion, validateWithSchema } from '../utils/schemas'

// Storage configuration interface
export interface StorageConfig {
  storeName: string
  version?: number // If not provided, uses latest schema version
  namespace?: string // Optional namespace for isolation
  encryption?: boolean // Future: encryption support
  compression?: boolean // Future: compression support
}

// Storage key components
interface StorageKey {
  prefix: string // 'dce'
  storeName: string
  version: number
  namespace?: string
  fullKey: string
}

// Storage manager class
export class StorageManager {
  private static instance: StorageManager
  private keyRegistry = new Map<string, StorageKey>()
  private migrationCallbacks = new Map<string, Array<(oldData: unknown, newVersion: number) => unknown>>()

  private constructor() {}

  static getInstance(): StorageManager {
    if (!StorageManager.instance) {
      StorageManager.instance = new StorageManager()
    }
    return StorageManager.instance
  }

  /**
   * Generate standardized storage key
   * Format: dce-{store}-v{version}[-{namespace}]
   */
  generateKey(config: StorageConfig): StorageKey {
    const version = config.version || getLatestSchemaVersion(config.storeName) || 1
    const keyParts = [
      'dce',
      config.storeName.replace(/store$/i, '').toLowerCase(), // Remove 'Store' suffix, lowercase
      `v${version}`
    ]

    if (config.namespace) {
      keyParts.push(config.namespace)
    }

    const fullKey = keyParts.join('-')
    
    const storageKey: StorageKey = {
      prefix: 'dce',
      storeName: config.storeName,
      version,
      namespace: config.namespace,
      fullKey
    }

    // Register the key for tracking
    this.keyRegistry.set(fullKey, storageKey)
    
    return storageKey
  }

  /**
   * Parse existing storage key to extract components
   */
  parseKey(key: string): StorageKey | null {
    // Handle legacy keys and new format
    const legacyPatterns = [
      /^dce-user-preferences$/, // authStore legacy
      /^settings-storage$/, // settingsStore legacy
      /^blog-editor-storage$/, // blogStore legacy
      /^blog-ui-storage$/, // blogStore legacy
      /^blog-filter-storage$/, // blogStore legacy
      /^(.*?)-store$/, // Generic store pattern
    ]

    // Check if it's already our new format
    const newFormatMatch = key.match(/^dce-([^-]+)-v(\d+)(?:-(.+))?$/)
    if (newFormatMatch) {
      const [, storeName, version, namespace] = newFormatMatch
      return {
        prefix: 'dce',
        storeName,
        version: parseInt(version, 10),
        namespace,
        fullKey: key
      }
    }

    // Handle legacy patterns
    for (const pattern of legacyPatterns) {
      if (pattern.test(key)) {
        return this.convertLegacyKey(key)
      }
    }

    return null
  }

  /**
   * Convert legacy storage key to new format
   */
  private convertLegacyKey(legacyKey: string): StorageKey | null {
    const legacyMapping: Record<string, { storeName: string; version: number }> = {
      'dce-user-preferences': { storeName: 'auth', version: 1 },
      'settings-storage': { storeName: 'settings', version: 1 },
      'blog-editor-storage': { storeName: 'blog-editor', version: 1 },
      'blog-ui-storage': { storeName: 'blog-ui', version: 1 },
      'blog-filter-storage': { storeName: 'blog-filter', version: 1 },
      'buyer-store': { storeName: 'buyer', version: 1 },
      'supplier-store': { storeName: 'supplier', version: 1 },
      'network-store': { storeName: 'network', version: 1 },
    }

    const mapping = legacyMapping[legacyKey]
    if (!mapping) return null

    return {
      prefix: 'dce',
      storeName: mapping.storeName,
      version: mapping.version,
      fullKey: `dce-${mapping.storeName}-v${mapping.version}`
    }
  }

  /**
   * Get data from storage with validation
   */
  async getData<T>(config: StorageConfig): Promise<T | null> {
    const key = this.generateKey(config)
    
    try {
      const rawData = localStorage.getItem(key.fullKey)
      if (!rawData) {
        // Try legacy key migration
        const legacyData = await this.tryLegacyMigration<T>(config)
        if (legacyData) {
          // Store in new format
          await this.setData(config, legacyData)
          return legacyData
        }
        return null
      }

      const data = JSON.parse(rawData)
      
      // Validate with schema if available
      const validatedData = validateWithSchema(config.storeName, key.version, data)
      return validatedData as T
    } catch (error) {
      console.error(`Storage error for key ${key.fullKey}:`, error)
      return null
    }
  }

  /**
   * Set data in storage with validation
   */
  async setData<T>(config: StorageConfig, data: T): Promise<boolean> {
    const key = this.generateKey(config)
    
    try {
      // Validate with schema if available
      const validatedData = validateWithSchema(config.storeName, key.version, data)
      if (!validatedData) {
        console.error(`Schema validation failed for ${key.fullKey}`)
        return false
      }

      const serializedData = JSON.stringify(validatedData)
      localStorage.setItem(key.fullKey, serializedData)
      
      return true
    } catch (error) {
      console.error(`Storage error for key ${key.fullKey}:`, error)
      return false
    }
  }

  /**
   * Remove data from storage
   */
  async removeData(config: StorageConfig): Promise<boolean> {
    const key = this.generateKey(config)
    
    try {
      localStorage.removeItem(key.fullKey)
      this.keyRegistry.delete(key.fullKey)
      return true
    } catch (error) {
      console.error(`Storage removal error for key ${key.fullKey}:`, error)
      return false
    }
  }

  /**
   * Try to migrate data from legacy storage keys
   */
  private async tryLegacyMigration<T>(config: StorageConfig): Promise<T | null> {
    const legacyKeys = this.getLegacyKeysForStore(config.storeName)
    
    for (const legacyKey of legacyKeys) {
      try {
        const rawData = localStorage.getItem(legacyKey)
        if (rawData) {
          const data = JSON.parse(rawData)
          
          // Apply migration callbacks if any
          const callbacks = this.migrationCallbacks.get(config.storeName) || []
          let migratedData = data
          
          for (const callback of callbacks) {
            migratedData = callback(migratedData, config.version || 1)
          }
          
          // Clean up legacy key
          localStorage.removeItem(legacyKey)
          
          return migratedData as T
        }
      } catch (error) {
        console.warn(`Failed to migrate legacy key ${legacyKey}:`, error)
      }
    }
    
    return null
  }

  /**
   * Get potential legacy keys for a store
   */
  private getLegacyKeysForStore(storeName: string): string[] {
    const legacyMappings: Record<string, string[]> = {
      'auth': ['dce-user-preferences'],
      'settings': ['settings-storage'],
      'blog-editor': ['blog-editor-storage'],
      'blog-ui': ['blog-ui-storage'],
      'blog-filter': ['blog-filter-storage'],
      'buyer': ['buyer-store'],
      'supplier': ['supplier-store'],
      'network': ['network-store'],
    }

    return legacyMappings[storeName] || []
  }

  /**
   * Register migration callback for store version updates
   */
  registerMigration(storeName: string, callback: (oldData: unknown, newVersion: number) => unknown): void {
    if (!this.migrationCallbacks.has(storeName)) {
      this.migrationCallbacks.set(storeName, [])
    }
    this.migrationCallbacks.get(storeName)!.push(callback)
  }

  /**
   * Get all registered storage keys
   */
  getAllKeys(): StorageKey[] {
    return Array.from(this.keyRegistry.values())
  }

  /**
   * Get all active storage keys from localStorage
   */
  getActiveKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && (key.startsWith('dce-') || this.isLegacyKey(key))) {
        keys.push(key)
      }
    }
    return keys
  }

  /**
   * Check if a key is a legacy key
   */
  private isLegacyKey(key: string): boolean {
    const legacyPatterns = [
      'dce-user-preferences',
      'settings-storage',
      'blog-editor-storage',
      'blog-ui-storage',
      'blog-filter-storage',
      'buyer-store',
      'supplier-store',
      'network-store',
    ]
    return legacyPatterns.includes(key)
  }

  /**
   * Create Zustand persist configuration with standardized naming
   */
  createPersistConfig<T>(config: StorageConfig & {
    partialize?: (state: T) => Partial<T>
    onRehydrateStorage?: (state: T) => void
    skipHydration?: boolean
  }) {
    const key = this.generateKey(config)
    
    return {
      name: key.fullKey,
      partialize: config.partialize,
      onRehydrateStorage: config.onRehydrateStorage,
      skipHydration: config.skipHydration,
      version: key.version,
      migrate: async (persistedState: unknown, version: number) => {
        // Handle version migrations
        const callbacks = this.migrationCallbacks.get(config.storeName) || []
        let migratedState = persistedState
        
        for (const callback of callbacks) {
          if (version < key.version) {
            migratedState = callback(migratedState, key.version)
          }
        }
        
        return migratedState
      }
    }
  }
}

// Export singleton instance
export const storageManager = StorageManager.getInstance()

// Convenience functions
export function createStorageConfig(storeName: string, options?: Partial<StorageConfig>): StorageConfig {
  return {
    storeName,
    ...options
  }
}

export function generateStorageKey(storeName: string, version?: number, namespace?: string): string {
  return storageManager.generateKey({ storeName, version, namespace }).fullKey
}