/**
 * Security Audit Runner
 * Phase 3.1a - Runs comprehensive PII and data classification audit on all stores
 * 
 * This script audits all Zustand stores for PII exposure and data classification violations
 */

import { scanStoreForPII, generatePIIReport, reportPIIToConsole, type PIIAuditReport } from './piiScanner'
import { classificationValidator, StorageType } from './dataClassification'

// Import stores
import { useAuthStore } from '../authStore'
import { useBuyerStore } from '../buyerStore'
import { useSupplierStore } from '../supplierStore'
import { useNetworkStore } from '../networkStore'
import { useSettingsStore } from '../settingsStore'
import { useBlogEditorStore, useBlogUIStore, useBlogFilterStore } from '../blogStore'

interface StoreConfig {
  name: string
  getState: () => unknown
  persistConfig?: {
    name?: string
    partialize?: (state: unknown) => unknown
  }
}

/**
 * Get all stores to audit
 */
function getAllStores(): StoreConfig[] {
  return [
    {
      name: 'auth-store',
      getState: () => useAuthStore.getState(),
      persistConfig: {
        name: 'dce-user-preferences',
        partialize: (state: Record<string, unknown>) => ({
          preferences: state.preferences,
        }),
      },
    },
    {
      name: 'buyer-store',
      getState: () => useBuyerStore.getState(),
      persistConfig: {
        name: 'buyer-store',
        partialize: (state: Record<string, unknown>) => ({
          currentBalance: state.currentBalance,
          creditLimit: state.creditLimit,
          // Note: Full state might be persisted - this is a security issue!
        }),
      },
    },
    {
      name: 'supplier-store',
      getState: () => useSupplierStore.getState(),
      persistConfig: {
        name: 'supplier-store',
        partialize: (state: Record<string, unknown>) => ({
          listings: state.listings,
          leadSources: state.leadSources,
          // Note: Might contain sensitive data
        }),
      },
    },
    {
      name: 'network-store',
      getState: () => useNetworkStore.getState(),
      // No persistence config found
    },
    {
      name: 'settings-store',
      getState: () => useSettingsStore.getState(),
      persistConfig: {
        name: 'settings-storage',
        partialize: (state: Record<string, unknown>) => ({
          userSettings: state.userSettings,
          lastSaved: state.lastSaved,
        }),
      },
    },
    {
      name: 'blog-editor-store',
      getState: () => useBlogEditorStore.getState(),
      persistConfig: {
        name: 'blog-editor-storage',
        partialize: (state: Record<string, unknown>) => ({
          draft: state.draft,
          editorMode: state.editorMode,
          previewMode: state.previewMode,
          wordWrapEnabled: state.wordWrapEnabled,
          autosaveEnabled: state.autosaveEnabled,
          autosaveInterval: state.autosaveInterval,
        }),
      },
    },
    {
      name: 'blog-ui-store',
      getState: () => useBlogUIStore.getState(),
      persistConfig: {
        name: 'blog-ui-storage',
        partialize: (state: Record<string, unknown>) => ({
          viewMode: state.viewMode,
          showFilters: state.showFilters,
          showMetrics: state.showMetrics,
          enableComments: state.enableComments,
          enableRealtime: state.enableRealtime,
          showDrafts: state.showDrafts,
        }),
      },
    },
    {
      name: 'blog-filter-store',
      getState: () => useBlogFilterStore.getState(),
      // No persistence - session only
    },
  ]
}

/**
 * Check for duplicate persistence keys
 */
function checkDuplicateKeys(stores: StoreConfig[]): string[] {
  const keyMap = new Map<string, string[]>()
  const duplicates: string[] = []
  
  stores.forEach(store => {
    if (store.persistConfig?.name) {
      const key = store.persistConfig.name
      if (!keyMap.has(key)) {
        keyMap.set(key, [])
      }
      keyMap.get(key)!.push(store.name)
    }
  })
  
  keyMap.forEach((storeNames, key) => {
    if (storeNames.length > 1) {
      duplicates.push(
        `Duplicate key "${key}" used by: ${storeNames.join(', ')}`
      )
    }
  })
  
  return duplicates
}

/**
 * Run comprehensive security audit
 */
