/**
 * Encrypted Storage Adapters for DCE Platform
 * Phase 3.1c - Transparent encryption for sensitive data persistence
 * 
 * SECURITY FEATURES:
 * ✅ Real AES-256-GCM encryption (fixed plaintext storage bug)
 * ✅ Safari Private Mode handling (fixed crash loops) 
 * ✅ Performance caching (fixed O(n) key scans)
 * ✅ Key rotation capability (PCI-DSS compliance)
 * ✅ Type-safe public API (fixed private field access)
 * ✅ Comprehensive migration support
 * 
 * CHANGES FROM PREVIOUS VERSION:
 * - Fixed critical security bug: data is now actually encrypted
 * - Added Safari Private Mode graceful fallback
 * - Implemented performance caching for key operations
 * - Added proper async encryption/decryption paths
 * - Removed private field access via bracket notation
 */

import {
  encryptJSON,
  decryptJSON,
  generateSessionPassword,
  isWebCryptoSupported,
  type EncryptedData,
  type EncryptionConfig,
  DEFAULT_CONFIG,
} from '../crypto/encryption'
import {
  DataClassification,
  StorageType,
  requiresEncryption,
  isStorageAllowed,
} from '../dataClassification'
import { globalStorageCache, type StorageCache } from './storageCache'
import { createSafeStorage, testStorageAvailability as _testStorageAvailability } from './safariCompat'
import { KeyRotationManager, DEFAULT_KEY_ROTATION_CONFIG, type KeyRotationConfig } from './keyRotation'
import { StorageMigrator, needsMigration, type MigrationResult as _MigrationResult } from './migration'

/**
 * Storage interface matching Web Storage API
 */
export interface EncryptedStorageInterface {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
  removeItem(key: string): void
  clear(): void
  key(index: number): string | null
  readonly length: number
}

/**
 * Encrypted storage configuration
 */
export interface EncryptedStorageConfig {
  storageType: StorageType
  classification: DataClassification
  sessionId?: string | undefined
  encryptionConfig?: EncryptionConfig
  keyRotationConfig?: Partial<KeyRotationConfig>
  fallbackToMemory?: boolean
  enablePerformanceCache?: boolean
  maxJsonParseSize?: number
}

/**
 * Storage entry metadata
 */
export interface StorageEntry {
  key: string
  encryptedData: EncryptedData
  classification: DataClassification
  created: number
  accessed: number
}

/**
 * Memory storage implementation (fallback)
 */
class MemoryStorage implements Storage {
  private data = new Map<string, string>()

  get length(): number {
    return this.data.size
  }

  getItem(key: string): string | null {
    return this.data.get(key) || null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }

  removeItem(key: string): void {
    this.data.delete(key)
  }

  clear(): void {
    this.data.clear()
  }

  key(index: number): string | null {
    const keys = Array.from(this.data.keys())
    return keys[index] || null
  }
}

/**
 * Encrypted storage adapter with security fixes
 */
export class EncryptedStorage implements EncryptedStorageInterface {
  private storage: Storage
  private password: string
  private config: EncryptedStorageConfig
  private encryptionConfig: EncryptionConfig
  private memoryFallback = new MemoryStorage()
  private keyRotationManager?: KeyRotationManager
  private storageCache: StorageCache
  private readonly maxJsonParseSize: number

  constructor(config: EncryptedStorageConfig) {
    this.config = {
      enablePerformanceCache: true,
      maxJsonParseSize: 1024 * 1024, // 1MB limit for security
      ...config
    }
    this.encryptionConfig = config.encryptionConfig || DEFAULT_CONFIG
    this.maxJsonParseSize = this.config.maxJsonParseSize || 1024 * 1024

    // Generate session-based password
    this.password = generateSessionPassword(config.sessionId)

    // Initialize performance cache
    this.storageCache = globalStorageCache

    // Initialize storage with Safari compatibility
    this.storage = this.initializeStorage()

    // Initialize key rotation if configured
    if (config.keyRotationConfig) {
      this.keyRotationManager = new KeyRotationManager({
        ...DEFAULT_KEY_ROTATION_CONFIG,
        ...config.keyRotationConfig
      })
      
      if (config.keyRotationConfig.autoRotate) {
        this.keyRotationManager.startAutoRotation()
      }
    }

    // Auto-migrate legacy data if needed
    this.autoMigrateIfNeeded().catch(error => {
      console.warn('Auto-migration failed:', error)
    })
  }

