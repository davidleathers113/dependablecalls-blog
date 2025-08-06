/**
 * Phase 3.1d - Storage Cleanup System
 * 
 * Automated cleanup of orphaned data, old storage keys, and invalid entries
 * Maintains storage health and prevents data bloat
 */

import { storageManager } from './storageManager'
import { keyMigrationManager } from './keyMigration'
import { namespaceIsolation } from './namespaceIsolation'
import { getRegisteredStores } from '../utils/schemas'

// Cleanup result interface
export interface CleanupResult {
  type: 'orphaned' | 'legacy' | 'invalid' | 'expired' | 'oversized'
  key: string
  reason: string
  dataSize: number
  removed: boolean
  error?: string
}

// Cleanup configuration
export interface CleanupConfig {
  dryRun?: boolean // Preview changes without applying
  maxAge?: number // Remove data older than this (milliseconds)
  maxSize?: number // Remove data larger than this (bytes)
  removeOrphaned?: boolean // Remove keys with no corresponding store
  removeLegacy?: boolean // Remove old format keys after migration
  removeInvalid?: boolean // Remove data that fails schema validation
  removeExpired?: boolean // Remove expired namespace data
  verbose?: boolean // Detailed logging
}

// Storage health metrics
export interface StorageHealthMetrics {
  totalKeys: number
  totalSize: number
  validKeys: number
  orphanedKeys: number
  legacyKeys: number
  invalidKeys: number
  expiredKeys: number
  oversizedKeys: number
  namespaces: Record<string, number>
  healthScore: number // 0-100
}

// Default cleanup configuration
const DEFAULT_CLEANUP_CONFIG: CleanupConfig = {
  dryRun: false,
  maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
  maxSize: 5 * 1024 * 1024, // 5MB per key
  removeOrphaned: true,
  removeLegacy: false, // Keep legacy keys by default for safety
  removeInvalid: false, // Keep invalid data by default for recovery
  removeExpired: true,
  verbose: false
}

// Storage cleanup manager
export class StorageCleanupManager {
  private static instance: StorageCleanupManager
  private cleanupHistory: CleanupResult[] = []

  private constructor() {}

  static getInstance(): StorageCleanupManager {
    if (!StorageCleanupManager.instance) {
      StorageCleanupManager.instance = new StorageCleanupManager()
    }
    return StorageCleanupManager.instance
  }

  /**
   * Perform comprehensive storage cleanup
   */
  async performCleanup(config: CleanupConfig = {}): Promise<CleanupResult[]> {
    const finalConfig = { ...DEFAULT_CLEANUP_CONFIG, ...config }
    const results: CleanupResult[] = []

    if (finalConfig.verbose) {
      console.log('🧹 Starting storage cleanup process...')
    }

    // 1. Clean up orphaned keys
    if (finalConfig.removeOrphaned) {
      const orphanedResults = await this.cleanupOrphanedKeys(finalConfig)
      results.push(...orphanedResults)
    }

    // 2. Clean up legacy keys (after migration)
    if (finalConfig.removeLegacy) {
      const legacyResults = await this.cleanupLegacyKeys(finalConfig)
      results.push(...legacyResults)
    }

    // 3. Clean up invalid data
    if (finalConfig.removeInvalid) {
      const invalidResults = await this.cleanupInvalidData(finalConfig)
      results.push(...invalidResults)
    }

    // 4. Clean up expired data
    if (finalConfig.removeExpired) {
      const expiredResults = await this.cleanupExpiredData()
      results.push(...expiredResults)
    }

    // 5. Clean up oversized data
    if (finalConfig.maxSize) {
      const oversizedResults = await this.cleanupOversizedData(finalConfig)
      results.push(...oversizedResults)
    }

    // 6. Clean up old data
    if (finalConfig.maxAge) {
      const oldResults = await this.cleanupOldData(finalConfig)
      results.push(...oldResults)
    }

    // Store cleanup history
    this.cleanupHistory.push(...results)

    if (finalConfig.verbose) {
      this.logCleanupSummary(results)
    }

    return results
  }

  /**
   * Clean up orphaned keys (keys with no corresponding store)
   */
  private async cleanupOrphanedKeys(config: CleanupConfig): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    const registeredStores = getRegisteredStores()
    const allKeys = this.getAllStorageKeys()

