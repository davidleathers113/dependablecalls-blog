/**
 * PII Scanner Utility
 * Phase 3.1a - Detects and reports personally identifiable information in state
 * 
 * This utility scans Zustand store state for potential PII exposure
 * and generates security audit reports for development and testing
 */

// PII Scanner utility - handles PII detection in state

/**
 * Types of PII that can be detected
 */
export const PIIType = {
  EMAIL: 'email',
  PHONE: 'phone',
  SSN: 'ssn',
  CREDIT_CARD: 'credit_card',
  BANK_ACCOUNT: 'bank_account',
  DRIVER_LICENSE: 'driver_license',
  PASSPORT: 'passport',
  IP_ADDRESS: 'ip_address',
  PHYSICAL_ADDRESS: 'physical_address',
  DATE_OF_BIRTH: 'date_of_birth',
  FULL_NAME: 'full_name',
  USERNAME: 'username',
  PASSWORD: 'password',
  API_KEY: 'api_key',
  AUTH_TOKEN: 'auth_token',
  BIOMETRIC: 'biometric',
  MEDICAL_INFO: 'medical_info',
  FINANCIAL_INFO: 'financial_info',
} as const
export type PIIType = typeof PIIType[keyof typeof PIIType]

/**
 * Severity levels for PII exposure
 */
export const PIISeverity = {
  CRITICAL: 'critical', // Passwords, SSN, credit cards
  HIGH: 'high',         // Email, phone, full names
  MEDIUM: 'medium',     // IP addresses, usernames
  LOW: 'low',           // Non-sensitive but trackable
} as const
export type PIISeverity = typeof PIISeverity[keyof typeof PIISeverity]

/**
 * PII detection result
 */
export interface PIIDetection {
  path: string
  value: unknown
  type: PIIType
  severity: PIISeverity
  recommendation: string
  isEncrypted: boolean
  isInPersistence: boolean
}

/**
 * PII audit report
 */
export interface PIIAuditReport {
  timestamp: number
  storeName: string
  totalFieldsScanned: number
  piiDetections: PIIDetection[]
  criticalCount: number
  highCount: number
  mediumCount: number
  lowCount: number
  recommendations: string[]
  passed: boolean
}

/**
 * PII patterns for detection
 * Using string methods instead of regex per security requirements
 */
const PII_PATTERNS: Record<PIIType, (value: string) => boolean> = {
  [PIIType.EMAIL]: (value: string) => {
    return value.includes('@') && value.includes('.') && 
           value.indexOf('@') < value.lastIndexOf('.') &&
           value.indexOf('@') > 0
  },
  
  [PIIType.PHONE]: (value: string) => {
    const cleaned = value.split('').filter(char => '0123456789'.includes(char)).join('')
    return cleaned.length >= 10 && cleaned.length <= 15
  },
  
  [PIIType.SSN]: (value: string) => {
    const cleaned = value.split('').filter(char => '0123456789'.includes(char)).join('')
    return cleaned.length === 9 || 
           (cleaned.length === 11 && value.includes('-'))
  },
  
  [PIIType.CREDIT_CARD]: (value: string) => {
    const cleaned = value.split('').filter(char => '0123456789'.includes(char)).join('')
    return cleaned.length >= 13 && cleaned.length <= 19
  },
  
  [PIIType.IP_ADDRESS]: (value: string) => {
    const parts = value.split('.')
    if (parts.length !== 4) return false
    return parts.every(part => {
      const num = parseInt(part, 10)
      return !isNaN(num) && num >= 0 && num <= 255
    })
  },
  
  [PIIType.API_KEY]: (value: string) => {
    return value.length > 20 && 
           (value.startsWith('sk_') || value.startsWith('pk_') || 
            value.includes('api_key') || value.includes('apikey'))
  },
  
  [PIIType.AUTH_TOKEN]: (value: string) => {
    return value.length > 20 && 
           (value.startsWith('Bearer ') || value.includes('token') ||
            value.startsWith('ey')) // JWT tokens
  },
  
  [PIIType.PASSWORD]: () => {
    // This is a heuristic - in practice we'd check field names
    return false // Will be detected by field name analysis
  },
  
  // Simplified patterns for other types
  [PIIType.BANK_ACCOUNT]: () => false,
  [PIIType.DRIVER_LICENSE]: () => false,
  [PIIType.PASSPORT]: () => false,
  [PIIType.PHYSICAL_ADDRESS]: () => false,
  [PIIType.DATE_OF_BIRTH]: () => false,
  [PIIType.FULL_NAME]: () => false,
  [PIIType.USERNAME]: () => false,
  [PIIType.BIOMETRIC]: () => false,
  [PIIType.MEDICAL_INFO]: () => false,
  [PIIType.FINANCIAL_INFO]: () => false,
}

