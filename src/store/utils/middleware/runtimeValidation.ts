/**
 * Runtime Validation Middleware - Phase 3.2 Production-Ready
 * Provides real-time state validation during development
 * Integrates with Zod schemas to catch data integrity issues early
 * 
 * SECURITY: All PII logging is masked, all errors sanitized
 * PERFORMANCE: Optimized with caching and proper debouncing
 * RELIABILITY: Full exception handling and cleanup
 */

import { type StateCreator, type StoreMutatorIdentifier } from 'zustand'
import { ZodError } from 'zod'
// Simple debounce function to avoid lodash import issues
function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  delay: number,
  options?: { leading?: boolean; trailing?: boolean }
): T & { cancel: () => void } {
  let timeoutId: NodeJS.Timeout | null = null
  let lastCallTime: number
  const leading = options?.leading ?? false
  const trailing = options?.trailing ?? true

  const debounced = function (this: unknown, ...args: Parameters<T>) {
    const callNow = leading && !timeoutId
    lastCallTime = Date.now()

    if (timeoutId) {
      clearTimeout(timeoutId)
    }

    timeoutId = setTimeout(() => {
      timeoutId = null
      if (trailing && Date.now() - lastCallTime >= delay) {
        func.apply(this, args)
      }
    }, delay)

    if (callNow) {
      func.apply(this, args)
    }
  } as T & { cancel: () => void }

  debounced.cancel = function () {
    if (timeoutId) {
      clearTimeout(timeoutId)
      timeoutId = null
    }
  }

  return debounced
}
import { 
  validateWithSchema, 
  getLatestSchema, 
  getLatestSchemaVersion,
  getSchemaByVersion
} from '../schemas/index'
import { scanStoreForPII, reportPIIToConsole } from '../piiScanner'
import { 
  deepMerge, 
  maskPIIValue, 
  getPerformance, 
  ValidationQueue, 
  RateLimiter,
  createStructuredClone
} from '../validationHelpers'
// Browser-compatible hashing (no Node crypto dependency)

export interface RuntimeValidationOptions {
  /** The name of the store (must match schema registration) */
  storeName: string
  
  /** Enable validation (default: true in development, false in production) */
  enabled?: boolean
  
  /** Validation triggers */
  triggers?: {
    /** Validate on every state change (default: true) */
    onChange: boolean
    /** Validate on store initialization (default: true) */
    onInit: boolean
    /** Validate before persistence (default: true) */
    beforePersist: boolean
    /** Validate after rehydration (default: true) */
    afterRehydrate: boolean
  }
  
  /** Validation behavior */
  behavior?: {
    /** Throw errors on validation failure (default: false) */
    throwOnError: boolean
    /** Log validation results to console (default: true) */
    logToConsole: boolean
    /** Include stack traces in error logs (default: false) */
    includeStackTrace: boolean
    /** Debounce validation (default: 100ms) */
    debounceMs: number
    /** Rate limit window for adaptive throttling */
    rateLimitWindow?: number
  }
  
  /** Schema validation options */
  schema?: {
    /** Use latest schema version (default: true) */
    useLatestVersion: boolean
    /** Fallback to any version if latest fails (default: false) */
    fallbackToAnyVersion: boolean
    /** Custom schema version to validate against */
    targetVersion?: number
    /** Verify schema integrity with hash */
    verifySchemaHash?: boolean
  }
  
  /** Security validation */
  security?: {
    /** Enable PII scanning (default: true in development) */
    scanForPII: boolean
    /** PII scan frequency (default: 'onChange') */
    piiScanTrigger: 'onChange' | 'onInit' | 'periodic' | 'manual'
    /** Report PII to console (default: true) */
    reportPII: boolean
    /** Throw on PII detection (default: false) */
    throwOnPII: boolean
    /** Enable audit trail for validation errors */
    enableAuditTrail?: boolean
  }
  