  /**
   * Initialize the underlying storage with Safari Private Mode handling
   */
  private initializeStorage(): Storage {
    switch (this.config.storageType) {
      case StorageType.LOCAL:
        try {
          return createSafeStorage('localStorage', this.config.fallbackToMemory)
        } catch (error) {
          console.warn('Failed to initialize localStorage with Safari compat:', error)
          break
        }

      case StorageType.SESSION:
        try {
          return createSafeStorage('sessionStorage', this.config.fallbackToMemory)
        } catch (error) {
          console.warn('Failed to initialize sessionStorage with Safari compat:', error)
          break
        }

      case StorageType.MEMORY:
      default:
        return this.memoryFallback
    }

    // Fallback to memory storage if enabled
    if (this.config.fallbackToMemory !== false) {
      console.warn(`⚠️  Falling back to memory storage for ${this.config.storageType}`)
      return this.memoryFallback
    }

    throw new Error(`${this.config.storageType} storage not available and fallback disabled`)
  }

  /**
   * Validate storage operation against data classification with enhanced checks
   */
  private validateOperation(operation: 'read' | 'write'): void {
    if (operation === 'write') {
      const allowed = isStorageAllowed(this.config.classification, this.config.storageType)
      if (!allowed) {
        throw new Error(
          `Storage type ${this.config.storageType} not allowed for ${this.config.classification} data`
        )
      }
    }

    // Check encryption requirement
    if (requiresEncryption(this.config.classification) && !isWebCryptoSupported()) {
      throw new Error('Web Crypto API required for encrypted storage but not available')
    }

    // Additional security check: validate storage is still available
    if (!this.isAvailable()) {
      throw new Error('Storage is no longer available (possible Safari Private Mode change)')
    }
  }

  /**
   * Create storage key with namespace
   */
  private createStorageKey(key: string): string {
    return `dce_encrypted_${this.config.classification}_${key}`
  }

  /**
   * Check if data should be encrypted based on classification
   */
  private shouldEncrypt(): boolean {
    return requiresEncryption(this.config.classification) && isWebCryptoSupported()
  }

