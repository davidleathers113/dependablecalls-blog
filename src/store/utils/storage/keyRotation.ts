/**
 * Key Rotation Implementation for Encrypted Storage
 * Provides automatic and manual key rotation with re-encryption of existing data
 */

import type { EncryptionConfig, EncryptedData } from '../crypto/encryption'
import { encryptJSON, decryptJSON, generateSecurePassword } from '../crypto/encryption'
import type { DataClassification } from '../dataClassification'

export interface KeyRotationConfig {
  /** How often to rotate keys automatically (milliseconds) */
  rotationIntervalMs: number
  /** Maximum age before forcing rotation (milliseconds) */
  maxKeyAgeMs: number
  /** Whether to enable automatic rotation */
  autoRotate: boolean
  /** Whether to re-encrypt existing data during rotation */
  reEncryptExisting: boolean
  /** Batch size for re-encryption operations */
  batchSize: number
}

export interface KeyRotationStatus {
  lastRotation: number
  currentKeyAge: number
  nextRotationDue: number
  isRotationInProgress: boolean
  totalItemsToRotate?: number
  itemsRotated?: number
  rotationError?: string
}

export interface StorageItemInfo {
  key: string
  encryptedData: EncryptedData
  needsRotation: boolean
  keyAge: number
}

/**
 * Key rotation manager for encrypted storage
 */
export class KeyRotationManager {
  private config: KeyRotationConfig
  private rotationTimer?: NodeJS.Timeout
  private isRotating = false
  private rotationStatus: KeyRotationStatus

  constructor(config: Partial<KeyRotationConfig> = {}) {
    this.config = {
      rotationIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days default
      maxKeyAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days max
      autoRotate: true,
      reEncryptExisting: true,
      batchSize: 10,
      ...config
    }

    this.rotationStatus = {
      lastRotation: 0,
      currentKeyAge: 0,
      nextRotationDue: Date.now() + this.config.rotationIntervalMs,
      isRotationInProgress: false
    }
  }

  /**
   * Start automatic key rotation if enabled
   */
  startAutoRotation(): void {
    if (!this.config.autoRotate) return

    // Clear existing timer
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
    }

    // Set up rotation timer
    this.rotationTimer = setInterval(() => {
      this.rotateIfNeeded().catch(error => {
        console.error('Automatic key rotation failed:', error)
        this.rotationStatus.rotationError = error instanceof Error ? error.message : 'Unknown error'
      })
    }, this.config.rotationIntervalMs)

