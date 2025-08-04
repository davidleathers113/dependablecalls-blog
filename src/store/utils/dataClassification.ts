/**
 * Data Classification System
 * Phase 3.1a - Defines data sensitivity levels and handling rules
 * 
 * This system provides a framework for classifying data sensitivity
 * and enforcing appropriate storage and handling policies
 */

/**
 * Data classification levels based on sensitivity
 */
export enum DataClassification {
  /**
   * PUBLIC - Non-sensitive data that can be freely shared
   * Examples: Product names, public pricing, feature flags
   */
  PUBLIC = 'public',
  
  /**
   * INTERNAL - Business data that should not be exposed publicly
   * Examples: Analytics data, internal metrics, non-PII user preferences
   */
  INTERNAL = 'internal',
  
  /**
   * CONFIDENTIAL - Sensitive business or user data
   * Examples: Email addresses, phone numbers, usage patterns
   */
  CONFIDENTIAL = 'confidential',
  
  /**
   * RESTRICTED - Highly sensitive data requiring maximum protection
   * Examples: Passwords, payment info, SSN, medical records
   */
  RESTRICTED = 'restricted',
}

/**
 * Storage policies for each classification level
 */
export interface StoragePolicy {
  canPersist: boolean
  requiresEncryption: boolean
  allowedStorage: StorageType[]
  maxRetentionDays: number | null
  auditRequired: boolean
}

/**
 * Available storage types
 */
export enum StorageType {
  MEMORY = 'memory',           // In-memory only
  SESSION = 'session',         // SessionStorage
  LOCAL = 'local',            // LocalStorage
  INDEXED_DB = 'indexeddb',   // IndexedDB
  COOKIE = 'cookie',          // Cookies (httpOnly)
  SERVER = 'server',          // Server-side only
}

/**
 * Storage policies by classification level
 */
export const STORAGE_POLICIES: Record<DataClassification, StoragePolicy> = {
  [DataClassification.PUBLIC]: {
    canPersist: true,
    requiresEncryption: false,
    allowedStorage: [
      StorageType.MEMORY,
      StorageType.SESSION,
      StorageType.LOCAL,
      StorageType.INDEXED_DB,
      StorageType.COOKIE,
    ],
    maxRetentionDays: null, // No limit
    auditRequired: false,
  },
  
  [DataClassification.INTERNAL]: {
    canPersist: true,
    requiresEncryption: false,
    allowedStorage: [
      StorageType.MEMORY,
      StorageType.SESSION,
      StorageType.LOCAL,
      StorageType.INDEXED_DB,
    ],
    maxRetentionDays: 90,
    auditRequired: false,
  },
  
  [DataClassification.CONFIDENTIAL]: {
    canPersist: true,
    requiresEncryption: true,
    allowedStorage: [
      StorageType.MEMORY,
      StorageType.SESSION,
      StorageType.INDEXED_DB, // With encryption
    ],
    maxRetentionDays: 30,
    auditRequired: true,
  },
  
  [DataClassification.RESTRICTED]: {
    canPersist: false, // Client-side persistence not allowed
    requiresEncryption: true,
    allowedStorage: [
      StorageType.MEMORY,
      StorageType.SERVER, // Server-side only
    ],
    maxRetentionDays: 0, // No client retention
    auditRequired: true,
  },
}

/**
 * Field classification metadata
 */
export interface FieldClassification {
  fieldPath: string
  classification: DataClassification
  reason: string
  piiType?: string
  customPolicy?: Partial<StoragePolicy>
}

/**
 * Store classification configuration
 */
export interface StoreClassification {
  storeName: string
  defaultClassification: DataClassification
  fieldClassifications: FieldClassification[]
  globalPolicies?: Partial<StoragePolicy>
}

/**
 * Runtime metadata storage for decorated fields
 */
const decoratorMetadata = new Map<string, FieldClassification>()

/**
 * Decorator for marking field classifications
 * Stores metadata for runtime access while maintaining configuration-based approach
 */
export function classified(classification: DataClassification, reason: string) {
  return function<T extends Record<string, unknown>>(target: T, propertyKey: keyof T): void {
    // Store metadata using class name + property key as identifier
    const className = (target.constructor as { name: string }).name
    const fieldPath = `${className}.${String(propertyKey)}`
    
    decoratorMetadata.set(fieldPath, {
      fieldPath: String(propertyKey),
      classification,
      reason,
    })
    
    // Mark property for development-time validation
    if (process.env.NODE_ENV === 'development') {
      console.debug(`🏷️  Classified ${fieldPath} as ${classification}: ${reason}`)
    }
  }
}

/**
 * Get classification metadata for a decorated field
 */
export function getDecoratorMetadata(className: string, propertyKey: string): FieldClassification | undefined {
  return decoratorMetadata.get(`${className}.${propertyKey}`)
}

/**
 * Get all decorator metadata (for debugging)
 */
export function getAllDecoratorMetadata(): ReadonlyMap<string, FieldClassification> {
  return decoratorMetadata
}

/**
 * Check if a storage type is allowed for a classification
 */
export function isStorageAllowed(
  classification: DataClassification,
  storageType: StorageType
): boolean {
  const policy = STORAGE_POLICIES[classification]
  return policy.allowedStorage.includes(storageType)
}

/**
 * Check if encryption is required for a classification
 */
export function requiresEncryption(classification: DataClassification): boolean {
  return STORAGE_POLICIES[classification].requiresEncryption
}

/**
 * Get the most restrictive classification from a list
 */