/**
 * Field name indicators for PII
 */
const PII_FIELD_INDICATORS: Record<string, PIIType> = {
  // Authentication
  password: PIIType.PASSWORD,
  pass: PIIType.PASSWORD,
  pwd: PIIType.PASSWORD,
  secret: PIIType.PASSWORD,
  token: PIIType.AUTH_TOKEN,
  auth: PIIType.AUTH_TOKEN,
  bearer: PIIType.AUTH_TOKEN,
  api_key: PIIType.API_KEY,
  apikey: PIIType.API_KEY,
  
  // Personal info
  email: PIIType.EMAIL,
  mail: PIIType.EMAIL,
  phone: PIIType.PHONE,
  mobile: PIIType.PHONE,
  cell: PIIType.PHONE,
  ssn: PIIType.SSN,
  social: PIIType.SSN,
  
  // Financial
  card: PIIType.CREDIT_CARD,
  credit: PIIType.CREDIT_CARD,
  cvv: PIIType.CREDIT_CARD,
  bank: PIIType.BANK_ACCOUNT,
  account: PIIType.BANK_ACCOUNT,
  routing: PIIType.BANK_ACCOUNT,
  
  // Identity
  name: PIIType.FULL_NAME,
  firstname: PIIType.FULL_NAME,
  lastname: PIIType.FULL_NAME,
  username: PIIType.USERNAME,
  user: PIIType.USERNAME,
  
  // Network
  ip: PIIType.IP_ADDRESS,
  ipaddress: PIIType.IP_ADDRESS,
  
  // Dates
  dob: PIIType.DATE_OF_BIRTH,
  birth: PIIType.DATE_OF_BIRTH,
  birthday: PIIType.DATE_OF_BIRTH,
}

/**
 * Get PII severity based on type
 */
function getPIISeverity(type: PIIType): PIISeverity {
  switch (type) {
    case PIIType.PASSWORD:
    case PIIType.SSN:
    case PIIType.CREDIT_CARD:
    case PIIType.API_KEY:
    case PIIType.AUTH_TOKEN:
      return PIISeverity.CRITICAL
      
    case PIIType.EMAIL:
    case PIIType.PHONE:
    case PIIType.FULL_NAME:
    case PIIType.BANK_ACCOUNT:
    case PIIType.MEDICAL_INFO:
    case PIIType.FINANCIAL_INFO:
      return PIISeverity.HIGH
      
    case PIIType.IP_ADDRESS:
    case PIIType.USERNAME:
    case PIIType.PHYSICAL_ADDRESS:
    case PIIType.DATE_OF_BIRTH:
      return PIISeverity.MEDIUM
      
    default:
      return PIISeverity.LOW
  }
}

/**
 * Get recommendation for PII type
 */
function getRecommendation(type: PIIType, isInPersistence: boolean): string {
  if (isInPersistence) {
    switch (getPIISeverity(type)) {
      case PIISeverity.CRITICAL:
        return 'NEVER persist this data. Store only in memory or use server-side sessions.'
      case PIISeverity.HIGH:
        return 'Encrypt before persisting or store server-side only.'
      case PIISeverity.MEDIUM:
        return 'Consider encrypting or using session storage instead of localStorage.'
      case PIISeverity.LOW:
        return 'Review if persistence is necessary. Consider data minimization.'
    }
  }
  
  return 'Ensure proper access controls and encryption in transit.'
}

/**
 * Check if a value appears to be encrypted
 */
function isLikelyEncrypted(value: unknown): boolean {
  if (typeof value !== 'string') return false
  
  // Check for common encryption patterns
  // High entropy strings that look like base64 or hex
  const hasHighEntropy = value.length > 50
  const looksLikeBase64 = value.includes('=') || 
                          (value.includes('+') && value.includes('/'))
  const looksLikeHex = value.split('').every(char => 
    '0123456789abcdefABCDEF'.includes(char)
  )
  
  return hasHighEntropy && (looksLikeBase64 || looksLikeHex)
}

/**
 * Scan an object for PII recursively
 */
