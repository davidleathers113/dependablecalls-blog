/**
 * Data Migration Utilities for Encrypted Storage
 * Handles migration from plaintext/fake-encrypted to real encrypted data
 */

import { encryptJSON, decryptJSON, isValidEncryptedData } from '../crypto/encryption'
import type { EncryptionConfig, EncryptedData as _EncryptedData } from '../crypto/encryption'
import type { DataClassification } from '../dataClassification'

export interface MigrationResult {
  success: boolean
  itemsFound: number
  itemsMigrated: number
  itemsFailed: number
  errors: Array<{ key: string; error: string }>
  timeTaken: number
}

export interface MigrationOptions {
  batchSize: number
  validateAfterMigration: boolean
  backupOriginal: boolean
  dryRun: boolean
}

/**
 * Detect the format of stored data
 */
export enum StorageFormat {
  PLAINTEXT = 'plaintext',
  FAKE_ENCRYPTED = 'fake_encrypted', // The buggy "encrypted_promise" format
  REAL_ENCRYPTED = 'real_encrypted', // Proper AES-GCM encrypted
  UNKNOWN = 'unknown'
}

/**
 * Analyze stored data format
 */
export function detectStorageFormat(storedValue: string): StorageFormat {
  try {
    const parsed = JSON.parse(storedValue)
    
    // Check for fake encrypted format (the security bug)
    if (parsed.type === 'encrypted_promise' && parsed.data && typeof parsed.data === 'string') {
      return StorageFormat.FAKE_ENCRYPTED
    }
    
    // Check for real encrypted format
    if (isValidEncryptedData(parsed)) {
      return StorageFormat.REAL_ENCRYPTED
    }
    
    // Might be plaintext JSON
    return StorageFormat.PLAINTEXT
    
  } catch {
    // Not JSON, probably plaintext string
    return StorageFormat.PLAINTEXT
  }
}

/**
 * Migration utilities for encrypted storage
 */
export class StorageMigrator {
  private classification: DataClassification
  private password: string
  private encryptionConfig: EncryptionConfig

  constructor(
    classification: DataClassification,
    password: string,
    encryptionConfig: EncryptionConfig
  ) {
    this.classification = classification
    this.password = password
    this.encryptionConfig = encryptionConfig
  }