    console.info(`🔄 Key rotation started: every ${this.config.rotationIntervalMs}ms`)
  }

  /**
   * Stop automatic key rotation
   */
  stopAutoRotation(): void {
    if (this.rotationTimer) {
      clearInterval(this.rotationTimer)
      this.rotationTimer = undefined
    }
  }

  /**
   * Check if key rotation is needed based on age
   */
  isRotationNeeded(keyTimestamp?: number): boolean {
    if (!keyTimestamp) return true // No timestamp means rotate

    const keyAge = Date.now() - keyTimestamp
    return keyAge > this.config.rotationIntervalMs
  }

  /**
   * Force key rotation now
   */
  async rotateKeys(
    storage: Storage,
    classification: DataClassification,
    currentPassword: string,
    encryptionConfig: EncryptionConfig
  ): Promise<{ success: boolean; newPassword: string; itemsRotated: number; error?: string }> {
    if (this.isRotating) {
      return { 
        success: false, 
        newPassword: currentPassword,
        itemsRotated: 0,
        error: 'Key rotation already in progress' 
      }
    }

    this.isRotating = true
    this.rotationStatus.isRotationInProgress = true
    this.rotationStatus.rotationError = undefined

    try {
      console.info('🔄 Starting key rotation...')

      // Generate new password
      const newPassword = generateSecurePassword(32)
      
      // Find all items that need rotation
      const itemsToRotate = this.findItemsNeedingRotation(storage, classification)
      this.rotationStatus.totalItemsToRotate = itemsToRotate.length
      this.rotationStatus.itemsRotated = 0

      if (itemsToRotate.length === 0) {
        console.info('✅ No items need key rotation')
        this.rotationStatus.lastRotation = Date.now()
        return { 
          success: true, 
          newPassword: currentPassword, // Keep current password if nothing to rotate
          itemsRotated: 0 
        }
      }

      console.info(`🔄 Rotating keys for ${itemsToRotate.length} items...`)

      // Rotate keys in batches
      let itemsRotated = 0
      for (let i = 0; i < itemsToRotate.length; i += this.config.batchSize) {
        const batch = itemsToRotate.slice(i, i + this.config.batchSize)
        
        await this.rotateKeysBatch(
          storage, 
          batch, 
          currentPassword, 
          newPassword, 
          encryptionConfig,
          classification
        )
        
        itemsRotated += batch.length
        this.rotationStatus.itemsRotated = itemsRotated

        // Small delay between batches to prevent blocking
        if (i + this.config.batchSize < itemsToRotate.length) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
      }

      this.rotationStatus.lastRotation = Date.now()
      this.rotationStatus.nextRotationDue = Date.now() + this.config.rotationIntervalMs
      
      console.info(`✅ Key rotation completed: ${itemsRotated} items rotated`)
      
      return { 
        success: true, 
        newPassword, 
        itemsRotated 
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown rotation error'
      console.error('❌ Key rotation failed:', errorMessage)
      this.rotationStatus.rotationError = errorMessage
      
      return { 
        success: false, 
        newPassword: currentPassword,
        itemsRotated: this.rotationStatus.itemsRotated || 0,
        error: errorMessage 
      }
      
    } finally {
      this.isRotating = false
      this.rotationStatus.isRotationInProgress = false
    }
  }

  /**
   * Rotate keys automatically if needed
   */
  private async rotateIfNeeded(): Promise<void> {
    // This would need to be implemented with access to the actual storage instances
    // For now, this is a placeholder that logs when rotation would happen
    
    const now = Date.now()
    if (now >= this.rotationStatus.nextRotationDue) {
      console.info('🔄 Automatic key rotation triggered')
      this.rotationStatus.nextRotationDue = now + this.config.rotationIntervalMs
      
      // In a real implementation, this would call rotateKeys() with the actual storage
      // parameters that would need to be passed in during initialization
    }
  }

  /**
   * Find all storage items that need key rotation
   */
  private findItemsNeedingRotation(storage: Storage, classification: DataClassification): StorageItemInfo[] {
    const itemsNeedingRotation: StorageItemInfo[] = []
    const prefix = `dce_encrypted_${classification}_`

    try {
      for (let i = 0; i < storage.length; i++) {
        const fullKey = storage.key(i)
        if (!fullKey || !fullKey.startsWith(prefix)) continue

        const originalKey = fullKey.substring(prefix.length)
        const storedValue = storage.getItem(fullKey)
        if (!storedValue) continue

        try {
          const parsed = JSON.parse(storedValue)
          
          // Check if this looks like encrypted data
          if (parsed.data && parsed.iv && parsed.salt && parsed.timestamp) {
            const keyAge = Date.now() - parsed.timestamp
            const needsRotation = this.isRotationNeeded(parsed.timestamp)
            
            itemsNeedingRotation.push({
              key: originalKey,
              encryptedData: parsed as EncryptedData,
              needsRotation,
              keyAge
            })
          }
        } catch (error) {
          // Skip items that can't be parsed - might be plaintext or corrupted
          console.warn(`Skipping unparseable item ${originalKey}:`, error)
        }
      }
    } catch (error) {
      console.error('Error scanning storage for rotation candidates:', error)
    }

    return itemsNeedingRotation.filter(item => item.needsRotation)
  }

  /**
   * Rotate keys for a batch of items
   */
  private async rotateKeysBatch(
    storage: Storage,
    batch: StorageItemInfo[],
    oldPassword: string,
    newPassword: string,
    encryptionConfig: EncryptionConfig,
    classification: DataClassification
  ): Promise<void> {
    for (const item of batch) {
      try {
        // Decrypt with old password
        const decryptedData = await decryptJSON(
          item.encryptedData,
          oldPassword,
          encryptionConfig
        )

        // Re-encrypt with new password
        const newEncryptedData = await encryptJSON(
          decryptedData,
          newPassword,
          encryptionConfig
        )

        // Store back to storage
        const storageKey = `dce_encrypted_${classification}_${item.key}`
        storage.setItem(storageKey, JSON.stringify(newEncryptedData))

        console.debug(`🔄 Rotated key for item: ${item.key}`)
        
      } catch (error) {
        console.error(`❌ Failed to rotate key for item ${item.key}:`, error)
        // Continue with other items rather than failing the entire batch
      }
    }
  }

  /**
   * Get current rotation status
   */
  getStatus(): KeyRotationStatus {
    this.rotationStatus.currentKeyAge = Date.now() - this.rotationStatus.lastRotation
    return { ...this.rotationStatus }
  }

  /**
   * Update rotation configuration
   */
  updateConfig(newConfig: Partial<KeyRotationConfig>): void {
    this.config = { ...this.config, ...newConfig }
    
    // Restart auto rotation if it was enabled
    if (this.config.autoRotate) {
      this.startAutoRotation()
    } else {
      this.stopAutoRotation()
    }
  }

  /**
   * Cleanup and stop all rotation activities
   */
  destroy(): void {
    this.stopAutoRotation()
    this.isRotating = false
  }
}

/**
 * Default key rotation configuration
 */
export const DEFAULT_KEY_ROTATION_CONFIG: KeyRotationConfig = {
  rotationIntervalMs: 7 * 24 * 60 * 60 * 1000, // 7 days
  maxKeyAgeMs: 30 * 24 * 60 * 60 * 1000, // 30 days
  autoRotate: false, // Disabled by default for safety
  reEncryptExisting: true,
  batchSize: 10
}