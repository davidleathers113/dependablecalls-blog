/**
 * Migration System Test Suite - Phase 3.1b
 * Comprehensive testing of the schema versioning and migration system
 */

import { 
  globalMigrationRegistry,
  migrate,
  getMigrations,
  getLatestMigrationVersion,
  canMigrate,
} from './migrations/index'

import {
  getLatestSchema,
  getLatestSchemaVersion,
  validateWithSchema,
  getRegisteredStores,
} from './schemas/index'

// Import all migration files to register them
import './migrations/authStore.migrations'
import './migrations/buyerStore.migrations'
import './migrations/supplierStore.migrations'
import './migrations/settingsStore.migrations'
import './migrations/networkStore.migrations'
import './migrations/blogStore.migrations'

interface TestResult {
  testName: string
  success: boolean
  details: string
  duration: number
  data?: unknown
}

interface TestSuite {
  suiteName: string
  results: TestResult[]
  totalDuration: number
  passed: number
  failed: number
}

class MigrationSystemTester {
  private results: TestSuite[] = []
  
  /**
   * Run all tests and return comprehensive results
   */
  async runAllTests(): Promise<{
    suites: TestSuite[]
    summary: {
      totalTests: number
      totalPassed: number
      totalFailed: number
      totalDuration: number
      coverage: {
        storesWithMigrations: number
        totalStores: number
        percentage: number
      }
    }
  }> {
    console.log('🧪 Starting Migration System Test Suite...')
    
    const startTime = performance.now()
    
    // Run test suites
    await this.testMigrationRegistry()
    await this.testSchemaRegistry()
    await this.testMigrationPaths()
    await this.testActualMigrations()
    await this.testErrorHandling()
    await this.testPerformance()
    
    const totalDuration = performance.now() - startTime
    
    // Calculate summary
    const totalTests = this.results.reduce((sum, suite) => sum + suite.results.length, 0)
    const totalPassed = this.results.reduce((sum, suite) => sum + suite.passed, 0)
    const totalFailed = this.results.reduce((sum, suite) => sum + suite.failed, 0)
    
    const registeredStores = getRegisteredStores()
    const storesWithMigrations = globalMigrationRegistry.getRegisteredStores()
    
    const summary = {
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      coverage: {
        storesWithMigrations: storesWithMigrations.length,
        totalStores: registeredStores.length,
        percentage: Math.round((storesWithMigrations.length / registeredStores.length) * 100),
      },
    }
    
    this.printResults(summary)
    
    return {
      suites: this.results,
      summary,
    }
  }
  