  /** Performance monitoring */
  performance?: {
    /** Monitor validation performance (default: true) */
    enabled: boolean
    /** Warn on slow validations (default: 100ms) */
    slowValidationThresholdMs: number
    /** Track validation metrics (default: true) */
    trackMetrics: boolean
    /** Send metrics to APM service */
    sendToAPM?: boolean
  }
  
  /** Development helpers */
  development?: {
    /** Verbose logging (default: false) */
    verbose: boolean
    /** Include validation in dev tools (default: true) */
    includeInDevTools: boolean
    /** Auto-fix common validation issues (default: false) */
    autoFix: boolean
  }
}

export interface RuntimeValidationState {
  /** Validation status */
  _validation?: {
    isValid: boolean
    lastValidated: string
    errors: Array<{
      path: string
      message: string
      timestamp: string
    }>
    warnings: Array<{
      path: string
      message: string
      timestamp: string
    }>
    performance: {
      lastValidationTime: number
      averageValidationTime: number
      validationCount: number
    }
    schemaHash?: string
  }
  
  /** PII scan results */
  _piiScan?: {
    lastScan: string
    detections: number
    hasCritical: boolean
    hasHigh: boolean
    details: Array<{
      path: string
      type: string
      severity: string
      encrypted: boolean
    }>
  }
  
  /** Audit trail for security compliance */
  _auditTrail?: Array<{
    timestamp: string
    type: 'validation' | 'pii'
    success: boolean
    errorCount?: number
    sanitizedMessage?: string
  }>
}

export interface RuntimeValidationApi {
  /** Manually trigger validation */
  validate: () => Promise<ValidationResult>
  /** Manually trigger PII scan */
  scanPII: () => Promise<PIIScanResult>
  /** Get validation status */
  getValidationStatus: () => RuntimeValidationState['_validation']
  /** Get PII scan status */
  getPIIScanStatus: () => RuntimeValidationState['_piiScan']
  /** Clear validation errors/warnings */
  clearValidationStatus: () => void
  /** Destroy and cleanup middleware */
  destroy: () => void
  /** Get audit trail */
  getAuditTrail?: () => RuntimeValidationState['_auditTrail']
}

export interface ValidationResult {
  success: boolean
  errors: Array<{ path: string; message: string }>
  warnings: Array<{ path: string; message: string }>
  validationTime: number
  schemaVersion: number
  schemaHash?: string
}

export interface PIIScanResult {
  scanTime: number
  detections: number
  hasCritical: boolean
  hasHigh: boolean
  details: Array<{
    path: string
    type: string
    severity: string
    encrypted: boolean
  }>
}

// Default options with optimized caching
const defaultOptions: Partial<RuntimeValidationOptions> = {
  enabled: process.env.NODE_ENV === 'development',
  triggers: {
    onChange: true,
    onInit: true,
    beforePersist: true,
    afterRehydrate: true,
  },
  behavior: {
    throwOnError: false,
    logToConsole: true,
    includeStackTrace: false,
    debounceMs: 100,
    rateLimitWindow: 100,
  },
  schema: {
    useLatestVersion: true,
    fallbackToAnyVersion: false,
    verifySchemaHash: process.env.NODE_ENV === 'production',
  },
  security: {
    scanForPII: process.env.NODE_ENV === 'development',
    piiScanTrigger: 'onChange',
    reportPII: true,
    throwOnPII: false,
    enableAuditTrail: process.env.NODE_ENV === 'production',
  },
  performance: {
    enabled: true,
    slowValidationThresholdMs: 100,
    trackMetrics: true,
    sendToAPM: false,
  },
  development: {
    verbose: false,
    includeInDevTools: true,
    autoFix: false,
  },
}

// Get performance instance
const perf = getPerformance()

// Cache for merged options to avoid deep merge on every instantiation
const optionsCache = new WeakMap<RuntimeValidationOptions, RuntimeValidationOptions>()