  /**
   * Migrate all items in storage from fake/plaintext to real encryption
   */
  async migrateStorage(
    storage: Storage,
    options: Partial<MigrationOptions> = {}
  ): Promise<MigrationResult> {
    const opts: MigrationOptions = {
      batchSize: 10,
      validateAfterMigration: true,
      backupOriginal: false,
      dryRun: false,
      ...options
    }

    const startTime = Date.now()
    const result: MigrationResult = {
      success: false,
      itemsFound: 0,
      itemsMigrated: 0,
      itemsFailed: 0,
      errors: [],
      timeTaken: 0
    }

    try {
      const itemsToMigrate = this.findItemsNeedingMigration(storage)
      result.itemsFound = itemsToMigrate.length

      if (itemsToMigrate.length === 0) {
        console.info('✅ No items need migration')
        result.success = true
        result.timeTaken = Date.now() - startTime
        return result
      }

      console.info(`🔄 Starting migration of ${itemsToMigrate.length} items...`)

      // Process in batches
      for (let i = 0; i < itemsToMigrate.length; i += opts.batchSize) {
        const batch = itemsToMigrate.slice(i, i + opts.batchSize)
        
        for (const item of batch) {
          try {
            const migrated = await this.migrateItem(item, opts, storage)
            if (migrated) {
              result.itemsMigrated++
            } else {
              result.itemsFailed++
            }
          } catch (error) {
            result.itemsFailed++
            result.errors.push({
              key: item.key,
              error: error instanceof Error ? error.message : 'Unknown error'
            })
          }
        }

        // Small delay between batches
        if (i + opts.batchSize < itemsToMigrate.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      result.success = result.itemsFailed === 0
      console.info(`✅ Migration completed: ${result.itemsMigrated} migrated, ${result.itemsFailed} failed`)

    } catch (error) {
      console.error('❌ Migration failed:', error)
      result.errors.push({
        key: 'MIGRATION_ERROR',
        error: error instanceof Error ? error.message : 'Unknown migration error'
      })
    }

    result.timeTaken = Date.now() - startTime
    return result
  }

  /**
   * Find all items that need migration
   */
  private findItemsNeedingMigration(storage: Storage): Array<{
    key: string
    fullKey: string
    value: string
    format: StorageFormat
  }> {
    const itemsToMigrate: Array<{
      key: string
      fullKey: string
      value: string
      format: StorageFormat
    }> = []

    const prefix = `dce_encrypted_${this.classification}_`

    try {
      for (let i = 0; i < storage.length; i++) {
        const fullKey = storage.key(i)
        if (!fullKey || !fullKey.startsWith(prefix)) continue

        const value = storage.getItem(fullKey)
        if (!value) continue

        const format = detectStorageFormat(value)
        
        // Only migrate items that are NOT already properly encrypted
        if (format !== StorageFormat.REAL_ENCRYPTED) {
          itemsToMigrate.push({
            key: fullKey.substring(prefix.length),
            fullKey,
            value,
            format
          })
        }
      }
    } catch (error) {
      console.error('Error scanning storage for migration:', error)
    }

    return itemsToMigrate
  }

  /**
   * Migrate a single item
   */
  private async migrateItem(
    item: { key: string; fullKey: string; value: string; format: StorageFormat },
    options: MigrationOptions,
    storage: Storage
  ): Promise<boolean> {
    try {
      let dataToEncrypt: unknown

      // Extract the actual data based on format
      switch (item.format) {
        case StorageFormat.FAKE_ENCRYPTED: {
          // Extract data from fake encrypted format
          const fakeEncrypted = JSON.parse(item.value)
          dataToEncrypt = fakeEncrypted.data
          console.debug(`🔄 Migrating fake-encrypted item: ${item.key}`)
          break
        }

        case StorageFormat.PLAINTEXT:
          try {
            // Try to parse as JSON first
            dataToEncrypt = JSON.parse(item.value)
          } catch {
            // Use as string if not JSON
            dataToEncrypt = item.value
          }
          console.debug(`🔄 Migrating plaintext item: ${item.key}`)
          break

        default:
          console.warn(`⚠️  Unknown format for item ${item.key}: ${item.format}`)
          return false
      }

      if (options.dryRun) {
        console.debug(`[DRY RUN] Would migrate ${item.key} (${item.format})`)
        return true
      }

      // Backup original if requested
      if (options.backupOriginal) {
        const backupKey = `${item.fullKey}_backup_${Date.now()}`
        try {
          // Use localStorage for backup (we know it's available if we got this far)
          localStorage.setItem(backupKey, item.value)
        } catch (error) {
          console.warn(`Failed to backup ${item.key}:`, error)
          // Continue with migration even if backup fails
        }
      }

      // Encrypt the data properly
      const encryptedData = await encryptJSON(
        dataToEncrypt,
        this.password,
        this.encryptionConfig
      )

      // Store the properly encrypted data using the safe storage instance
      storage.setItem(item.fullKey, JSON.stringify(encryptedData))

      // Validate if requested
      if (options.validateAfterMigration) {
        const validated = await this.validateMigratedItem(item.fullKey, dataToEncrypt, storage)
        if (!validated) {
          throw new Error('Validation failed after migration')
        }
      }

      return true

    } catch (error) {
      console.error(`❌ Failed to migrate item ${item.key}:`, error)
      throw error
    }
  }

  /**
   * Validate that a migrated item can be decrypted correctly
   */
  private async validateMigratedItem(fullKey: string, originalData: unknown, storage: Storage): Promise<boolean> {
    try {
      // Get the stored value using the safe storage instance
      const storedValue = storage.getItem(fullKey)
      if (!storedValue) return false

      // Parse and decrypt
      const encryptedData = JSON.parse(storedValue)
      if (!isValidEncryptedData(encryptedData)) return false

      const decryptedData = await decryptJSON(
        encryptedData,
        this.password,
        this.encryptionConfig
      )

      // Compare with original
      return JSON.stringify(decryptedData) === JSON.stringify(originalData)
      
    } catch (error) {
      console.error('Validation error:', error)
      return false
    }
  }

  /**
   * Get migration statistics for a storage instance
   */
  getMigrationStats(storage: Storage): {
    total: number
    byFormat: Record<StorageFormat, number>
    needsMigration: number
  } {
    const stats = {
      total: 0,
      byFormat: {
        [StorageFormat.PLAINTEXT]: 0,
        [StorageFormat.FAKE_ENCRYPTED]: 0,
        [StorageFormat.REAL_ENCRYPTED]: 0,
        [StorageFormat.UNKNOWN]: 0
      },
      needsMigration: 0
    }

    const prefix = `dce_encrypted_${this.classification}_`

    try {
      for (let i = 0; i < storage.length; i++) {
        const fullKey = storage.key(i)
        if (!fullKey || !fullKey.startsWith(prefix)) continue

        const value = storage.getItem(fullKey)
        if (!value) continue

        stats.total++
        const format = detectStorageFormat(value)
        stats.byFormat[format]++

        if (format !== StorageFormat.REAL_ENCRYPTED) {
          stats.needsMigration++
        }
      }
    } catch (error) {
      console.error('Error getting migration stats:', error)
    }

    return stats
  }
}

/**
 * Quick utility to check if any data needs migration
 */
export function needsMigration(
  storage: Storage,
  classification: DataClassification
): boolean {
  const prefix = `dce_encrypted_${classification}_`
  
  try {
    for (let i = 0; i < storage.length; i++) {
      const fullKey = storage.key(i)
      if (!fullKey || !fullKey.startsWith(prefix)) continue

      const value = storage.getItem(fullKey)
      if (!value) continue

      const format = detectStorageFormat(value)
      if (format !== StorageFormat.REAL_ENCRYPTED) {
        return true
      }
    }
  } catch (error) {
    console.error('Error checking migration needs:', error)
  }
  
  return false
}

/**
 * Utility to clean up backup files created during migration
 */
export function cleanupMigrationBackups(storage: Storage, olderThanMs: number = 7 * 24 * 60 * 60 * 1000): number {
  let cleaned = 0
  const cutoffTime = Date.now() - olderThanMs

  try {
    const keysToRemove: string[] = []

    for (let i = 0; i < storage.length; i++) {
      const key = storage.key(i)
      if (!key || !key.includes('_backup_')) continue

      // Extract timestamp from backup key
      const timestampMatch = key.match(/_backup_(\d+)$/)
      if (timestampMatch) {
        const timestamp = parseInt(timestampMatch[1], 10)
        if (timestamp < cutoffTime) {
          keysToRemove.push(key)
        }
      }
    }

    keysToRemove.forEach(key => {
      storage.removeItem(key)
      cleaned++
    })

  } catch (error) {
    console.error('Error cleaning up migration backups:', error)
  }

  return cleaned
}