function scanObject(
  obj: unknown,
  path: string,
  detections: PIIDetection[],
  persistedPaths: Set<string>,
  visited = new WeakSet()
): void {
  // Prevent circular references
  if (obj && typeof obj === 'object' && visited.has(obj)) {
    return
  }
  if (obj && typeof obj === 'object') {
    visited.add(obj)
  }
  
  // Handle null/undefined
  if (obj == null) return
  
  // Handle strings
  if (typeof obj === 'string') {
    // Check field name first
    const fieldName = path.split('.').pop()?.toLowerCase() || ''
    for (const [indicator, piiType] of Object.entries(PII_FIELD_INDICATORS)) {
      if (fieldName.includes(indicator)) {
        detections.push({
          path,
          value: isLikelyEncrypted(obj) ? '[ENCRYPTED]' : '[REDACTED]',
          type: piiType,
          severity: getPIISeverity(piiType),
          recommendation: getRecommendation(piiType, persistedPaths.has(path)),
          isEncrypted: isLikelyEncrypted(obj),
          isInPersistence: persistedPaths.has(path),
        })
        return
      }
    }
    
    // Check patterns
    for (const [piiType, detector] of Object.entries(PII_PATTERNS)) {
      if (detector(obj)) {
        detections.push({
          path,
          value: '[REDACTED]',
          type: piiType as PIIType,
          severity: getPIISeverity(piiType as PIIType),
          recommendation: getRecommendation(piiType as PIIType, persistedPaths.has(path)),
          isEncrypted: false,
          isInPersistence: persistedPaths.has(path),
        })
        break
      }
    }
    return
  }
  
  // Handle arrays
  if (Array.isArray(obj)) {
    obj.forEach((item, index) => {
      scanObject(item, `${path}[${index}]`, detections, persistedPaths, visited)
    })
    return
  }
  
  // Handle objects
  if (typeof obj === 'object') {
    Object.entries(obj).forEach(([key, value]) => {
      scanObject(value, path ? `${path}.${key}` : key, detections, persistedPaths, visited)
    })
  }
}

/**
 * Get persisted paths from a store's persistence config
 */
function getPersistedPaths(
  state: unknown,
  persistConfig?: { partialize?: (state: unknown) => unknown }
): Set<string> {
  const paths = new Set<string>()
  
  if (!persistConfig?.partialize) {
    // If no partialize, entire state is persisted
    return new Set(['*'])
  }
  
  // Get persisted subset
  const persistedState = persistConfig.partialize(state)
  
  // Collect all paths in persisted state
  function collectPaths(obj: unknown, path: string): void {
    if (obj == null) return
    
    paths.add(path)
    
    if (Array.isArray(obj)) {
      obj.forEach((_, index) => {
        collectPaths(obj[index], `${path}[${index}]`)
      })
    } else if (typeof obj === 'object') {
      Object.keys(obj).forEach(key => {
        collectPaths((obj as Record<string, unknown>)[key], path ? `${path}.${key}` : key)
      })
    }
  }
  
  collectPaths(persistedState, '')
  return paths
}

/**
 * Scan a Zustand store for PII
 */
export function scanStoreForPII(
  storeName: string,
  state: unknown,
  persistConfig?: { partialize?: (state: unknown) => unknown }
): PIIAuditReport {
  const detections: PIIDetection[] = []
  const persistedPaths = getPersistedPaths(state, persistConfig)
  
  // Count total fields
  let totalFields = 0
  function countFields(obj: unknown): void {
    if (obj == null || typeof obj !== 'object') {
      totalFields++
      return
    }
    
    if (Array.isArray(obj)) {
      obj.forEach(countFields)
    } else {
      Object.values(obj).forEach(countFields)
    }
  }
  countFields(state)
  
  // Scan for PII
  scanObject(state, '', detections, persistedPaths)
  
  // Count by severity
  const severityCounts = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
  }
  
  detections.forEach(detection => {
    severityCounts[detection.severity]++
  })
  
  // Generate recommendations
  const recommendations: string[] = []
  
  if (severityCounts.critical > 0) {
    recommendations.push(
      'CRITICAL: Remove all passwords, tokens, and highly sensitive data from client state.'
    )
  }
  
  if (detections.some(d => d.isInPersistence && d.severity === PIISeverity.HIGH)) {
    recommendations.push(
      'HIGH: Implement encryption for sensitive data before persisting to localStorage.'
    )
  }
  
  if (detections.some(d => !d.isEncrypted && d.severity >= PIISeverity.HIGH)) {
    recommendations.push(
      'Implement field-level encryption for sensitive data in state.'
    )
  }
  
  const persistedPII = detections.filter(d => d.isInPersistence)
  if (persistedPII.length > 0) {
    recommendations.push(
      `Found ${persistedPII.length} PII fields in persisted state. Consider using session storage or server-side storage.`
    )
  }
  
  return {
    timestamp: Date.now(),
    storeName,
    totalFieldsScanned: totalFields,
    piiDetections: detections,
    criticalCount: severityCounts.critical,
    highCount: severityCounts.high,
    mediumCount: severityCounts.medium,
    lowCount: severityCounts.low,
    recommendations,
    passed: severityCounts.critical === 0 && 
            detections.filter(d => d.isInPersistence && d.severity === PIISeverity.HIGH && !d.isEncrypted).length === 0,
  }
}