    for (const key of allKeys) {
      if (!this.isDCEKey(key)) continue

      const parsedKey = storageManager.parseKey(key)
      if (!parsedKey) continue

      // Check if store is registered
      const isOrphaned = !registeredStores.includes(parsedKey.storeName)

      if (isOrphaned) {
        const dataSize = this.getKeySize(key)
        const result: CleanupResult = {
          type: 'orphaned',
          key,
          reason: `No registered store found for: ${parsedKey.storeName}`,
          dataSize,
          removed: false
        }

        if (!config.dryRun) {
          try {
            localStorage.removeItem(key)
            result.removed = true
            if (config.verbose) {
              console.log(`🗑️  Removed orphaned key: ${key}`)
            }
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error'
            if (config.verbose) {
              console.error(`❌ Failed to remove orphaned key ${key}:`, error)
            }
          }
        } else if (config.verbose) {
          console.log(`📋 [DRY RUN] Would remove orphaned key: ${key}`)
        }

        results.push(result)
      }
    }

    return results
  }

  /**
   * Clean up legacy keys after successful migration
   */
  private async cleanupLegacyKeys(config: CleanupConfig): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    const legacyKeys = keyMigrationManager.getExistingLegacyKeys()

    for (const key of legacyKeys) {
      // Only remove if migration was successful
      const migrationHistory = keyMigrationManager.getMigrationHistory()
      const wasMigrated = migrationHistory.some(h => h.legacyKey === key && h.success)

      if (wasMigrated) {
        const dataSize = this.getKeySize(key)
        const result: CleanupResult = {
          type: 'legacy',
          key,
          reason: 'Legacy key after successful migration',
          dataSize,
          removed: false
        }

        if (!config.dryRun) {
          try {
            localStorage.removeItem(key)
            result.removed = true
            if (config.verbose) {
              console.log(`🗑️  Removed legacy key: ${key}`)
            }
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error'
          }
        } else if (config.verbose) {
          console.log(`📋 [DRY RUN] Would remove legacy key: ${key}`)
        }

        results.push(result)
      }
    }

    return results
  }

  /**
   * Clean up data that fails schema validation
   */
  private async cleanupInvalidData(config: CleanupConfig): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    const allKeys = this.getAllStorageKeys()

    for (const key of allKeys) {
      if (!this.isDCEKey(key)) continue

      const parsedKey = storageManager.parseKey(key)
      if (!parsedKey) continue

      try {
        const rawData = localStorage.getItem(key)
        if (!rawData) continue

        const data = JSON.parse(rawData)
        
        // Try to validate with schema
        const isValid = this.validateDataWithSchema(parsedKey.storeName, parsedKey.version, data)
        
        if (!isValid) {
          const dataSize = this.getKeySize(key)
          const result: CleanupResult = {
            type: 'invalid',
            key,
            reason: 'Data fails schema validation',
            dataSize,
            removed: false
          }

          if (!config.dryRun) {
            try {
              localStorage.removeItem(key)
              result.removed = true
              if (config.verbose) {
                console.log(`🗑️  Removed invalid data: ${key}`)
              }
            } catch (error) {
              result.error = error instanceof Error ? error.message : 'Unknown error'
            }
          } else if (config.verbose) {
            console.log(`📋 [DRY RUN] Would remove invalid data: ${key}`)
          }

          results.push(result)
        }

      } catch {
        // Data is corrupted/unparseable
        const dataSize = this.getKeySize(key)
        const result: CleanupResult = {
          type: 'invalid',
          key,
          reason: 'Data is corrupted or unparseable',
          dataSize,
          removed: false
        }

        if (!config.dryRun) {
          localStorage.removeItem(key)
          result.removed = true
        }

        results.push(result)
      }
    }

    return results
  }

  /**
   * Clean up expired namespace data
   */
  private async cleanupExpiredData(): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    
    // Use namespace isolation manager to clean expired data
    const expiredCount = await namespaceIsolation.cleanupExpiredData()
    
    if (expiredCount > 0) {
      results.push({
        type: 'expired',
        key: 'namespace-expired-data',
        reason: `Cleaned ${expiredCount} expired namespace entries`,
        dataSize: 0,
        removed: true
      })
    }

    return results
  }

  /**
   * Clean up oversized data entries
   */
  private async cleanupOversizedData(config: CleanupConfig): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    if (!config.maxSize) return results

    const allKeys = this.getAllStorageKeys()

    for (const key of allKeys) {
      const dataSize = this.getKeySize(key)
      
      if (dataSize > config.maxSize) {
        const result: CleanupResult = {
          type: 'oversized',
          key,
          reason: `Data size (${this.formatBytes(dataSize)}) exceeds limit (${this.formatBytes(config.maxSize)})`,
          dataSize,
          removed: false
        }

        if (!config.dryRun) {
          try {
            localStorage.removeItem(key)
            result.removed = true
            if (config.verbose) {
              console.log(`🗑️  Removed oversized data: ${key}`)
            }
          } catch (error) {
            result.error = error instanceof Error ? error.message : 'Unknown error'
          }
        } else if (config.verbose) {
          console.log(`📋 [DRY RUN] Would remove oversized data: ${key}`)
        }

        results.push(result)
      }
    }

    return results
  }

  /**
   * Clean up old data based on age
   */
  private async cleanupOldData(config: CleanupConfig): Promise<CleanupResult[]> {
    const results: CleanupResult[] = []
    if (!config.maxAge) return results

    const allKeys = this.getAllStorageKeys()
    const now = Date.now()

    for (const key of allKeys) {
      try {
        const rawData = localStorage.getItem(key)
        if (!rawData) continue

        const data = JSON.parse(rawData)
        const timestamp = data._timestamp || data.updatedAt || data.lastSaved || 0
        
        let age = 0
        if (typeof timestamp === 'string') {
          age = now - new Date(timestamp).getTime()
        } else if (typeof timestamp === 'number') {
          age = now - timestamp
        }

        if (age > config.maxAge) {
          const dataSize = this.getKeySize(key)
          const result: CleanupResult = {
            type: 'expired',
            key,
            reason: `Data age (${this.formatDuration(age)}) exceeds limit (${this.formatDuration(config.maxAge)})`,
            dataSize,
            removed: false
          }

          if (!config.dryRun) {
            try {
              localStorage.removeItem(key)
              result.removed = true
              if (config.verbose) {
                console.log(`🗑️  Removed old data: ${key}`)
              }
            } catch (error) {
              result.error = error instanceof Error ? error.message : 'Unknown error'
            }
          }

          results.push(result)
        }

      } catch {
        // Skip if we can't parse the data
        continue
      }
    }

    return results
  }

  /**
   * Get storage health metrics
   */
  async getHealthMetrics(): Promise<StorageHealthMetrics> {
    const allKeys = this.getAllStorageKeys()
    const registeredStores = getRegisteredStores()
    
    let totalSize = 0
    let validKeys = 0
    let orphanedKeys = 0
    let legacyKeys = 0
    let invalidKeys = 0
    let expiredKeys = 0
    let oversizedKeys = 0
    const namespaces: Record<string, number> = {}

    for (const key of allKeys) {
      const size = this.getKeySize(key)
      totalSize += size

      // Check if oversized (using 1MB as default threshold)
      if (size > 1024 * 1024) {
        oversizedKeys++
      }

      // Check if legacy
      if (keyMigrationManager.getExistingLegacyKeys().includes(key)) {
        legacyKeys++
        continue
      }

      // Check if DCE key
      if (!this.isDCEKey(key)) continue

      const parsedKey = storageManager.parseKey(key)
      if (!parsedKey) {
        invalidKeys++
        continue
      }

      // Check if orphaned
      if (!registeredStores.includes(parsedKey.storeName)) {
        orphanedKeys++
        continue
      }

      // Track namespace usage
      if (parsedKey.namespace) {
        namespaces[parsedKey.namespace] = (namespaces[parsedKey.namespace] || 0) + 1
      }

      // Check if data is valid
      try {
        const rawData = localStorage.getItem(key)
        if (rawData) {
          const data = JSON.parse(rawData)
          const isValid = this.validateDataWithSchema(parsedKey.storeName, parsedKey.version, data)
          
          if (isValid) {
            validKeys++
          } else {
            invalidKeys++
          }

          // Check if expired
          const timestamp = data._timestamp || data.updatedAt || data.lastSaved
          if (timestamp) {
            const age = Date.now() - (typeof timestamp === 'string' ? new Date(timestamp).getTime() : timestamp)
            if (age > 30 * 24 * 60 * 60 * 1000) { // 30 days
              expiredKeys++
            }
          }
        }
      } catch {
        invalidKeys++
      }
    }

    // Calculate health score (0-100)
    const totalKeys = allKeys.length
    const problemKeys = orphanedKeys + legacyKeys + invalidKeys + expiredKeys + oversizedKeys
    const healthScore = totalKeys > 0 ? Math.max(0, Math.round((1 - problemKeys / totalKeys) * 100)) : 100

    return {
      totalKeys,
      totalSize,
      validKeys,
      orphanedKeys,
      legacyKeys,
      invalidKeys,
      expiredKeys,
      oversizedKeys,
      namespaces,
      healthScore
    }
  }

  /**
   * Validate data with schema using store name and version
   */
  private validateDataWithSchema(storeName: string, version: number, data: unknown): boolean {
    try {
      // Basic validation - data must be object with required structure
      if (typeof data !== 'object' || data === null) {
        return false
      }

      const dataObj = data as Record<string, unknown>
      
      // Store-specific validation based on name and version
      switch (storeName) {
        case 'auth-store':
          return 'user' in dataObj && 'isAuthenticated' in dataObj
        case 'settings-store':
          return version >= 1 && ('userSettings' in dataObj || 'preferences' in dataObj)
        case 'navigation':
          return 'preferences' in dataObj && 'desktopSidebar' in dataObj
        default:
          // Generic validation - check for common store properties
          return 'state' in dataObj || 'version' in dataObj || Object.keys(dataObj).length > 0
      }
    } catch {
      return false
    }
  }

  /**
   * Get all storage keys
   */
  private getAllStorageKeys(): string[] {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key) keys.push(key)
    }
    return keys
  }

  /**
   * Check if key is a DCE key
   */
  private isDCEKey(key: string): boolean {
    return key.startsWith('dce-') || keyMigrationManager.getExistingLegacyKeys().includes(key)
  }

  /**
   * Get size of data for a key
   */
  private getKeySize(key: string): number {
    const data = localStorage.getItem(key)
    return data ? new Blob([data]).size : 0
  }

  /**
   * Format bytes for human reading
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  /**
   * Format duration for human reading
   */
  private formatDuration(ms: number): string {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000))
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000))
    
    if (days > 0) return `${days}d ${hours}h`
    if (hours > 0) return `${hours}h`
    return `${Math.floor(ms / (60 * 1000))}m`
  }

  /**
   * Log cleanup summary
   */
  private logCleanupSummary(results: CleanupResult[]): void {
    const successful = results.filter(r => r.removed).length
    const failed = results.filter(r => !r.removed).length
    const totalSize = results.reduce((sum, r) => sum + r.dataSize, 0)

    const byType = results.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    console.log(`
🧹 Cleanup Summary:
   ✅ Successful: ${successful}
   ❌ Failed: ${failed}
   📦 Total data cleaned: ${this.formatBytes(totalSize)}
   
   By type:
   ${Object.entries(byType).map(([type, count]) => `   ${type}: ${count}`).join('\n')}
    `)
  }

  /**
   * Get cleanup history
   */
  getCleanupHistory(): CleanupResult[] {
    return [...this.cleanupHistory]
  }

  /**
   * Clear cleanup history
   */
  clearCleanupHistory(): void {
    this.cleanupHistory = []
  }
}

// Export singleton instance
export const storageCleanup = StorageCleanupManager.getInstance()

// Convenience functions
export async function cleanupStorage(config?: CleanupConfig): Promise<CleanupResult[]> {
  return storageCleanup.performCleanup(config)
}

export async function getStorageHealth(): Promise<StorageHealthMetrics> {
  return storageCleanup.getHealthMetrics()
}

export async function previewStorageCleanup(config?: Omit<CleanupConfig, 'dryRun'>): Promise<CleanupResult[]> {
  return storageCleanup.performCleanup({ ...config, dryRun: true, verbose: true })
}