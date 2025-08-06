/**
 * Phase 3.1d - Storage Architecture Integration Test
 * 
 * Tests and validates the unified storage architecture
 * This file can be run in development to test the system
 */

import {
  initializeStorageArchitecture,
  createModernPersistConfig,
  getStorageStatus,
  auditStorage,
  devUtils,
  storageManager,
  keyMigrationManager,
  namespaceIsolation,
  storageCleanup
} from './index'

// Test data interfaces
interface TestStoreState {
  counter: number
  message: string
  preferences: {
    theme: 'light' | 'dark'
    language: string
  }
  _timestamp?: number
}

interface TestResult {
  test: string
  passed: boolean
  message: string
  duration: number
}

/**
 * Comprehensive test suite for storage architecture
 */
export async function runStorageArchitectureTests(): Promise<{
  results: TestResult[]
  summary: {
    total: number
    passed: number
    failed: number
    duration: number
  }
}> {
  console.log('🧪 Running Storage Architecture Tests...')
  
  const results: TestResult[] = []
  const startTime = Date.now()

  // Test 1: Storage Manager Key Generation
  results.push(await runTest('Storage Manager Key Generation', async () => {
    const key1 = storageManager.generateKey({ storeName: 'test' })
    const key2 = storageManager.generateKey({ storeName: 'test', version: 2 })
    const key3 = storageManager.generateKey({ storeName: 'test', namespace: 'dev' })

    if (!key1.fullKey.match(/^dce-test-v\d+$/)) {
      throw new Error(`Invalid key format: ${key1.fullKey}`)
    }
    
    if (!key2.fullKey.includes('v2')) {
      throw new Error(`Version not included: ${key2.fullKey}`)
    }

    if (!key3.fullKey.includes('dev')) {
      throw new Error(`Namespace not included: ${key3.fullKey}`)
    }

    return 'Key generation works correctly'
  }))

  // Test 2: Data Storage and Retrieval
  results.push(await runTest('Data Storage and Retrieval', async () => {
    const testData: TestStoreState = {
      counter: 42,
      message: 'Hello, Storage!',
      preferences: {
        theme: 'dark',
        language: 'en'
      },
      _timestamp: Date.now()
    }

    const config = { storeName: 'test-store' }
    
    const stored = await storageManager.setData(config, testData)
    if (!stored) throw new Error('Failed to store data')

    const retrieved = await storageManager.getData<TestStoreState>(config)
    if (!retrieved) throw new Error('Failed to retrieve data')

    if (retrieved.counter !== testData.counter) {
      throw new Error('Data integrity check failed')
    }

    // Cleanup
    await storageManager.removeData(config)

    return 'Data storage and retrieval works correctly'
  }))

  // Test 3: Legacy Key Migration
  results.push(await runTest('Legacy Key Migration', async () => {
    // Create fake legacy data
    const legacyData = { preferences: { theme: 'light' } }
    localStorage.setItem('dce-user-preferences', JSON.stringify(legacyData))

    const hasLegacy = keyMigrationManager.hasLegacyKeys()
    if (!hasLegacy) throw new Error('Legacy key detection failed')

    const preview = await keyMigrationManager.previewMigration()
    if (preview.length === 0) throw new Error('Migration preview failed')

    // Cleanup
    localStorage.removeItem('dce-user-preferences')

    return 'Legacy key migration works correctly'
  }))

  // Test 4: Namespace Isolation
  results.push(await runTest('Namespace Isolation', async () => {
    const testData1 = { value: 'namespace1' }
    const testData2 = { value: 'namespace2' }

    // Store data in different namespaces
    await namespaceIsolation.setData('test', testData1, 'ns1')
    await namespaceIsolation.setData('test', testData2, 'ns2')

    // Retrieve from specific namespaces
    const retrieved1 = await namespaceIsolation.getData<{ value: string }>('test', 'ns1')
    const retrieved2 = await namespaceIsolation.getData<{ value: string }>('test', 'ns2')

    if (retrieved1?.value !== 'namespace1') {
      throw new Error('Namespace 1 data incorrect')
    }

    if (retrieved2?.value !== 'namespace2') {
      throw new Error('Namespace 2 data incorrect')
    }

    // Cleanup
    await namespaceIsolation.removeData('test', 'ns1')
    await namespaceIsolation.removeData('test', 'ns2')

    return 'Namespace isolation works correctly'
  }))

  // Test 5: Storage Health Metrics
  results.push(await runTest('Storage Health Metrics', async () => {
    const health = await storageCleanup.getHealthMetrics()
    
    if (typeof health.totalKeys !== 'number') {
      throw new Error('Health metrics malformed')
    }

    if (typeof health.healthScore !== 'number' || health.healthScore < 0 || health.healthScore > 100) {
      throw new Error('Invalid health score')
    }

    return 'Storage health metrics work correctly'
  }))

  // Test 6: Modern Persist Config
  results.push(await runTest('Modern Persist Config', async () => {
    const config = createModernPersistConfig<TestStoreState>('test-persist', {
      version: 1,
      namespace: 'test',
      partialize: (state) => ({ counter: state.counter })
    })

    if (!config.name.startsWith('dce-')) {
      throw new Error('Persist config name format incorrect')
    }

    if (config.version !== 1) {
      throw new Error('Persist config version incorrect')
    }

    return 'Modern persist config works correctly'
  }))

  // Test 7: Storage Status
  results.push(await runTest('Storage Status', async () => {
    const status = await getStorageStatus()
    
    if (!Array.isArray(status.activeKeys)) {
      throw new Error('Status activeKeys malformed')
    }

    if (!Array.isArray(status.namespaces)) {
      throw new Error('Status namespaces malformed')
    }

    if (typeof status.health.healthScore !== 'number') {
      throw new Error('Status health malformed')
    }

    return 'Storage status works correctly'
  }))

  // Test 8: Storage Audit
  results.push(await runTest('Storage Audit', async () => {
    const audit = await auditStorage()
    
    if (!Array.isArray(audit.issues)) {
      throw new Error('Audit issues malformed')
    }

    if (typeof audit.summary.totalIssues !== 'number') {
      throw new Error('Audit summary malformed')
    }

    return 'Storage audit works correctly'
  }))

  const endTime = Date.now()
  const totalDuration = endTime - startTime

  const summary = {
    total: results.length,
    passed: results.filter(r => r.passed).length,
    failed: results.filter(r => !r.passed).length,
    duration: totalDuration
  }

  console.log(`
📊 Storage Architecture Test Results:
   ✅ Passed: ${summary.passed}
   ❌ Failed: ${summary.failed}
   ⏱️  Total Duration: ${totalDuration}ms
   
   ${results.map(r => 
     `${r.passed ? '✅' : '❌'} ${r.test} (${r.duration}ms)${!r.passed ? `\n      Error: ${r.message}` : ''}`
   ).join('\n   ')}
  `)

  return { results, summary }
}