  /**
   * Test migration registry functionality
   */
  private async testMigrationRegistry(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Migration Registry',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test registry inspection
    suite.results.push(await this.runTest(
      'Registry Inspection',
      () => {
        const registry = globalMigrationRegistry.inspect()
        const storeCount = Object.keys(registry).length
        
        if (storeCount < 6) {
          throw new Error(`Expected at least 6 stores, found ${storeCount}`)
        }
        
        // Verify specific stores are registered
        const expectedStores = [
          'auth-store',
          'buyer-store', 
          'supplier-store',
          'settings-store',
          'network-store',
          'blog-editor-store',
        ]
        
        for (const storeName of expectedStores) {
          if (!registry[storeName]) {
            throw new Error(`Store ${storeName} not found in registry`)
          }
        }
        
        return `✅ Found ${storeCount} stores with migrations`
      }
    ))
    
    // Test version retrieval
    suite.results.push(await this.runTest(
      'Version Retrieval',
      () => {
        const authVersion = getLatestMigrationVersion('auth-store')
        const buyerVersion = getLatestMigrationVersion('buyer-store')
        
        if (authVersion < 2) {
          throw new Error(`Auth store should have version >= 2, found ${authVersion}`)
        }
        
        if (buyerVersion < 2) {
          throw new Error(`Buyer store should have version >= 2, found ${buyerVersion}`)
        }
        
        return `✅ Version retrieval working (auth: v${authVersion}, buyer: v${buyerVersion})`
      }
    ))
    
    // Test migration path calculation
    suite.results.push(await this.runTest(
      'Migration Path Calculation',
      () => {
        const authMigrations = getMigrations('auth-store')
        const buyerMigrations = getMigrations('buyer-store')
        
        if (authMigrations.length === 0) {
          throw new Error('Auth store should have migrations')
        }
        
        if (buyerMigrations.length === 0) {
          throw new Error('Buyer store should have migrations')
        }
        
        // Test path calculation is working
        canMigrate('auth-store', 1, 3)
        canMigrate('buyer-store', 1, 2)
        
        return `✅ Path calculation working (auth: ${authMigrations.length} migrations, buyer: ${buyerMigrations.length} migrations)`
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Test schema registry functionality
   */
  private async testSchemaRegistry(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Schema Registry',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test schema retrieval
    suite.results.push(await this.runTest(
      'Schema Retrieval',
      () => {
        const authSchema = getLatestSchema('auth-store')
        const buyerSchema = getLatestSchema('buyer-store')
        
        if (!authSchema) {
          throw new Error('Auth store schema not found')
        }
        
        if (!buyerSchema) {
          throw new Error('Buyer store schema not found')
        }
        
        const authVersion = getLatestSchemaVersion('auth-store')
        const buyerVersion = getLatestSchemaVersion('buyer-store')
        
        return `✅ Schema retrieval working (auth: v${authVersion}, buyer: v${buyerVersion})`
      }
    ))
    
    // Test validation
    suite.results.push(await this.runTest(
      'Schema Validation',
      () => {
        // Test valid auth data
        const validAuthData = {
          preferences: {
            theme: 'dark' as const,
            locale: 'en',
            emailNotifications: true,
          },
        }
        
        const authValidation = validateWithSchema('auth-store', 1, validAuthData)
        if (!authValidation.success) {
          const errorMessage = 'error' in authValidation && authValidation.error?.message ? authValidation.error.message : 'Unknown validation error'
          throw new Error(`Auth validation failed: ${errorMessage}`)
        }
        
        // Test invalid auth data
        const invalidAuthData = {
          preferences: {
            theme: 'invalid-theme', // Invalid enum value
          },
        }
        
        const invalidValidation = validateWithSchema('auth-store', 1, invalidAuthData)
        if (invalidValidation.success) {
          throw new Error('Invalid data should not pass validation')
        }
        
        return '✅ Schema validation working correctly'
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Test migration path execution
   */
  private async testMigrationPaths(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Migration Paths',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test auth store migration
    suite.results.push(await this.runTest(
      'Auth Store Migration V1->V2',
      async () => {
        const v1Data = {
          preferences: {
            theme: 'dark' as const,
            locale: 'en',
            timezone: 'UTC',
            emailNotifications: true,
          },
        }
        
        const result = await migrate('auth-store', v1Data, 1, 2)
        
        if (!result.success) {
          throw new Error(`Migration failed: ${result.error}`)
        }
        
        if (!result.data) {
          throw new Error('Migration result missing data')
        }
        
        // Check that sessionRememberMe was added
        const migratedData = result.data as Record<string, unknown>
        const preferences = migratedData.preferences as Record<string, unknown>
        if (preferences.sessionRememberMe === undefined) {
          throw new Error('sessionRememberMe field not added in migration')
        }
        
        return `✅ Auth V1->V2 migration successful, applied migrations: ${result.migrationsApplied.join(', ')}`
      }
    ))
    
    // Test buyer store security migration
    suite.results.push(await this.runTest(
      'Buyer Store Security Migration V1->V2',
      async () => {
        const v1Data = {
          currentBalance: 1000,      // This should be removed
          creditLimit: 5000,        // This should be removed
          campaigns: [],
          savedSearches: [],
        }
        
        const result = await migrate('buyer-store', v1Data, 1, 2)
        
        if (!result.success) {
          throw new Error(`Security migration failed: ${result.error}`)
        }
        
        const migratedData = result.data as Record<string, unknown>
        
        // Verify financial data was removed
        if ('currentBalance' in migratedData || 'creditLimit' in migratedData) {
          throw new Error('Financial data should have been removed for security')
        }
        
        // Verify encryption metadata was added
        if (!migratedData._encryptionMetadata) {
          throw new Error('Encryption metadata should have been added')
        }
        
        return '✅ Buyer security migration successful - financial data removed'
      }
    ))
    
    // Test multi-step migration
    suite.results.push(await this.runTest(
      'Multi-Step Migration (V1->V3)',
      async () => {
        const v1Data = {
          preferences: {
            theme: 'light' as const,
          },
        }
        
        const result = await migrate('auth-store', v1Data, 1, 3)
        
        if (!result.success) {
          throw new Error(`Multi-step migration failed: ${result.error}`)
        }
        
        if (result.migrationsApplied.length < 2) {
          throw new Error(`Expected multiple migrations, got ${result.migrationsApplied.length}`)
        }
        
        const migratedData = result.data as Record<string, unknown>
        const preferences = migratedData.preferences as Record<string, unknown>
        
        // Should have V2 and V3 features
        if (preferences.sessionRememberMe === undefined) {
          throw new Error('V2 features missing')
        }
        
        if (preferences.twoFactorEnabled === undefined) {
          throw new Error('V3 features missing')
        }
        
        return `✅ Multi-step migration successful: ${result.migrationsApplied.join(' -> ')}`
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Test actual data migrations with realistic scenarios
   */
  private async testActualMigrations(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Realistic Migration Scenarios',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test settings store comprehensive migration
    suite.results.push(await this.runTest(
      'Settings Store V1->V4 Complete Migration',
      async () => {
        const v1Data = {
          userSettings: {
            version: 1,
            updatedAt: new Date().toISOString(),
            profile: {
              displayName: 'Test User',
              timezone: 'America/New_York',
              language: 'en',
            },
            notifications: {
              email: {
                enabled: true,
                frequency: 'daily' as const,
              },
            },
          },
          lastSaved: new Date().toISOString(),
        }
        
        const result = await migrate('settings-store', v1Data, 1, 4)
        
        if (!result.success) {
          throw new Error(`Settings migration failed: ${result.error}`)
        }
        
        const migratedData = result.data as Record<string, unknown>
        const userSettings = migratedData.userSettings as Record<string, unknown>
        
        // Verify all migration features are present
        if (!userSettings.theme) {
          throw new Error('V2 theme settings missing')
        }
        
        if (!userSettings.performance) {
          throw new Error('V3 performance settings missing')
        }
        
        if (!userSettings.workspace) {
          throw new Error('V4 workspace settings missing')
        }
        
        return `✅ Complete settings migration successful through ${result.migrationsApplied.length} versions`
      }
    ))
    
    // Test rollback functionality
    suite.results.push(await this.runTest(
      'Migration Rollback',
      async () => {
        const v3Data = {
          preferences: {
            theme: 'dark' as const,
            sessionRememberMe: true,
            twoFactorEnabled: true,
          },
        }
        
        const result = await migrate('auth-store', v3Data, 3, 1)
        
        if (!result.success) {
          throw new Error(`Rollback migration failed: ${result.error}`)
        }
        
        const rolledBackData = result.data as Record<string, unknown>
        const preferences = rolledBackData.preferences as Record<string, unknown>
        
        // V3 features should be removed
        if ('sessionRememberMe' in preferences) {
          throw new Error('V2 features should be removed in rollback')
        }
        
        if ('twoFactorEnabled' in preferences) {
          throw new Error('V3 features should be removed in rollback')
        }
        
        return '✅ Migration rollback successful'
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Test error handling and edge cases
   */
  private async testErrorHandling(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Error Handling',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test migration with invalid data
    suite.results.push(await this.runTest(
      'Invalid Data Handling',
      async () => {
        const invalidData = {
          completely: 'wrong',
          data: 'structure',
        }
        
        const result = await migrate('auth-store', invalidData, 1, 2)
        
        // Should fail gracefully
        if (result.success) {
          throw new Error('Invalid data should cause migration to fail')
        }
        
        if (!result.error) {
          throw new Error('Error message should be provided')
        }
        
        return '✅ Invalid data handled gracefully'
      }
    ))
    
    // Test non-existent store
    suite.results.push(await this.runTest(
      'Non-existent Store',
      async () => {
        const result = await migrate('non-existent-store', {}, 1, 2)
        
        if (result.success) {
          throw new Error('Non-existent store should cause migration to fail')
        }
        
        return '✅ Non-existent store handled gracefully'
      }
    ))
    
    // Test impossible migration path
    suite.results.push(await this.runTest(
      'Impossible Migration Path',
      async () => {
        const canMigrateResult = canMigrate('auth-store', 1, 999)
        
        if (canMigrateResult) {
          throw new Error('Impossible migration path should return false')
        }
        
        return '✅ Impossible migration paths detected correctly'
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Test performance characteristics
   */
  private async testPerformance(): Promise<void> {
    const suite: TestSuite = {
      suiteName: 'Performance',
      results: [],
      totalDuration: 0,
      passed: 0,
      failed: 0,
    }
    
    const startTime = performance.now()
    
    // Test migration performance
    suite.results.push(await this.runTest(
      'Migration Performance',
      async () => {
        const testData = {
          preferences: {
            theme: 'light' as const,
          },
        }
        
        const iterations = 100
        const start = performance.now()
        
        for (let i = 0; i < iterations; i++) {
          await migrate('auth-store', testData, 1, 2)
        }
        
        const duration = performance.now() - start
        const avgDuration = duration / iterations
        
        if (avgDuration > 10) { // 10ms per migration seems reasonable
          throw new Error(`Migration too slow: ${avgDuration.toFixed(2)}ms average`)
        }
        
        return `✅ Migration performance acceptable: ${avgDuration.toFixed(2)}ms average over ${iterations} iterations`
      }
    ))
    
    // Test schema validation performance
    suite.results.push(await this.runTest(
      'Validation Performance',
      async () => {
        const testData = {
          preferences: {
            theme: 'dark' as const,
            locale: 'en',
            timezone: 'UTC',
          },
        }
        
        const iterations = 1000
        const start = performance.now()
        
        for (let i = 0; i < iterations; i++) {
          validateWithSchema('auth-store', 1, testData)
        }
        
        const duration = performance.now() - start
        const avgDuration = duration / iterations
        
        if (avgDuration > 1) { // 1ms per validation
          throw new Error(`Validation too slow: ${avgDuration.toFixed(3)}ms average`)
        }
        
        return `✅ Validation performance acceptable: ${avgDuration.toFixed(3)}ms average over ${iterations} iterations`
      }
    ))
    
    suite.totalDuration = performance.now() - startTime
    suite.passed = suite.results.filter(r => r.success).length
    suite.failed = suite.results.filter(r => !r.success).length
    
    this.results.push(suite)
  }
  
  /**
   * Helper method to run individual tests
   */
  private async runTest(
    testName: string,
    testFn: () => string | Promise<string>
  ): Promise<TestResult> {
    const start = performance.now()
    
    try {
      const details = await testFn()
      const duration = performance.now() - start
      
      return {
        testName,
        success: true,
        details,
        duration,
      }
    } catch (error) {
      const duration = performance.now() - start
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      
      return {
        testName,
        success: false,
        details: `❌ ${errorMessage}`,
        duration,
      }
    }
  }
  
  /**
   * Print comprehensive test results
   */
  private printResults(summary: {
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalDuration: number
    coverage: {
      storesWithMigrations: number
      totalStores: number
      percentage: number
    }
  }): void {
    console.log('\n' + '='.repeat(60))
    console.log('🧪 MIGRATION SYSTEM TEST RESULTS')
    console.log('='.repeat(60))
    
    // Print summary
    console.log(`\n📊 SUMMARY:`)
    console.log(`  Total Tests: ${summary.totalTests}`)
    console.log(`  Passed: ${summary.totalPassed} ✅`)
    console.log(`  Failed: ${summary.totalFailed} ${summary.totalFailed > 0 ? '❌' : ''}`)
    console.log(`  Duration: ${summary.totalDuration.toFixed(2)}ms`)
    console.log(`  Success Rate: ${Math.round((summary.totalPassed / summary.totalTests) * 100)}%`)
    
    // Print coverage
    console.log(`\n📈 COVERAGE:`)
    console.log(`  Stores with Migrations: ${summary.coverage.storesWithMigrations}/${summary.coverage.totalStores}`)
    console.log(`  Coverage Percentage: ${summary.coverage.percentage}%`)
    
    // Print detailed results
    for (const suite of this.results) {
      console.log(`\n🔍 ${suite.suiteName.toUpperCase()}:`)
      console.log(`  Duration: ${suite.totalDuration.toFixed(2)}ms`)
      console.log(`  Results: ${suite.passed} passed, ${suite.failed} failed`)
      
      for (const result of suite.results) {
        const icon = result.success ? '✅' : '❌'
        console.log(`    ${icon} ${result.testName} (${result.duration.toFixed(2)}ms)`)
        if (result.details) {
          console.log(`       ${result.details}`)
        }
      }
    }
    
    console.log('\n' + '='.repeat(60))
    
    if (summary.totalFailed === 0) {
      console.log('🎉 ALL TESTS PASSED! Migration system ready for production.')
    } else {
      console.log(`⚠️  ${summary.totalFailed} test(s) failed. Review issues before deployment.`)
    }
    
    console.log('='.repeat(60))
  }
}

/**
 * Run the complete migration system test suite
 */
export async function testMigrationSystem(): Promise<{
  suites: TestSuite[]
  summary: {
    totalTests: number
    totalPassed: number
    totalFailed: number
    totalDuration: number
    coverage: {
      storesWithMigrations: number
      totalStores: number
      percentage: number
    }
  }
}> {
  const tester = new MigrationSystemTester()
  return await tester.runAllTests()
}

/**
 * Quick test for development console
 */
export async function quickMigrationTest(): Promise<void> {
  console.log('🚀 Running quick migration test...')
  
  try {
    // Test a simple auth migration
    const testData = {
      preferences: {
        theme: 'dark' as const,
        locale: 'en',
      },
    }
    
    const result = await migrate('auth-store', testData, 1, 2)
    
    if (result.success) {
      console.log('✅ Quick test passed!')
      console.log('Migration result:', result.data)
    } else {
      console.log('❌ Quick test failed:', result.error)
    }
  } catch (error) {
    console.log('❌ Quick test error:', error)
  }
}

// Make available in development console
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as { __testMigrationSystem?: typeof testMigrationSystem; __quickMigrationTest?: typeof quickMigrationTest }).__testMigrationSystem = testMigrationSystem;
  (window as { __testMigrationSystem?: typeof testMigrationSystem; __quickMigrationTest?: typeof quickMigrationTest }).__quickMigrationTest = quickMigrationTest
  
  console.log(`
🧪 Migration System Testing Available:
- Full test suite: __testMigrationSystem()
- Quick test: __quickMigrationTest()
`)
}