export function getMostRestrictive(
  classifications: DataClassification[]
): DataClassification {
  const priority = [
    DataClassification.RESTRICTED,
    DataClassification.CONFIDENTIAL,
    DataClassification.INTERNAL,
    DataClassification.PUBLIC,
  ]
  
  for (const level of priority) {
    if (classifications.includes(level)) {
      return level
    }
  }
  
  return DataClassification.PUBLIC
}

/**
 * Validate if data can be stored in a specific storage type
 */
export function validateStorage(
  data: unknown,
  classification: DataClassification,
  targetStorage: StorageType
): { valid: boolean; reason?: string } {
  const policy = STORAGE_POLICIES[classification]
  
  // Check if persistence is allowed
  if (!policy.canPersist && targetStorage !== StorageType.MEMORY) {
    return {
      valid: false,
      reason: `${classification} data cannot be persisted client-side`,
    }
  }
  
  // Check if storage type is allowed
  if (!policy.allowedStorage.includes(targetStorage)) {
    return {
      valid: false,
      reason: `${targetStorage} storage not allowed for ${classification} data`,
    }
  }
  
  // Check encryption requirement
  if (policy.requiresEncryption && 
      targetStorage !== StorageType.MEMORY && 
      targetStorage !== StorageType.SERVER) {
    // In real implementation, we'd check if encryption is enabled
    return {
      valid: true,
      reason: 'Encryption required for this storage type',
    }
  }
  
  return { valid: true }
}

/**
 * Default store classifications for DCE platform
 */
export const DEFAULT_STORE_CLASSIFICATIONS: Record<string, StoreClassification> = {
  'auth-store': {
    storeName: 'auth-store',
    defaultClassification: DataClassification.RESTRICTED,
    fieldClassifications: [
      {
        fieldPath: 'preferences',
        classification: DataClassification.INTERNAL,
        reason: 'User preferences without PII',
      },
      {
        fieldPath: 'session',
        classification: DataClassification.RESTRICTED,
        reason: 'Authentication tokens',
        piiType: 'auth_token',
      },
      {
        fieldPath: 'user.email',
        classification: DataClassification.CONFIDENTIAL,
        reason: 'Email is PII',
        piiType: 'email',
      },
    ],
  },
  
  'buyer-store': {
    storeName: 'buyer-store',
    defaultClassification: DataClassification.INTERNAL,
    fieldClassifications: [
      {
        fieldPath: 'campaigns',
        classification: DataClassification.INTERNAL,
        reason: 'Business data',
      },
      {
        fieldPath: 'billingInfo',
        classification: DataClassification.RESTRICTED,
        reason: 'Payment information',
        piiType: 'financial_info',
      },
    ],
  },
  
  'supplier-store': {
    storeName: 'supplier-store',
    defaultClassification: DataClassification.INTERNAL,
    fieldClassifications: [
      {
        fieldPath: 'listings',
        classification: DataClassification.INTERNAL,
        reason: 'Business data',
      },
      {
        fieldPath: 'payoutInfo',
        classification: DataClassification.RESTRICTED,
        reason: 'Banking information',
        piiType: 'bank_account',
      },
    ],
  },
  
  'settings-store': {
    storeName: 'settings-store',
    defaultClassification: DataClassification.PUBLIC,
    fieldClassifications: [
      {
        fieldPath: 'userSettings.notifications.email',
        classification: DataClassification.CONFIDENTIAL,
        reason: 'Contains email address',
        piiType: 'email',
      },
    ],
  },
}

/**
 * Get classification for a specific field path
 */
export function getFieldClassification(
  storeName: string,
  fieldPath: string
): DataClassification {
  const storeConfig = DEFAULT_STORE_CLASSIFICATIONS[storeName]
  if (!storeConfig) {
    return DataClassification.INTERNAL // Default for unknown stores
  }
  
  // Check specific field classifications
  const fieldConfig = storeConfig.fieldClassifications.find(fc => 
    fieldPath.startsWith(fc.fieldPath)
  )
  
  if (fieldConfig) {
    return fieldConfig.classification
  }
  
  // Return store default
  return storeConfig.defaultClassification
}

/**
 * Classification validator for development
 */
export class ClassificationValidator {
  private violations: Array<{
    storeName: string
    fieldPath: string
    value: unknown
    expectedClassification: DataClassification
    actualStorage: StorageType
    violation: string
  }> = []
  
  /**
   * Validate data against classification rules
   */
  validateField(
    storeName: string,
    fieldPath: string,
    value: unknown,
    actualStorage: StorageType
  ): void {
    const classification = getFieldClassification(storeName, fieldPath)
    const validation = validateStorage(value, classification, actualStorage)
    
    if (!validation.valid) {
      this.violations.push({
        storeName,
        fieldPath,
        value: '[REDACTED]',
        expectedClassification: classification,
        actualStorage,
        violation: validation.reason || 'Unknown violation',
      })
    }
  }
  
  /**
   * Get all violations
   */
  getViolations() {
    return [...this.violations]
  }
  
  /**
   * Clear violations
   */
  clear(): void {
    this.violations = []
  }
  
  /**
   * Report violations to console
   */
  report(): void {
    if (this.violations.length === 0) {
      console.log('✅ No data classification violations found')
      return
    }
    
    console.error(`❌ Found ${this.violations.length} data classification violations:`)
    console.table(
      this.violations.map(v => ({
        Store: v.storeName,
        Field: v.fieldPath,
        Classification: v.expectedClassification,
        Storage: v.actualStorage,
        Violation: v.violation,
      }))
    )
  }
}

/**
 * Global classification validator instance for development
 */
export const classificationValidator = new ClassificationValidator()

// Export for use in store implementations
export type { StoragePolicy, FieldClassification, StoreClassification }