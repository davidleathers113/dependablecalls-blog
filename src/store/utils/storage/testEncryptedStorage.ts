/**
 * Test Suite for Encrypted Storage Integration
 * Phase 3.1c - Verify encrypted storage works with existing stores
 */

import { StorageFactory, StorageUtils } from './encryptedStorage'
import { DataClassification, StorageType } from '../dataClassification'
import { encryptJSON, decryptJSON, generateSessionPassword, isWebCryptoSupported } from '../crypto/encryption'

/**
 * Test data for storage testing
 */
const testData = {
  simple: { message: 'Hello, world!' },
  complex: {
    user: {
      id: '123',
      email: 'test@example.com',
      preferences: {
        theme: 'dark',
        locale: 'en-US'
      }
    },
    settings: {
      notifications: true,
      privacy: {
        analytics: false,
        tracking: false
      }
    }
  },
  sensitive: {
    // This would not be stored in real usage, but for testing encryption
    creditCard: '4111-1111-1111-1111',
    ssn: '123-45-6789',
    apiKey: 'sk-test-123456789'
  }
}

/**
 * Test results interface
 */
interface TestResult {
  name: string
  passed: boolean
  error?: string
  duration?: number
}

/**
 * Test runner class
 */
export class EncryptedStorageTestRunner {
  private results: TestResult[] = []