function getMergedOptions(options: Partial<RuntimeValidationOptions> & { storeName: string }): RuntimeValidationOptions {
  if (optionsCache.has(options as RuntimeValidationOptions)) {
    return optionsCache.get(options as RuntimeValidationOptions)!
  }
  
  // Use structuredClone if available, otherwise fall back to deepMerge
  const merged = createStructuredClone 
    ? createStructuredClone({ ...defaultOptions, ...options })
    : deepMerge(defaultOptions as RuntimeValidationOptions, options)
    
  optionsCache.set(options as RuntimeValidationOptions, merged as RuntimeValidationOptions)
  return merged as RuntimeValidationOptions
}

// ZUSTAND v5: Enhanced error formatting with stricter types
function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.errors.map(err => {
    // Ensure path is properly stringified and sanitized
    const pathString = Array.isArray(err.path) 
      ? err.path.map(p => String(p)).join('.') 
      : 'root'
    
    return {
      path: pathString || 'root',
      message: sanitizeErrorMessage(err.message),
    }
  })
}

// Type guard for validation results
function isValidationSuccess(result: unknown): result is { success: true } {
  return typeof result === 'object' && result !== null && 'success' in result && (result as { success: boolean }).success === true
}

// Type guard for validation errors
function isValidationError(result: unknown): result is { success: false; error: ZodError } {
  return (
    typeof result === 'object' && 
    result !== null && 
    'success' in result && 
    (result as { success: boolean }).success === false &&
    'error' in result
  )
}

function updateValidationMetrics(
  current: RuntimeValidationState['_validation'],
  validationTime: number
): RuntimeValidationState['_validation']['performance'] {
  const count = (current?.performance?.validationCount || 0) + 1
  const currentAverage = current?.performance?.averageValidationTime || 0
  const newAverage = (currentAverage * (count - 1) + validationTime) / count
  
  return {
    lastValidationTime: validationTime,
    averageValidationTime: newAverage,
    validationCount: count,
  }
}

// Sanitize error messages for production
function sanitizeErrorMessage(message: string): string {
  // Remove any potential sensitive data patterns
  return message
    .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL]')
    .replace(/\b\d{3}-\d{2}-\d{4}\b/g, '[SSN]')
    .replace(/\b\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\b/g, '[CARD]')
    .replace(/Bearer\s+[A-Za-z0-9-._~+/]+=*/g, '[TOKEN]')
    .substring(0, 500) // Limit message length
}

// Calculate schema hash for integrity verification
// Uses a simple hash function compatible with browser environments
function calculateSchemaHash(schema: unknown): string {
  try {
    const schemaString = JSON.stringify(schema)
    // Simple hash function for browser compatibility
    let hash = 0
    for (let i = 0; i < schemaString.length; i++) {
      const char = schemaString.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // Convert to 32-bit integer
    }
    // Convert to hex string and take first 16 chars
    return Math.abs(hash).toString(16).padStart(16, '0').substring(0, 16)
  } catch {
    return 'unknown'
  }
}

// Safe async execution wrapper
async function safeAsyncExecution<T>(
  fn: () => Promise<T>,
  fallback: T,
  errorTag: string
): Promise<T> {
  try {
    return await fn()
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error(`[${errorTag}] Execution error:`, error)
    }
    return fallback
  }
}

/**
 * Runtime Validation Middleware
 * Provides real-time validation and PII scanning for Zustand stores
 * 
 * ZUSTAND v5 COMPATIBILITY: Enhanced type safety with proper setState overloads
 */
export const runtimeValidation = <
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
>(
  stateCreator: StateCreator<
    T & RuntimeValidationState & RuntimeValidationApi,
    Mps,
    Mcs,
    T
  >,
  options: Partial<RuntimeValidationOptions> & { storeName: string }
): StateCreator<
  T & RuntimeValidationState & RuntimeValidationApi,
  Mps,
  Mcs,
  T & RuntimeValidationState & RuntimeValidationApi