export async function runSecurityAudit(): Promise<{
  piiReports: PIIAuditReport[]
  duplicateKeys: string[]
  classificationViolations: unknown[]
  passed: boolean
}> {
  console.log('🔍 Starting Security Audit...\n')
  
  const stores = getAllStores()
  const piiReports: PIIAuditReport[] = []
  
  // 1. Check for duplicate persistence keys
  console.log('📋 Checking for duplicate persistence keys...')
  const duplicateKeys = checkDuplicateKeys(stores)
  if (duplicateKeys.length > 0) {
    console.error('❌ Duplicate keys found:')
    duplicateKeys.forEach(dup => console.error(`   - ${dup}`))
  } else {
    console.log('✅ No duplicate persistence keys found')
  }
  console.log('')
  
  // 2. Run PII scans
  console.log('🔍 Scanning for PII exposure...\n')
  
  for (const store of stores) {
    try {
      const state = store.getState()
      const report = scanStoreForPII(
        store.name,
        state,
        store.persistConfig
      )
      
      piiReports.push(report)
      reportPIIToConsole(report)
      console.log('')
      
      // Also check data classification
      if (store.persistConfig) {
        // Simulate checking persisted data against classification
        const persistedState = store.persistConfig.partialize?.(state) || state
        validatePersistedState(store.name, persistedState, StorageType.LOCAL)
      }
    } catch (error) {
      console.error(`Error scanning ${store.name}:`, error)
    }
  }
  
  // 3. Report classification violations
  console.log('📊 Data Classification Violations:')
  classificationValidator.report()
  const violations = classificationValidator.getViolations()
  console.log('')
  
  // 4. Generate summary report
  const markdown = generatePIIReport(piiReports)
  
  // Save report to file
  if (typeof window === 'undefined') {
    // Node.js environment
    try {
      const fs = await import('fs')
      const path = await import('path')
      const reportPath = path.join(process.cwd(), 'security-audit-report.md')
      await fs.promises.writeFile(reportPath, markdown)
      console.log(`📄 Full report saved to: ${reportPath}`)
    } catch {
      console.log('📄 Full Report:\n')
      console.log(markdown)
    }
  } else {
    // Browser environment
    console.log('📄 Full Report:\n')
    console.log(markdown)
  }
  
  // 5. Overall pass/fail
  const hasCriticalPII = piiReports.some(r => r.criticalCount > 0)
  const hasUnencryptedPII = piiReports.some(r => 
    r.piiDetections.some(d => 
      d.isInPersistence && 
      d.severity === 'high' && 
      !d.isEncrypted
    )
  )
  const hasViolations = violations.length > 0
  const hasDuplicates = duplicateKeys.length > 0
  
  const passed = !hasCriticalPII && !hasUnencryptedPII && !hasViolations && !hasDuplicates
  
  console.log('\n' + '='.repeat(50))
  console.log(passed ? '✅ SECURITY AUDIT PASSED' : '❌ SECURITY AUDIT FAILED')
  console.log('='.repeat(50) + '\n')
  
  if (!passed) {
    console.log('Issues to fix:')
    if (hasCriticalPII) console.log('  - Critical PII exposure detected')
    if (hasUnencryptedPII) console.log('  - Unencrypted PII in persistence')
    if (hasViolations) console.log('  - Data classification violations')
    if (hasDuplicates) console.log('  - Duplicate persistence keys')
  }
  
  return {
    piiReports,
    duplicateKeys,
    classificationViolations: violations,
    passed,
  }
}

/**
 * Validate persisted state against classification rules
 */
function validatePersistedState(
  storeName: string,
  state: unknown,
  storageType: StorageType
): void {
  function validateObject(obj: unknown, path: string): void {
    if (obj == null || typeof obj !== 'object') return
    
    if (Array.isArray(obj)) {
      obj.forEach((item, index) => {
        validateObject(item, `${path}[${index}]`)
      })
    } else {
      Object.entries(obj).forEach(([key, value]) => {
        const fieldPath = path ? `${path}.${key}` : key
        classificationValidator.validateField(
          storeName,
          fieldPath,
          value,
          storageType
        )
        validateObject(value, fieldPath)
      })
    }
  }
  
  validateObject(state, '')
}

// CLI support
if (typeof window === 'undefined' && process.argv[1]?.endsWith('runSecurityAudit.ts')) {
  runSecurityAudit().then(result => {
    process.exit(result.passed ? 0 : 1)
  }).catch(error => {
    console.error('Audit failed:', error)
    process.exit(1)
  })
}

// Browser console command
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as Record<string, unknown>).__runSecurityAudit = runSecurityAudit
  console.log('Security audit available: __runSecurityAudit()')
}