/**
 * Run individual test with timing and error handling
 */
async function runTest(name: string, testFn: () => Promise<string>): Promise<TestResult> {
  const startTime = Date.now()
  
  try {
    const message = await testFn()
    const duration = Date.now() - startTime
    
    return {
      test: name,
      passed: true,
      message,
      duration
    }
  } catch (error) {
    const duration = Date.now() - startTime
    
    return {
      test: name,
      passed: false,
      message: error instanceof Error ? error.message : 'Unknown error',
      duration
    }
  }
}

/**
 * Demo the storage architecture with real examples
 */
export async function demonstrateStorageArchitecture(): Promise<void> {
  console.log('🎯 Demonstrating Storage Architecture...')

  // 1. Initialize the system
  console.log('\n1. Initializing Storage Architecture...')
  await initializeStorageArchitecture({
    autoMigrate: true,
    autoCleanup: false,
    verbose: true
  })

  // 2. Show current status
  console.log('\n2. Current Storage Status:')
  const status = await getStorageStatus()
  console.log(`   Health Score: ${status.health.healthScore}/100`)
  console.log(`   Total Keys: ${status.health.totalKeys}`)
  console.log(`   Active Keys: ${status.activeKeys.length}`)
  console.log(`   Legacy Keys: ${status.legacyKeys.length}`)

  // 3. Demonstrate namespace isolation
  console.log('\n3. Demonstrating Namespace Isolation...')
  await namespaceIsolation.setData('demo', { feature: 'A', enabled: true }, 'features')
  await namespaceIsolation.setData('demo', { userId: '123', preferences: {} }, 'user')
  
  const featureData = await namespaceIsolation.getData('demo', 'features')
  const userData = await namespaceIsolation.getData('demo', 'user')
  
  console.log('   Feature namespace:', featureData)
  console.log('   User namespace:', userData)

  // 4. Show storage audit
  console.log('\n4. Storage Audit Results:')
  const audit = await auditStorage()
  console.log(`   Total Issues: ${audit.summary.totalIssues}`)
  console.log(`   High Severity: ${audit.summary.highSeverity}`)
  console.log(`   Medium Severity: ${audit.summary.mediumSeverity}`)
  console.log(`   Low Severity: ${audit.summary.lowSeverity}`)

  // 5. Show modern persist config example
  console.log('\n5. Modern Persist Configuration Example:')
  const persistConfig = createModernPersistConfig<TestStoreState>('example-store', {
    version: 1,
    namespace: 'user',
    partialize: (state) => ({
      preferences: state.preferences,
      // Don't persist counter or message
    })
  })
  console.log('   Generated config:', {
    name: persistConfig.name,
    version: persistConfig.version
  })

  // Cleanup demo data
  await namespaceIsolation.removeData('demo', 'features')
  await namespaceIsolation.removeData('demo', 'user')

  console.log('\n✅ Storage Architecture demonstration complete!')
}

/**
 * Quick health check for storage system
 */
export async function quickHealthCheck(): Promise<{
  healthy: boolean
  score: number
  issues: string[]
  recommendations: string[]
}> {
  const health = await storageCleanup.getHealthMetrics()
  const audit = await auditStorage()
  
  const issues: string[] = []
  const recommendations: string[] = []
  
  if (health.healthScore < 80) {
    issues.push(`Low health score: ${health.healthScore}/100`)
    recommendations.push('Run storage cleanup to improve health score')
  }
  
  if (health.legacyKeys > 0) {
    issues.push(`${health.legacyKeys} legacy keys found`)
    recommendations.push('Run key migration to update to new format')
  }
  
  if (health.orphanedKeys > 0) {
    issues.push(`${health.orphanedKeys} orphaned keys found`)
    recommendations.push('Remove orphaned keys or register missing stores')
  }
  
  if (audit.summary.highSeverity > 0) {
    issues.push(`${audit.summary.highSeverity} high severity issues`)
    recommendations.push('Address high severity issues immediately')
  }

  const healthy = health.healthScore >= 80 && audit.summary.highSeverity === 0

  return {
    healthy,
    score: health.healthScore,
    issues,
    recommendations
  }
}

// Export for development console usage
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as unknown as Record<string, unknown>).storageArchitectureTests = {
    runTests: runStorageArchitectureTests,
    demonstrate: demonstrateStorageArchitecture,
    healthCheck: quickHealthCheck,
    devUtils
  }
}