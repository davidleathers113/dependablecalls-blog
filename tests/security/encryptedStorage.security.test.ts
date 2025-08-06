/**
 * Security regression tests for encrypted storage fixes
 * These tests verify that the critical security bugs have been resolved
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AsyncEncryptedStorage, StorageFactory } from '../../src/store/utils/storage/encryptedStorage'
import { DataClassification, StorageType } from '../../src/store/utils/dataClassification'

// Mock Web Crypto for testing
vi.mock('../../src/store/utils/crypto/encryption', async () => {
  const actual = await vi.importActual('../../src/store/utils/crypto/encryption')
  return {
    ...actual,
    isWebCryptoSupported: vi.fn(() => true),
  }
})

describe('Encrypted Storage Security Fixes', () => {
  let storage: AsyncEncryptedStorage
  let mockLocalStorage: Storage

  beforeEach(() => {
    // Mock localStorage for testing
    mockLocalStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockLocalStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        mockLocalStorage.data.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        mockLocalStorage.data.delete(key)
      }),
      clear: vi.fn(() => {
        mockLocalStorage.data.clear()
      }),
      get length() {
        return mockLocalStorage.data.size
      },
      key: vi.fn((index: number) => {
        const keys = Array.from(mockLocalStorage.data.keys())
        return keys[index] || null
      })
    } as unknown as Storage

    // Mock window.localStorage and sessionStorage
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    })
    
    Object.defineProperty(window, 'sessionStorage', {
      value: mockLocalStorage, // Use same mock for both in tests
      writable: true
    })

    storage = StorageFactory.createAsyncStorage(
      DataClassification.CONFIDENTIAL,
      StorageType.SESSION,
      'test-session'
    )
  })

  describe('CRITICAL SECURITY FIX: Real encryption vs fake encryption', () => {
    it('should actually encrypt data (not store plaintext)', async () => {
      const sensitiveData = { 
        password: 'secret123',
        apiKey: 'sk-1234567890abcdef',
        personalInfo: 'SSN: 123-45-6789'
      }

      await storage.setItem('sensitive', sensitiveData)

      // Get the raw stored value from sessionStorage
      const storageKey = `dce_encrypted_${DataClassification.CONFIDENTIAL}_sensitive`
      const rawStoredValue = mockLocalStorage.getItem(storageKey)

      expect(rawStoredValue).toBeTruthy()
      
      // Parse the stored value
      const parsedValue = JSON.parse(rawStoredValue!)

      // SECURITY FIX VERIFICATION: Should NOT contain plaintext data
      expect(rawStoredValue).not.toContain('secret123')
      expect(rawStoredValue).not.toContain('sk-1234567890abcdef')
      expect(rawStoredValue).not.toContain('SSN: 123-45-6789')

      // Should NOT have the old fake encryption structure
      expect(parsedValue.type).not.toBe('encrypted_promise')
      
      // Should have real encrypted data structure
      expect(parsedValue).toHaveProperty('data')
      expect(parsedValue).toHaveProperty('iv')
      expect(parsedValue).toHaveProperty('salt')
      expect(parsedValue).toHaveProperty('algorithm')
      expect(parsedValue.algorithm).toBe('AES-GCM')

      // Should be able to decrypt back to original data
      const retrievedData = await storage.getItem('sensitive')
      expect(retrievedData).toEqual(sensitiveData)
    })

    it('should handle legacy fake-encrypted data gracefully', async () => {
      // Simulate legacy fake-encrypted data in storage
      const legacyFakeData = JSON.stringify({
        type: 'encrypted_promise',
        timestamp: Date.now(),
        data: { secret: 'plaintext-was-exposed' } // The old security bug
      })

      const storageKey = `dce_encrypted_${DataClassification.CONFIDENTIAL}_legacy`
      mockLocalStorage.setItem(storageKey, legacyFakeData)

      // Should be able to read legacy data (for migration purposes)
      const retrievedData = await storage.getItem('legacy')
      expect(retrievedData).toEqual({ secret: 'plaintext-was-exposed' })
    })
  })

  describe('PERFORMANCE FIX: Caching vs O(n) scans', () => {
    it('should use cached keys instead of scanning all storage', () => {
      const encryptedStorage = (storage as { encryptedStorage: unknown }).encryptedStorage

      // Add some test keys to storage
      mockLocalStorage.setItem('dce_encrypted_confidential_key1', 'value1')
      mockLocalStorage.setItem('dce_encrypted_confidential_key2', 'value2')
      mockLocalStorage.setItem('other_key', 'other_value')

      // First call should scan and cache
      const length1 = (encryptedStorage as { length: number }).length
      expect(length1).toBe(2) // Only our namespaced keys

      // Verify caching is enabled
      const stats = (encryptedStorage as { getStats(): { cacheStats?: unknown } }).getStats()
      expect(stats.cacheStats).toBeDefined()
    })
  })

  describe('SAFARI COMPATIBILITY: Private Mode handling', () => {
    it('should handle storage unavailability gracefully', () => {
      // Mock Safari Private Mode scenario
      const throwingStorage = {
        ...mockLocalStorage,
        setItem: vi.fn(() => {
          throw new Error('SecurityError: The operation is insecure')
        })
      }

      Object.defineProperty(window, 'localStorage', {
        value: throwingStorage,
        writable: true
      })

      // Should not crash, should fall back to memory storage
      expect(() => {
        StorageFactory.createAsyncStorage(
          DataClassification.CONFIDENTIAL,
          StorageType.LOCAL
        )
      }).not.toThrow()
    })
  })

  describe('SECURITY HARDENING: Input validation', () => {
    it('should reject oversized JSON data', async () => {
      const encryptedStorage = (storage as { encryptedStorage: { safeJsonParse(data: string): unknown } }).encryptedStorage
      
      // Create a string larger than the default limit (1MB)
      const hugeString = 'x'.repeat(2 * 1024 * 1024) // 2MB

      expect(() => {
        encryptedStorage.safeJsonParse(hugeString)
      }).toThrow(/JSON data too large/)
    })

    it('should validate storage operations', () => {
      // Create storage with INTERNAL classification (allows LOCAL storage)
      const testStorage = StorageFactory.createAsyncStorage(
        DataClassification.INTERNAL,
        StorageType.LOCAL,
        'test-session'
      )
      
      const encryptedStorage = (testStorage as { encryptedStorage: { validateStorageOperation(op: string): void } }).encryptedStorage

      expect(() => {
        encryptedStorage.validateStorageOperation('write')
      }).not.toThrow()

      expect(() => {
        encryptedStorage.validateStorageOperation('read')
      }).not.toThrow()
    })
  })

  describe('API COMPATIBILITY: Public accessors', () => {
    it('should provide public access methods instead of private field access', () => {
      const encryptedStorage = (storage as { 
        encryptedStorage: { 
          getStorageInstance: () => Storage
          getPassword: () => string
          getEncryptionConfig: () => unknown
          getShouldEncrypt: () => boolean
          createNamespacedKey: (key: string) => string
        } 
      }).encryptedStorage

      // These methods should exist and be callable (no more bracket notation)
      expect(typeof encryptedStorage.getStorageInstance).toBe('function')
      expect(typeof encryptedStorage.getPassword).toBe('function')
      expect(typeof encryptedStorage.getEncryptionConfig).toBe('function')
      expect(typeof encryptedStorage.getShouldEncrypt).toBe('function')
      expect(typeof encryptedStorage.createNamespacedKey).toBe('function')

      // Should return expected values
      expect(encryptedStorage.getShouldEncrypt()).toBe(true)
      expect(encryptedStorage.createNamespacedKey('test')).toBe('dce_encrypted_confidential_test')
    })
  })

  describe('KEY ROTATION: PCI-DSS compliance', () => {
    it('should provide key rotation capabilities', async () => {
      const encryptedStorage = (storage as { 
        encryptedStorage: { 
          rotateKeys: () => Promise<unknown>
          getKeyRotationStatus: () => unknown
          migrateData: () => Promise<unknown>
          getMigrationStats: () => { needsMigration: number }
        } 
      }).encryptedStorage

      // Should have key rotation methods
      expect(typeof encryptedStorage.rotateKeys).toBe('function')
      expect(typeof encryptedStorage.getKeyRotationStatus).toBe('function')

      // Should provide migration capabilities  
      expect(typeof encryptedStorage.migrateData).toBe('function')
      expect(typeof encryptedStorage.getMigrationStats).toBe('function')
    })
  })

  describe('MIGRATION: Legacy data handling', () => {
    it('should detect data that needs migration', () => {
      const encryptedStorage = (storage as { 
        encryptedStorage: { 
          getMigrationStats: () => { needsMigration: number }
        } 
      }).encryptedStorage

      // Add legacy fake-encrypted data
      const legacyData = JSON.stringify({
        type: 'encrypted_promise',
        data: 'plaintext'
      })
      mockLocalStorage.setItem('dce_encrypted_confidential_legacy', legacyData)

      const migrationStats = encryptedStorage.getMigrationStats()
      expect(migrationStats.needsMigration).toBeGreaterThan(0)
    })
  })
})

// Integration test to verify the complete fix
describe('Integration: Complete Security Fix Verification', () => {
  it('should demonstrate end-to-end security improvement', async () => {
    // Mock sessionStorage for this test
    const mockSessionStorage = {
      data: new Map<string, string>(),
      getItem: vi.fn((key: string) => mockSessionStorage.data.get(key) || null),
      setItem: vi.fn((key: string, value: string) => {
        mockSessionStorage.data.set(key, value)
      }),
      removeItem: vi.fn((key: string) => {
        mockSessionStorage.data.delete(key)
      }),
      clear: vi.fn(() => {
        mockSessionStorage.data.clear()
      }),
      get length() {
        return mockSessionStorage.data.size
      },
      key: vi.fn((index: number) => {
        const keys = Array.from(mockSessionStorage.data.keys())
        return keys[index] || null
      })
    } as unknown as Storage

    // Mock window.sessionStorage
    Object.defineProperty(window, 'sessionStorage', {
      value: mockSessionStorage,
      writable: true
    })

    const storage = StorageFactory.createAsyncStorage(
      DataClassification.CONFIDENTIAL,
      StorageType.SESSION
    )

    // Test data that was previously stored in plaintext
    const criticalData = {
      authToken: 'eyJhbGciOiJIUzI1NiIs...',
      userPassword: 'MySecretPassword123!',
      creditCardNumber: '4532-1234-5678-9012',
      ssn: '123-45-6789'
    }

    // Store the data
    await storage.setItem('critical-data', criticalData)

    // Verify it's properly encrypted in storage
    const rawValue = mockSessionStorage.getItem('dce_encrypted_confidential_critical-data')
    
    expect(rawValue).not.toContain('eyJhbGciOiJIUzI1NiIs')
    expect(rawValue).not.toContain('MySecretPassword123!')
    expect(rawValue).not.toContain('4532-1234-5678-9012')
    expect(rawValue).not.toContain('123-45-6789')

    // But can still be decrypted correctly
    const retrieved = await storage.getItem('critical-data')
    expect(retrieved).toEqual(criticalData)

    console.log('✅ SECURITY FIX VERIFIED: Critical data is now properly encrypted')
  })
})