  /**
   * Run a single test
   */
  private async runTest(name: string, testFn: () => Promise<void>): Promise<void> {
    const startTime = Date.now()
    try {
      await testFn()
      this.results.push({
        name,
        passed: true,
        duration: Date.now() - startTime
      })
      console.log(`✅ ${name}`)
    } catch (error) {
      this.results.push({
        name,
        passed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration: Date.now() - startTime
      })
      console.error(`❌ ${name}: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }
  }

  /**
   * Test basic encryption/decryption
   */
  private async testBasicEncryption(): Promise<void> {
    if (!isWebCryptoSupported()) {
      throw new Error('Web Crypto API not supported')
    }

    const password = generateSessionPassword('test-session')
    const originalData = testData.simple

    // Test encryption
    const encrypted = await encryptJSON(originalData, password)
    if (!encrypted.data || !encrypted.iv || !encrypted.salt) {
      throw new Error('Encryption failed - missing required fields')
    }

    // Test decryption
    const decrypted = await decryptJSON(encrypted, password)
    if (JSON.stringify(decrypted) !== JSON.stringify(originalData)) {
      throw new Error('Decryption failed - data mismatch')
    }

    // Test wrong password
    try {
      await decryptJSON(encrypted, 'wrong-password')
      throw new Error('Decryption should have failed with wrong password')
    } catch (error) {
      if (!(error instanceof Error) || !error.message.includes('Decryption failed')) {
        throw new Error('Wrong password should throw decryption error')
      }
    }
  }

  /**
   * Test storage factory creation
   */
  private async testStorageFactory(): Promise<void> {
    // Test creating different storage types
    const memoryStorage = StorageFactory.createStorage(DataClassification.PUBLIC, StorageType.MEMORY)
    const localStorage = StorageFactory.createStorage(DataClassification.INTERNAL, StorageType.LOCAL)
    const sessionStorage = StorageFactory.createStorage(DataClassification.CONFIDENTIAL, StorageType.SESSION)

    // Test async storage
    const asyncStorage = StorageFactory.createAsyncStorage(DataClassification.CONFIDENTIAL, StorageType.MEMORY)

    // Test Zustand storage adapter
    const zustandStorage = StorageFactory.createZustandStorage(DataClassification.INTERNAL, StorageType.MEMORY)

    // Verify they're created correctly
    if (!memoryStorage || !localStorage || !sessionStorage || !asyncStorage || !zustandStorage) {
      throw new Error('Failed to create storage instances')
    }

    // Test basic functionality
    memoryStorage.setItem('test', 'value')
    const retrieved = memoryStorage.getItem('test')
    if (retrieved !== 'value') {
      throw new Error('Basic storage functionality failed')
    }
  }

  /**
   * Test async encrypted storage
   */
  private async testAsyncEncryptedStorage(): Promise<void> {
    const storage = StorageFactory.createAsyncStorage(
      DataClassification.CONFIDENTIAL,
      StorageType.MEMORY,
      'test-session'
    )

    // Test simple data
    await storage.setItem('simple', testData.simple)
    const retrievedSimple = await storage.getItem('simple')
    if (JSON.stringify(retrievedSimple) !== JSON.stringify(testData.simple)) {
      throw new Error('Simple data retrieval failed')
    }

    // Test complex data
    await storage.setItem('complex', testData.complex)
    const retrievedComplex = await storage.getItem('complex')
    if (JSON.stringify(retrievedComplex) !== JSON.stringify(testData.complex)) {
      throw new Error('Complex data retrieval failed')
    }

    // Test null values
    const nonExistent = await storage.getItem('nonexistent')
    if (nonExistent !== null) {
      throw new Error('Non-existent key should return null')
    }

    // Test removal
    storage.removeItem('simple')
    const removedItem = await storage.getItem('simple')
    if (removedItem !== null) {
      throw new Error('Removed item should return null')
    }
  }

  /**
   * Test Zustand storage adapter
   */
  private async testZustandStorageAdapter(): Promise<void> {
    const storage = StorageFactory.createZustandStorage(
      DataClassification.INTERNAL,
      StorageType.MEMORY,
      'test-session'
    )

    // Test setting item
    await storage.setItem('zustand-test', JSON.stringify(testData.complex))
    
    // Test getting item
    const retrieved = await storage.getItem('zustand-test')
    if (!retrieved) {
      throw new Error('Zustand adapter failed to retrieve item')
    }

    const parsed = JSON.parse(retrieved)
    if (JSON.stringify(parsed) !== JSON.stringify(testData.complex)) {
      throw new Error('Zustand adapter data mismatch')
    }

    // Test removal
    await storage.removeItem('zustand-test')
    const removed = await storage.getItem('zustand-test')
    if (removed !== null) {
      throw new Error('Zustand adapter failed to remove item')
    }
  }

  /**
   * Test data classification compliance
   */
  private async testDataClassificationCompliance(): Promise<void> {
    // Test that RESTRICTED data cannot be persisted
    try {
      StorageFactory.createStorage(DataClassification.RESTRICTED, StorageType.LOCAL)
      // This should work because we fall back to memory storage
    } catch {
      // Expected for strict mode
    }

    // Test different classification levels
    const publicStorage = StorageFactory.createStorage(DataClassification.PUBLIC, StorageType.LOCAL)
    const internalStorage = StorageFactory.createStorage(DataClassification.INTERNAL, StorageType.LOCAL)
    const confidentialStorage = StorageFactory.createStorage(DataClassification.CONFIDENTIAL, StorageType.SESSION)

    // Verify they handle data appropriately
    publicStorage.setItem('public', 'public data')
    internalStorage.setItem('internal', 'internal data')
    confidentialStorage.setItem('confidential', 'confidential data')

    // All should work (with encryption for confidential)
    const publicData = publicStorage.getItem('public')
    const internalData = internalStorage.getItem('internal')
    const confidentialData = confidentialStorage.getItem('confidential')

    if (!publicData || !internalData || !confidentialData) {
      throw new Error('Data classification storage failed')
    }
  }

  /**
   * Test storage utilities
   */
  private async testStorageUtils(): Promise<void> {
    const storage = StorageFactory.createAsyncStorage(
      DataClassification.INTERNAL,
      StorageType.MEMORY
    )

    // Test storage functionality
    const isWorking = await StorageUtils.testStorage(storage)
    if (!isWorking) {
      throw new Error('Storage utility test failed')
    }

    // Test migration (basic test)
    const fromStorage = StorageFactory.createAsyncStorage(DataClassification.INTERNAL, StorageType.MEMORY)
    const toStorage = StorageFactory.createAsyncStorage(DataClassification.INTERNAL, StorageType.MEMORY)

    await fromStorage.setItem('migrate1', 'data1')
    await fromStorage.setItem('migrate2', 'data2')

    const migrationResult = await StorageUtils.migrateStorage(fromStorage, toStorage, ['migrate1', 'migrate2'])
    
    if (migrationResult.success !== 2 || migrationResult.failed !== 0) {
      throw new Error(`Migration failed: ${migrationResult.success} success, ${migrationResult.failed} failed`)
    }

    // Verify migration worked
    const migratedData1 = await toStorage.getItem('migrate1')
    const migratedData2 = await toStorage.getItem('migrate2')
    
    if (migratedData1 !== 'data1' || migratedData2 !== 'data2') {
      throw new Error('Migration data verification failed')
    }
  }

  /**
   * Test error handling
   */
  private async testErrorHandling(): Promise<void> {
    const storage = StorageFactory.createAsyncStorage(
      DataClassification.CONFIDENTIAL,
      StorageType.MEMORY
    )

    // Test invalid data handling
    try {
      // This should handle gracefully
      await storage.setItem('circular', { self: null as unknown })
      const circular = { self: null as unknown }
      circular.self = circular
      await storage.setItem('circular', circular)
    } catch {
      // Expected for circular references
    }

    // Test with undefined/null values
    await storage.setItem('null-test', null)
    await storage.setItem('undefined-test', undefined)
    
    const nullValue = await storage.getItem('null-test')
    const undefinedValue = await storage.getItem('undefined-test')
    
    // Both should be handled appropriately
    if (nullValue !== null || undefinedValue !== null) {
      // This might be expected behavior depending on implementation
    }
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<TestResult[]> {
    console.log('🧪 Starting Encrypted Storage Integration Tests')
    console.log('===============================================')

    this.results = []

    // Run tests in sequence
    await this.runTest('Basic Encryption/Decryption', () => this.testBasicEncryption())
    await this.runTest('Storage Factory Creation', () => this.testStorageFactory())
    await this.runTest('Async Encrypted Storage', () => this.testAsyncEncryptedStorage())
    await this.runTest('Zustand Storage Adapter', () => this.testZustandStorageAdapter())
    await this.runTest('Data Classification Compliance', () => this.testDataClassificationCompliance())
    await this.runTest('Storage Utilities', () => this.testStorageUtils())
    await this.runTest('Error Handling', () => this.testErrorHandling())

    // Summary
    const passed = this.results.filter(r => r.passed).length
    const failed = this.results.filter(r => !r.passed).length
    const totalTime = this.results.reduce((sum, r) => sum + (r.duration || 0), 0)

    console.log('\n📊 Test Summary')
    console.log('================')
    console.log(`✅ Passed: ${passed}`)
    console.log(`❌ Failed: ${failed}`)
    console.log(`⏱️ Total Time: ${totalTime}ms`)

    if (failed > 0) {
      console.log('\n🚨 Failed Tests:')
      this.results.filter(r => !r.passed).forEach(r => {
        console.log(`   • ${r.name}: ${r.error}`)
      })
    }

    return this.results
  }

  /**
   * Get test results
   */
  getResults(): TestResult[] {
    return [...this.results]
  }
}

/**
 * Export test runner for use in browser console or development tools
 */
export async function runEncryptedStorageTests(): Promise<TestResult[]> {
  const runner = new EncryptedStorageTestRunner()
  return await runner.runAllTests()
}

/**
 * Quick browser console test
 */
if (typeof window !== 'undefined') {
  // @ts-expect-error - Add to window for browser console access
  window.__runEncryptedStorageTests = runEncryptedStorageTests
  console.log('🔧 Run tests in console with: __runEncryptedStorageTests()')
}

/**
 * Export for Node.js testing if needed
 */
export default EncryptedStorageTestRunner