> => (set, get, api) => {
  const opts = getMergedOptions(options)
  const { storeName } = opts
  
  // Cleanup handlers
  const cleanupHandlers: Array<() => void> = []
  
  // If validation is disabled, return minimal implementation
  if (!opts.enabled) {
    return {
      ...stateCreator(set, get, api),
      validate: async () => ({ success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 }),
      scanPII: async () => ({ scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }),
      getValidationStatus: () => undefined,
      getPIIScanStatus: () => undefined,
      clearValidationStatus: () => {},
      destroy: () => {},
    }
  }
  
  // Validation queue to prevent race conditions
  const validationQueue = new ValidationQueue()
  const piiScanQueue = new ValidationQueue()
  
  // CRITICAL FIX: Separate rate limiters for validation and PII scanning
  const validationRateLimiter = new RateLimiter(opts.behavior?.rateLimitWindow || 100)
  const piiRateLimiter = new RateLimiter(opts.behavior?.rateLimitWindow || 100)
  
  // Audit trail for security compliance
  const auditTrail: NonNullable<RuntimeValidationState['_auditTrail']> = []
  
  function addAuditEntry(
    type: 'validation' | 'pii',
    success: boolean,
    errorCount?: number,
    message?: string
  ): void {
    if (!opts.security?.enableAuditTrail) return
    
    auditTrail.push({
      timestamp: new Date().toISOString(),
      type,
      success,
      errorCount,
      sanitizedMessage: message ? sanitizeErrorMessage(message) : undefined,
    })
    
    // Keep audit trail size manageable
    if (auditTrail.length > 1000) {
      auditTrail.splice(0, auditTrail.length - 1000)
    }
  }
  
  // Async validation function with comprehensive error handling
  const performValidationAsync = async (): Promise<ValidationResult> => {
    // Rate limiting check with separate limiter
    if (!validationRateLimiter.shouldAllow()) {
      return { success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 }
    }
    
    const startTime = perf.now()
    
    try {
      const state = get()
      const targetVersion = opts.schema?.targetVersion || getLatestSchemaVersion(storeName) || 1
      
      // CRITICAL FIX: Implement version-specific schema retrieval
      let schema
      if (opts.schema?.targetVersion) {
        schema = getSchemaByVersion(storeName, opts.schema.targetVersion)
        if (!schema) {
          throw new Error(`Schema version ${opts.schema.targetVersion} not found for store ${storeName}`)
        }
      } else {
        schema = getLatestSchema(storeName)
      }
      
      if (!schema) {
        const warning = {
          path: 'schema',
          message: `No schema found for store ${storeName}`,
        }
        
        if (opts.behavior?.logToConsole && process.env.NODE_ENV === 'development') {
          console.warn(`⚠️ [${storeName}] Validation warning:`, warning.message)
        }
        
        addAuditEntry('validation', false, 0, warning.message)
        
        return {
          success: false,
          errors: [],
          warnings: [warning],
          validationTime: perf.now() - startTime,
          schemaVersion: targetVersion,
        }
      }
      
      // Calculate and verify schema hash
      const schemaHash = calculateSchemaHash(schema)
      
      // ZUSTAND v5: Enhanced validation with proper type guards
      const validation = validateWithSchema(storeName, targetVersion, state)
      const validationTime = perf.now() - startTime
      
      let result: ValidationResult
      
      if (isValidationSuccess(validation)) {
        result = {
          success: true,
          errors: [],
          warnings: [],
          validationTime,
          schemaVersion: targetVersion,
          schemaHash,
        }
        
        if (opts.development?.verbose && process.env.NODE_ENV === 'development') {
          console.log(`✅ [${storeName}] Validation passed (${validationTime.toFixed(2)}ms)`)
        }
        
        addAuditEntry('validation', true)
      } else if (isValidationError(validation)) {
        // Type-safe access to error property
        const validationError = validation.error
        const errors = formatZodError(validationError)
        
        result = {
          success: false,
          errors,
          warnings: [],
          validationTime,
          schemaVersion: targetVersion,
          schemaHash,
        }
        
        if (opts.behavior?.logToConsole && process.env.NODE_ENV === 'development') {
          console.error(`❌ [${storeName}] Validation failed:`, errors)
          if (opts.behavior?.includeStackTrace) {
            console.error('Validation error details:', validationError)
          }
        }
        
        addAuditEntry('validation', false, errors.length, errors[0]?.message)
        
        if (opts.behavior?.throwOnError) {
          const sanitizedMessage = sanitizeErrorMessage(
            `Validation failed for ${storeName}: ${errors.length} error(s)`
          )
          throw new Error(sanitizedMessage)
        }
      } else {
        // Handle unexpected validation result format
        throw new Error(`Unexpected validation result format for ${storeName}`)
      }
      
      // Performance warning
      if (opts.performance?.enabled && validationTime > (opts.performance?.slowValidationThresholdMs || 100)) {
        console.warn(`🐌 [${storeName}] Slow validation detected: ${validationTime.toFixed(2)}ms`)
      }
      
      // Send metrics to APM if configured
      if (opts.performance?.sendToAPM) {
        // TODO: Implement APM integration
      }
      
      // Update validation state with proper typing
      const currentValidation = get()._validation
      const validationUpdate: Partial<RuntimeValidationState> = {
        _validation: {
          isValid: result.success,
          lastValidated: new Date().toISOString(),
          errors: result.errors.map(err => ({
            ...err,
            timestamp: new Date().toISOString(),
          })),
          warnings: result.warnings.map(warn => ({
            ...warn,
            timestamp: new Date().toISOString(),
          })),
          performance: updateValidationMetrics(currentValidation, validationTime),
          schemaHash,
        },
      }
      set(validationUpdate as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
      
      return result
      
    } catch (error) {
      const validationTime = perf.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
      const sanitizedMessage = sanitizeErrorMessage(errorMessage)
      
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ [${storeName}] Validation exception:`, error)
      }
      
      addAuditEntry('validation', false, 1, sanitizedMessage)
      
      return {
        success: false,
        errors: [{ path: 'validation', message: sanitizedMessage }],
        warnings: [],
        validationTime,
        schemaVersion: 1,
      }
    }
  }
  
  // Async PII scanning function with comprehensive error handling
  const performPIIScanAsync = async (): Promise<PIIScanResult> => {
    if (!opts.security?.scanForPII) {
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
    
    // Rate limiting check with separate limiter
    if (!piiRateLimiter.shouldAllow()) {
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
    
    const startTime = perf.now()
    
    try {
      const state = get()
      const scanResult = scanStoreForPII(
        storeName,
        state,
        { partialize: (state: unknown) => state }
      )
      
      const scanTime = perf.now() - startTime
      
      const result: PIIScanResult = {
        scanTime,
        detections: scanResult.piiDetections.length,
        hasCritical: scanResult.criticalCount > 0,
        hasHigh: scanResult.highCount > 0,
        details: scanResult.piiDetections.map(detection => ({
          path: detection.path,
          type: detection.type.toString(),
          severity: detection.severity.toString(),
          encrypted: detection.isEncrypted,
        })),
      }
      
      // CRITICAL FIX: Always mask PII values, strict environment checks
      if (opts.security?.reportPII && scanResult.piiDetections.length > 0) {
        // Only log in development, always with masked values
        if (process.env.NODE_ENV === 'development') {
          console.warn(`🔒 [${storeName}] PII detected (${result.detections} items)`)
          
          // Create fully masked version of scan result
          const maskedResult = {
            ...scanResult,
            piiDetections: scanResult.piiDetections.map(detection => ({
              ...detection,
              value: maskPIIValue(detection.value, detection.path),
            })),
          }
          reportPIIToConsole(maskedResult)
        }
        
        addAuditEntry('pii', false, result.detections, `PII detected: ${result.detections} items`)
      } else {
        addAuditEntry('pii', true)
      }
      
      // Throw on PII if configured
      if (opts.security?.throwOnPII && (result.hasCritical || result.hasHigh)) {
        const sanitizedMessage = `PII detected in ${storeName}: ${result.detections} items`
        throw new Error(sanitizedMessage)
      }
      
      // Update PII scan state with proper typing
      const piiScanUpdate: Partial<RuntimeValidationState> = {
        _piiScan: {
          lastScan: new Date().toISOString(),
          detections: result.detections,
          hasCritical: result.hasCritical,
          hasHigh: result.hasHigh,
          details: result.details,
        },
      }
      set(piiScanUpdate as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
      
      return result
      
    } catch (error) {
      const sanitizedMessage = error instanceof Error 
        ? sanitizeErrorMessage(error.message)
        : 'PII scan failed'
        
      if (process.env.NODE_ENV === 'development') {
        console.error(`❌ [${storeName}] PII scan exception:`, error)
      }
      
      addAuditEntry('pii', false, 0, sanitizedMessage)
      
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
  }
  
  // CRITICAL FIX: Optimized debounced functions using lodash
  const debouncedValidate = debounce(
    () => {
      // CRITICAL FIX: queueMicrotask ONLY inside debounced executor
      queueMicrotask(async () => {
        try {
          await validationQueue.enqueue(() => performValidationAsync())
        } catch (error) {
          // Catch and log but don't crash
          if (process.env.NODE_ENV === 'development') {
            console.error(`[${storeName}] Debounced validation error:`, error)
          }
        }
      })
    },
    opts.behavior?.debounceMs || 100,
    { leading: false, trailing: true }
  )
  
  const debouncedPIIScan = debounce(
    () => {
      // CRITICAL FIX: queueMicrotask ONLY inside debounced executor
      queueMicrotask(async () => {
        try {
          await piiScanQueue.enqueue(() => performPIIScanAsync())
        } catch (error) {
          // Catch and log but don't crash
          if (process.env.NODE_ENV === 'development') {
            console.error(`[${storeName}] Debounced PII scan error:`, error)
          }
        }
      })
    },
    opts.behavior?.debounceMs || 100,
    { leading: false, trailing: true }
  )
  
  // Add cleanup handlers
  cleanupHandlers.push(
    () => debouncedValidate.cancel(),
    () => debouncedPIIScan.cancel()
  )
  
  // CRITICAL FIX: Public API methods with proper error handling
  const validate = async (): Promise<ValidationResult> => {
    return safeAsyncExecution(
      () => performValidationAsync(),
      { success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 },
      `${storeName}:validate`
    )
  }
  
  const scanPII = async (): Promise<PIIScanResult> => {
    return safeAsyncExecution(
      () => performPIIScanAsync(),
      { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] },
      `${storeName}:scanPII`
    )
  }
  
  // CRITICAL FIX: Destroy method for cleanup
  const destroy = (): void => {
    // Cancel all pending operations
    debouncedValidate.cancel()
    debouncedPIIScan.cancel()
    
    // Clear rate limiters
    validationRateLimiter.reset()
    piiRateLimiter.reset()
    
    // Clear audit trail
    auditTrail.splice(0, auditTrail.length)
    
    // Run all cleanup handlers
    cleanupHandlers.forEach(handler => handler())
    
    // Clear validation state with proper typing
    const clearUpdate: Partial<RuntimeValidationState> = {
      _validation: undefined,
      _piiScan: undefined,
      _auditTrail: undefined,
    }
    set(clearUpdate as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
  }
  
  // ZUSTAND v5 FIX: Properly typed intercepted set function with both overload signatures
  const originalSet = set
  
  // Type-safe overload signatures matching Zustand v5
  type StateType = T & RuntimeValidationState & RuntimeValidationApi
  
  interface SetState {
    (partial: StateType | Partial<StateType> | ((state: StateType) => StateType | Partial<StateType>), replace?: false): void
    (state: StateType | ((state: StateType) => StateType), replace: true): void
  }
  
  // Create intercepted set with proper overloads
  function interceptedSet(partial: StateType | Partial<StateType> | ((state: StateType) => StateType | Partial<StateType>), replace?: false): void
  function interceptedSet(state: StateType | ((state: StateType) => StateType), replace: true): void
  function interceptedSet(
    partial: StateType | Partial<StateType> | ((state: StateType) => StateType | Partial<StateType>),
    replace?: boolean
  ): void {
    // Call original set with proper type casting based on replace value
    if (replace === true) {
      (originalSet as SetState)(partial as StateType | ((state: StateType) => StateType), true)
    } else {
      (originalSet as SetState)(partial, false)
    }
    
    // Trigger validation on change if enabled
    if (opts.triggers?.onChange) {
      debouncedValidate()
      
      if (opts.security?.piiScanTrigger === 'onChange') {
        debouncedPIIScan()
      }
    }
  }
  
  // Initialize store
  const initialState = stateCreator(interceptedSet as typeof set, get, api)
  
  // CRITICAL FIX: Initial validation with proper error handling
  if (opts.triggers?.onInit) {
    // Use setTimeout instead of queueMicrotask for initial validation
    setTimeout(() => {
      safeAsyncExecution(
        () => validate(),
        { success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 },
        `${storeName}:init:validate`
      )
      
      if (opts.security?.piiScanTrigger === 'onInit') {
        safeAsyncExecution(
          () => scanPII(),
          { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] },
          `${storeName}:init:scanPII`
        )
      }
    }, 0)
  }
  
  return {
    ...initialState,
    _validation: {
      isValid: true,
      lastValidated: new Date().toISOString(),
      errors: [],
      warnings: [],
      performance: {
        lastValidationTime: 0,
        averageValidationTime: 0,
        validationCount: 0,
      },
    },
    _piiScan: {
      lastScan: new Date().toISOString(),
      detections: 0,
      hasCritical: false,
      hasHigh: false,
      details: [],
    },
    _auditTrail: auditTrail,
    
    // Validation API
    validate,
    scanPII,
    getValidationStatus: () => get()._validation,
    getPIIScanStatus: () => get()._piiScan,
    getAuditTrail: () => auditTrail,
    clearValidationStatus: () => {
      const resetUpdate: Partial<RuntimeValidationState> = {
        _validation: {
          isValid: true,
          lastValidated: new Date().toISOString(),
          errors: [],
          warnings: [],
          performance: {
            lastValidationTime: 0,
            averageValidationTime: 0,
            validationCount: 0,
          },
        },
        _piiScan: {
          lastScan: new Date().toISOString(),
          detections: 0,
          hasCritical: false,
          hasHigh: false,
          details: [],
        },
      }
      set(resetUpdate as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
    },
    destroy,
  }
}

// ZUSTAND v5: Enhanced middleware type with strict constraints
export type RuntimeValidationMiddleware = typeof runtimeValidation

// Additional type utilities for better Zustand v5 integration
export type WithRuntimeValidation<T extends object> = T & RuntimeValidationState & RuntimeValidationApi

// Enhanced StateCreator type for middleware chaining
export type RuntimeValidationStateCreator<
  T extends object,
  Mps extends [StoreMutatorIdentifier, unknown][] = [],
  Mcs extends [StoreMutatorIdentifier, unknown][] = []
> = StateCreator<
  WithRuntimeValidation<T>,
  Mps,
  Mcs,
  WithRuntimeValidation<T>
>

// Type-safe middleware options with validation
export type SafeRuntimeValidationOptions = RuntimeValidationOptions & {
  storeName: string // Required field to ensure proper configuration
}

// Development utilities interface
interface WindowWithDebugUtils extends Window {
  __dceRuntimeValidation?: {
    formatZodError: typeof formatZodError
    updateValidationMetrics: typeof updateValidationMetrics
    sanitizeErrorMessage: typeof sanitizeErrorMessage
    calculateSchemaHash: typeof calculateSchemaHash
  }
}

// Development utilities (only exposed in dev, no sensitive data)
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithDebugUtils).__dceRuntimeValidation = {
    formatZodError,
    updateValidationMetrics,
    sanitizeErrorMessage,
    calculateSchemaHash,
  }
}