  /**
   * Safely parse JSON with size limits (security hardening)
   */
  private parseJsonSafely<T = unknown>(value: string): T {
    if (value.length > this.maxJsonParseSize) {
      throw new Error(`JSON data too large: ${value.length} bytes (max: ${this.maxJsonParseSize})`)
    }
    
    try {
      return JSON.parse(value) as T
    } catch (error) {
      throw new Error(`Invalid JSON data: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Auto-migrate legacy plaintext/fake-encrypted data
   */
  private async autoMigrateIfNeeded(): Promise<void> {
    if (!this.shouldEncrypt()) return // No encryption needed
    
    try {
      if (needsMigration(this.storage, this.config.classification)) {
        console.info('🔄 Auto-migrating legacy encrypted storage data...')
        
        const migrator = new StorageMigrator(
          this.config.classification,
          this.password,
          this.encryptionConfig
        )
        
        const result = await migrator.migrateStorage(this.storage, {
          batchSize: 5, // Small batches for auto-migration
          validateAfterMigration: true,
          backupOriginal: false, // Don't backup during auto-migration
          dryRun: false
        })
        
        if (result.success) {
          console.info(`✅ Auto-migration completed: ${result.itemsMigrated} items`)
        } else {
          console.warn(`⚠️  Auto-migration partially failed: ${result.itemsFailed}/${result.itemsFound} items failed`)
        }
      }
    } catch (error) {
      console.error('❌ Auto-migration error:', error)
      // Don't throw - allow storage to function even if migration fails
    }
  }

  /**
   * Get item from storage with proper decryption
   * WARNING: Synchronous interface limits encryption capability
   * Use AsyncEncryptedStorage for full encryption support
   */
  getItem(key: string): string | null {
    try {
      this.validateOperation('read')
      
      const storageKey = this.createStorageKey(key)
      const storedValue = this.storage.getItem(storageKey)
      
      if (!storedValue) {
        return null
      }

      // If encryption is required, we can't decrypt synchronously
      if (this.shouldEncrypt()) {
        console.warn(
          `⚠️  Cannot decrypt ${key} synchronously. ` +
          'Use AsyncEncryptedStorage.getItem() for encrypted data.'
        )
        return null // Can't decrypt synchronously
      }

      // Return plain data for non-encrypted classifications
      return storedValue
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error)
      return null
    }
  }

  /**
   * Set item in storage with synchronous limitation warning
   * WARNING: Cannot encrypt synchronously - use AsyncEncryptedStorage.setItem()
   */
  setItem(key: string, value: string): void {
    try {
      // Validation errors should be thrown (programming errors)
      this.validateOperation('write')
      
      const storageKey = this.createStorageKey(key)

      // If encryption is required, we cannot do it synchronously
      if (this.shouldEncrypt()) {
        throw new Error(
          `Cannot encrypt data synchronously for key '${key}'. ` +
          'Use AsyncEncryptedStorage.setItem() for encrypted data.'
        )
      }

      // Update cache
      if (this.config.enablePerformanceCache) {
        const namespace = this.getNamespace()
        this.storageCache.addKey(namespace, key)
      }

      // Storage-level errors should be logged but not thrown (environmental issues)
      try {
        this.storage.setItem(storageKey, value)
      } catch (storageError) {
        console.error(`Failed to store item ${key}:`, storageError)
        // Don't throw storage errors - they're environmental, not programming errors
      }
    } catch (error) {
      // Only re-throw validation/programming errors
      if (error instanceof Error && 
          (error.message.includes('not allowed for') || 
           error.message.includes('Cannot encrypt data synchronously') ||
           error.message.includes('Web Crypto API required'))) {
        throw error
      }
      console.error(`Failed to set item ${key}:`, error)
    }
  }

  /**
   * Remove item from storage with cache update
   */
  removeItem(key: string): void {
    try {
      const storageKey = this.createStorageKey(key)
      
      // Update cache
      if (this.config.enablePerformanceCache) {
        const namespace = this.getNamespace()
        this.storageCache.removeKey(namespace, key)
      }
      
      this.storage.removeItem(storageKey)
    } catch (error) {
      console.error(`Failed to remove item ${key}:`, error)
    }
  }

  /**
   * Clear all items with our namespace using optimized approach
   */
  clear(): void {
    try {
      const namespace = this.getNamespace()
      let keysToRemove: string[]

      // Try to use cached keys if available
      if (this.config.enablePerformanceCache) {
        const cachedKeys = this.storageCache.get(namespace)
        if (cachedKeys) {
          keysToRemove = cachedKeys.map(key => this.createStorageKey(key))
        } else {
          keysToRemove = this.scanForNamespacedKeys()
        }
        
        // Clear cache
        this.storageCache.clear(namespace)
      } else {
        keysToRemove = this.scanForNamespacedKeys()
      }

      // Remove all matching keys
      keysToRemove.forEach(key => this.storage.removeItem(key))
    } catch (error) {
      console.error('Failed to clear storage:', error)
    }
  }

  /**
   * Scan storage for keys with our namespace prefix
   */
  private scanForNamespacedKeys(): string[] {
    const prefix = `dce_encrypted_${this.config.classification}_`
    const keysToRemove: string[] = []

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (key && key.startsWith(prefix)) {
        keysToRemove.push(key)
      }
    }

    return keysToRemove
  }

  /**
   * Get key at index using performance cache when possible
   */
  key(index: number): string | null {
    try {
      let matchingKeys: string[]
      
      // Use cache if available and enabled
      if (this.config.enablePerformanceCache) {
        const namespace = this.getNamespace()
        const cachedKeys = this.storageCache.get(namespace)
        
        if (cachedKeys) {
          matchingKeys = cachedKeys
        } else {
          // Cache miss - scan and cache
          matchingKeys = this.scanAndCacheKeys()
        }
      } else {
        // No caching - scan directly
        matchingKeys = this.scanForKeys()
      }

      return matchingKeys[index] || null
    } catch (error) {
      console.error('Failed to get key at index:', error)
      return null
    }
  }

  /**
   * Scan for keys and update cache
   */
  private scanAndCacheKeys(): string[] {
    const keys = this.scanForKeys()
    
    if (this.config.enablePerformanceCache) {
      const namespace = this.getNamespace()
      this.storageCache.set(namespace, keys)
    }
    
    return keys
  }

  /**
   * Scan storage for our namespaced keys
   */
  private scanForKeys(): string[] {
    const prefix = `dce_encrypted_${this.config.classification}_`
    const matchingKeys: string[] = []

    for (let i = 0; i < this.storage.length; i++) {
      const key = this.storage.key(i)
      if (key && key.startsWith(prefix)) {
        // Remove our prefix to return the original key
        matchingKeys.push(key.substring(prefix.length))
      }
    }

    return matchingKeys
  }

  /**
   * Get number of items in our namespace using performance cache
   */
  get length(): number {
    try {
      if (this.config.enablePerformanceCache) {
        const namespace = this.getNamespace()
        const cachedKeys = this.storageCache.get(namespace)
        
        if (cachedKeys) {
          return cachedKeys.length
        }
        
        // Cache miss - scan and cache
        const keys = this.scanAndCacheKeys()
        return keys.length
      }
      
      // No caching - count directly
      const prefix = `dce_encrypted_${this.config.classification}_`
      let count = 0

      for (let i = 0; i < this.storage.length; i++) {
        const key = this.storage.key(i)
        if (key && key.startsWith(prefix)) {
          count++
        }
      }

      return count
    } catch (error) {
      console.error('Failed to get storage length:', error)
      return 0
    }
  }

  /**
   * Get namespace for caching
   */
  private getNamespace(): string {
    return `${this.config.storageType}_${this.config.classification}`
  }

  /**
   * DEPRECATED: This method had a critical security bug (plaintext storage)
   * Use AsyncEncryptedStorage for proper encryption
   * @deprecated This method is intentionally unused - throws security error
   */
   
  // @ts-expect-error: Intentionally unused deprecated method
  private encryptDataForStorage(_data: string): never {
    throw new Error(
      'SECURITY: Synchronous encryption not supported. ' +
      'This method previously stored plaintext data. ' +
      'Use AsyncEncryptedStorage.setItem() for proper encryption.'
    )
  }

  /**
   * DEPRECATED: This method had a data loss bug
   * Use AsyncEncryptedStorage for proper decryption
   * @deprecated This method is intentionally unused - throws security error
   */
   
  // @ts-expect-error: Intentionally unused deprecated method
  private decryptStoredData(_storedValue: string): never {
    throw new Error(
      'SECURITY: Synchronous decryption not supported. ' +
      'This method previously lost encrypted data. ' +
      'Use AsyncEncryptedStorage.getItem() for proper decryption.'
    )
  }

  /**
   * Check if storage is available and working
   */
  isAvailable(): boolean {
    try {
      const testKey = '__availability_test__'
      this.storage.setItem(testKey, 'test')
      const result = this.storage.getItem(testKey)
      this.storage.removeItem(testKey)
      return result === 'test'
    } catch {
      return false
    }
  }

  /**
   * Get comprehensive storage statistics
   */
  getStats(): {
    storageType: StorageType
    classification: DataClassification
    itemCount: number
    isEncrypted: boolean
    isAvailable: boolean
    cacheStats?: ReturnType<StorageCache['getStats']>
    keyRotationStatus?: ReturnType<KeyRotationManager['getStatus']>
    migrationNeeded: boolean
  } {
    return {
      storageType: this.config.storageType,
      classification: this.config.classification,
      itemCount: this.length,
      isEncrypted: this.shouldEncrypt(),
      isAvailable: this.isAvailable(),
      cacheStats: this.config.enablePerformanceCache ? this.storageCache.getStats() : undefined,
      keyRotationStatus: this.keyRotationManager?.getStatus(),
      migrationNeeded: this.shouldEncrypt() ? needsMigration(this.storage, this.config.classification) : false
    }
  }

  // =============================================================================
  // PUBLIC ACCESSORS (replaces private field access via bracket notation)
  // =============================================================================

  /**
   * Get the underlying storage instance (replaces private field access)
   */
  getStorageInstance(): Storage {
    return this.storage
  }

  /**
   * Get the current password (replaces private field access)
   */
  getPassword(): string {
    return this.password
  }

  /**
   * Get encryption configuration (replaces private field access)
   */
  getEncryptionConfig(): EncryptionConfig {
    return this.encryptionConfig
  }

  /**
   * Get storage configuration
   */
  getConfig(): EncryptedStorageConfig {
    return { ...this.config }
  }

  /**
   * Check if encryption should be used
   */
  getShouldEncrypt(): boolean {
    return this.shouldEncrypt()
  }

  /**
   * Validate an operation (replaces private method access)
   */
  validateStorageOperation(operation: 'read' | 'write'): void {
    this.validateOperation(operation)
  }

  /**
   * Create storage key with namespace (replaces private method access)
   */
  createNamespacedKey(key: string): string {
    return this.createStorageKey(key)
  }

  // =============================================================================
  // KEY ROTATION AND MIGRATION
  // =============================================================================

  /**
   * Manually trigger key rotation
   */
  async rotateKeys(): Promise<{ success: boolean; itemsRotated: number; newPassword?: string; error?: string }> {
    if (!this.keyRotationManager) {
      return { success: false, itemsRotated: 0, error: 'Key rotation not configured' }
    }

    const result = await this.keyRotationManager.rotateKeys(
      this.storage,
      this.config.classification,
      this.password,
      this.encryptionConfig
    )

    if (result.success && result.newPassword !== this.password) {
      // Update password after successful rotation
      this.password = result.newPassword
      console.info('🔑 Password updated after key rotation')
    }

    return result
  }

  /**
   * Get key rotation status
   */
  getKeyRotationStatus(): ReturnType<KeyRotationManager['getStatus']> | null {
    return this.keyRotationManager?.getStatus() || null
  }

  /**
   * Manually trigger migration of legacy data
   */
  async migrateData(options?: { dryRun?: boolean; backupOriginal?: boolean }): Promise<_MigrationResult> {
    if (!this.shouldEncrypt()) {
      return {
        success: true,
        itemsFound: 0,
        itemsMigrated: 0,
        itemsFailed: 0,
        errors: [],
        timeTaken: 0
      }
    }

    const migrator = new StorageMigrator(
      this.config.classification,
      this.password,
      this.encryptionConfig
    )

    return migrator.migrateStorage(this.storage, {
      batchSize: 10,
      validateAfterMigration: true,
      dryRun: options?.dryRun || false,
      backupOriginal: options?.backupOriginal || false
    })
  }

  /**
   * Get migration statistics
   */
  getMigrationStats(): ReturnType<StorageMigrator['getMigrationStats']> {
    const migrator = new StorageMigrator(
      this.config.classification,
      this.password,
      this.encryptionConfig
    )
    return migrator.getMigrationStats(this.storage)
  }

  /**
   * Force refresh of performance cache
   */
  refreshCache(): void {
    if (this.config.enablePerformanceCache) {
      const namespace = this.getNamespace()
      this.storageCache.invalidate(namespace)
      // Force a rescan to rebuild cache
      this.scanAndCacheKeys()
    }
  }

  /**
   * Add key to performance cache (for async operations)
   */
  addKeyToCache(key: string): void {
    if (this.config.enablePerformanceCache) {
      const namespace = this.getNamespace()
      this.storageCache.addKey(namespace, key)
    }
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.keyRotationManager) {
      this.keyRotationManager.destroy()
    }
    
    if (this.config.enablePerformanceCache) {
      const namespace = this.getNamespace()
      this.storageCache.invalidate(namespace)
    }
  }

  /**
   * Safe JSON parsing with size limits (security hardening) - public accessor
   */
  safeJsonParse<T = unknown>(value: string): T {
    return this.parseJsonSafely<T>(value)
  }
}

/**
 * Async encrypted storage with real encryption (SECURITY FIX)
 * This class provides proper async encryption/decryption
 */
export class AsyncEncryptedStorage {
  private encryptedStorage: EncryptedStorage

  constructor(config: EncryptedStorageConfig) {
    this.encryptedStorage = new EncryptedStorage(config)
  }

  /**
   * Async get with proper decryption (SECURITY FIX - no more private field access)
   */
  async getItem<T = unknown>(key: string): Promise<T | null> {
    try {
      const storageKey = this.encryptedStorage.createNamespacedKey(key)
      const storedValue = this.encryptedStorage.getStorageInstance().getItem(storageKey)
      
      if (!storedValue) {
        return null
      }

      // Safely parse JSON with size limits
      let parsedData: unknown
      try {
        parsedData = this.encryptedStorage.safeJsonParse(storedValue)
      } catch (error) {
        console.error(`Failed to parse stored data for ${key}:`, error)
        return null
      }

      // Handle encrypted data
      if (this.encryptedStorage.getShouldEncrypt()) {
        try {
          // Check for real encrypted format
          if (typeof parsedData === 'object' && parsedData !== null) {
            const obj = parsedData as Record<string, unknown>
            if (obj.data && obj.iv && obj.salt && obj.algorithm) {
              const decrypted = await decryptJSON<T>(
                parsedData as EncryptedData, 
                this.encryptedStorage.getPassword(),
                this.encryptedStorage.getEncryptionConfig()
              )
              return decrypted
            }
          }
          
          // Check for legacy fake encrypted format (migration case)
          if (typeof parsedData === 'object' && parsedData !== null) {
            const obj = parsedData as Record<string, unknown>
            if (obj.type === 'encrypted_promise' && obj.data) {
              console.warn(`⚠️  Found legacy fake-encrypted data for ${key} - returning plaintext`)
              return obj.data as T
            }
          }
          
          console.warn(`⚠️  Expected encrypted data for ${key} but found unencrypted format`)
          return null
        } catch (error) {
          console.error('Failed to decrypt data:', error)
          return null
        }
      }

      // Handle plain data for non-encrypted classifications
      try {
        return parsedData as T
      } catch {
        return storedValue as T
      }
    } catch (error) {
      console.error(`Failed to get item ${key}:`, error)
      return null
    }
  }

  /**
   * Async set with real encryption (SECURITY FIX - no more private field access)
   */
  async setItem<T>(key: string, value: T): Promise<void> {
    try {
      this.encryptedStorage.validateStorageOperation('write')
      
      const storageKey = this.encryptedStorage.createNamespacedKey(key)
      let valueToStore: string

      if (this.encryptedStorage.getShouldEncrypt()) {
        // REAL encryption (fixes the critical security bug)
        const encryptedData = await encryptJSON(
          value, 
          this.encryptedStorage.getPassword(),
          this.encryptedStorage.getEncryptionConfig()
        )
        valueToStore = JSON.stringify(encryptedData)
        console.debug(`🔒 Encrypted data for storage: ${key}`)
      } else {
        // Store as plain JSON for non-encrypted classifications
        valueToStore = JSON.stringify(value)
      }

      // Update cache before storing (using public accessor)
      this.encryptedStorage.addKeyToCache(key)

      this.encryptedStorage.getStorageInstance().setItem(storageKey, valueToStore)
    } catch (error) {
      console.error(`Failed to set item ${key}:`, error)
      throw error
    }
  }

  /**
   * Remove item
   */
  removeItem(key: string): void {
    this.encryptedStorage.removeItem(key)
  }

  /**
   * Clear storage
   */
  clear(): void {
    this.encryptedStorage.clear()
  }

  /**
   * Get stats
   */
  getStats() {
    return this.encryptedStorage.getStats()
  }
}

/**
 * Storage factory for creating appropriate storage instances
 */
export class StorageFactory {
  /**
   * Create encrypted storage based on classification and requirements
   */
  static createStorage(
    classification: DataClassification,
    storageType: StorageType = StorageType.LOCAL,
    sessionId?: string
  ): EncryptedStorage {
    return new EncryptedStorage({
      storageType,
      classification,
      sessionId: sessionId || undefined,
      fallbackToMemory: true,
    })
  }

  /**
   * Create async encrypted storage
   */
  static createAsyncStorage(
    classification: DataClassification,
    storageType: StorageType = StorageType.LOCAL,
    sessionId?: string
  ): AsyncEncryptedStorage {
    return new AsyncEncryptedStorage({
      storageType,
      classification,
      sessionId: sessionId || undefined,
      fallbackToMemory: true,
    })
  }

  /**
   * Create storage for Zustand persist middleware
   */
  static createZustandStorage(
    classification: DataClassification,
    storageType: StorageType = StorageType.LOCAL,
    sessionId?: string
  ) {
    const asyncStorage = new AsyncEncryptedStorage({
      storageType,
      classification,
      sessionId: sessionId || undefined,
      fallbackToMemory: true,
    })

    return {
      getItem: async (name: string): Promise<string | null> => {
        const value = await asyncStorage.getItem<string>(name)
        return value
      },
      setItem: async (name: string, value: string): Promise<void> => {
        await asyncStorage.setItem(name, value)
      },
      removeItem: async (name: string): Promise<void> => {
        asyncStorage.removeItem(name)
      },
    }
  }
}

/**
 * Utility functions for storage management
 */
export const StorageUtils = {
  /**
   * Test storage functionality
   */
  async testStorage(storage: AsyncEncryptedStorage): Promise<boolean> {
    try {
      const testKey = '__storage_test__'
      const testValue = { test: true, timestamp: Date.now() }
      
      await storage.setItem(testKey, testValue)
      const retrieved = await storage.getItem<typeof testValue>(testKey)
      storage.removeItem(testKey)
      
      return retrieved?.test === true
    } catch {
      return false
    }
  },

  /**
   * Migrate data between storage types
   */
  async migrateStorage(
    fromStorage: AsyncEncryptedStorage,
    toStorage: AsyncEncryptedStorage,
    keys: string[]
  ): Promise<{ success: number; failed: number }> {
    let success = 0
    let failed = 0

    for (const key of keys) {
      try {
        const value = await fromStorage.getItem(key)
        if (value !== null) {
          await toStorage.setItem(key, value)
          fromStorage.removeItem(key)
          success++
        }
      } catch (error) {
        console.error(`Failed to migrate key ${key}:`, error)
        failed++
      }
    }

    return { success, failed }
  },

  /**
   * Clean up expired encrypted data
   */
  cleanupExpiredData(_storage: EncryptedStorage, maxAgeMs: number = 7 * 24 * 60 * 60 * 1000): void {
    // This would need to be implemented to check encryption timestamps
    // and remove expired entries based on maxAgeMs
    console.log(`Cleanup not implemented in current version (maxAge: ${maxAgeMs}ms)`)
  },
}

// Re-export types for convenience (avoid duplicate exports)
// EncryptedStorageInterface, EncryptedStorageConfig, and StorageEntry are already exported above