/**
 * Generate a markdown report from PII scan results
 */
export function generatePIIReport(reports: PIIAuditReport[]): string {
  const timestamp = new Date().toISOString()
  const totalDetections = reports.reduce((sum, r) => sum + r.piiDetections.length, 0)
  const failedStores = reports.filter(r => !r.passed)
  
  let markdown = `# PII Security Audit Report\n\n`
  markdown += `**Generated:** ${timestamp}\n`
  markdown += `**Stores Scanned:** ${reports.length}\n`
  markdown += `**Total PII Detections:** ${totalDetections}\n`
  markdown += `**Failed Stores:** ${failedStores.length}\n\n`
  
  // Summary by severity
  markdown += `## Summary by Severity\n\n`
  const totalCritical = reports.reduce((sum, r) => sum + r.criticalCount, 0)
  const totalHigh = reports.reduce((sum, r) => sum + r.highCount, 0)
  const totalMedium = reports.reduce((sum, r) => sum + r.mediumCount, 0)
  const totalLow = reports.reduce((sum, r) => sum + r.lowCount, 0)
  
  markdown += `- **CRITICAL:** ${totalCritical} ${totalCritical > 0 ? '🚨' : '✅'}\n`
  markdown += `- **HIGH:** ${totalHigh} ${totalHigh > 0 ? '⚠️' : '✅'}\n`
  markdown += `- **MEDIUM:** ${totalMedium}\n`
  markdown += `- **LOW:** ${totalLow}\n\n`
  
  // Store details
  markdown += `## Store Analysis\n\n`
  
  reports.forEach(report => {
    markdown += `### ${report.storeName} ${report.passed ? '✅' : '❌'}\n\n`
    markdown += `**Fields Scanned:** ${report.totalFieldsScanned}\n`
    markdown += `**PII Found:** ${report.piiDetections.length}\n\n`
    
    if (report.piiDetections.length > 0) {
      markdown += `#### Detections:\n\n`
      markdown += `| Path | Type | Severity | Persisted | Encrypted |\n`
      markdown += `|------|------|----------|-----------|------------|\n`
      
      report.piiDetections.forEach(detection => {
        markdown += `| ${detection.path} | ${detection.type} | ${detection.severity} | ${detection.isInPersistence ? 'Yes ⚠️' : 'No'} | ${detection.isEncrypted ? 'Yes' : 'No ❌'} |\n`
      })
      
      markdown += `\n`
    }
    
    if (report.recommendations.length > 0) {
      markdown += `#### Recommendations:\n\n`
      report.recommendations.forEach(rec => {
        markdown += `- ${rec}\n`
      })
      markdown += `\n`
    }
  })
  
  // Global recommendations
  markdown += `## Global Recommendations\n\n`
  markdown += `1. **Implement Encryption**: Use Web Crypto API for field-level encryption\n`
  markdown += `2. **Minimize Data**: Only store necessary data in client state\n`
  markdown += `3. **Use Secure Storage**: Prefer sessionStorage over localStorage for sensitive data\n`
  markdown += `4. **Server-Side Sessions**: Move authentication tokens to httpOnly cookies\n`
  markdown += `5. **Regular Audits**: Run PII scans in CI/CD pipeline\n`
  
  return markdown
}

/**
 * Console reporter for development
 */
export function reportPIIToConsole(report: PIIAuditReport): void {
  const prefix = report.passed ? '✅' : '❌'
  
  console.group(`${prefix} PII Scan: ${report.storeName}`)
  
  if (report.criticalCount > 0) {
    console.error(`🚨 CRITICAL: ${report.criticalCount} critical PII exposures found!`)
  }
  
  if (report.highCount > 0) {
    console.warn(`⚠️  HIGH: ${report.highCount} high-severity PII exposures found`)
  }
  
  console.log(`Total fields scanned: ${report.totalFieldsScanned}`)
  console.log(`PII detections: ${report.piiDetections.length}`)
  
  if (report.piiDetections.length > 0) {
    console.table(
      report.piiDetections.map(d => ({
        Path: d.path,
        Type: d.type,
        Severity: d.severity,
        Persisted: d.isInPersistence ? 'YES' : 'No',
        Encrypted: d.isEncrypted ? 'Yes' : 'NO',
      }))
    )
  }
  
  if (report.recommendations.length > 0) {
    console.group('Recommendations:')
    report.recommendations.forEach(rec => console.log(`• ${rec}`))
    console.groupEnd()
  }
  
  console.groupEnd()
}

// Development mode auto-scanner
if (process.env.NODE_ENV === 'development') {
  // Will be integrated with stores in next step
  console.log('PII Scanner loaded. Use scanStoreForPII() to audit stores.')
}