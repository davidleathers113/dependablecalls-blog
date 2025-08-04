/**
 * Runtime Validation Middleware - Phase 3.1b
 * Provides real-time state validation during development
 * Integrates with Zod schemas to catch data integrity issues early
 */

import { type StateCreator, type StoreMutatorIdentifier } from 'zustand'
import { ZodError } from 'zod'
import { 
  validateWithSchema, 
  getLatestSchema, 
  getLatestSchemaVersion
} from '../schemas/index'
import { scanStoreForPII, reportPIIToConsole } from '../piiScanner'
import { 
  deepMerge, 
  maskPIIValue, 
  getPerformance, 
  ValidationQueue, 
  RateLimiter,
  createDebouncedFunction
} from '../validationHelpers'

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
  }
  
  /** Schema validation options */
  schema?: {
    /** Use latest schema version (default: true) */
    useLatestVersion: boolean
    /** Fallback to any version if latest fails (default: false) */
    fallbackToAnyVersion: boolean
    /** Custom schema version to validate against */
    targetVersion?: number
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
  }
  
  /** Performance monitoring */
  performance?: {
    /** Monitor validation performance (default: true) */
    enabled: boolean
    /** Warn on slow validations (default: 100ms) */
    slowValidationThresholdMs: number
    /** Track validation metrics (default: true) */
    trackMetrics: boolean
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
}

export interface ValidationResult {
  success: boolean
  errors: Array<{ path: string; message: string }>
  warnings: Array<{ path: string; message: string }>
  validationTime: number
  schemaVersion: number
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

// Default options
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
  },
  schema: {
    useLatestVersion: true,
    fallbackToAnyVersion: false,
  },
  security: {
    scanForPII: process.env.NODE_ENV === 'development',
    piiScanTrigger: 'onChange',
    reportPII: true,
    throwOnPII: false,
  },
  performance: {
    enabled: true,
    slowValidationThresholdMs: 100,
    trackMetrics: true,
  },
  development: {
    verbose: false,
    includeInDevTools: true,
    autoFix: false,
  },
}

// Get performance instance
const perf = getPerformance()

function formatZodError(error: ZodError): Array<{ path: string; message: string }> {
  return error.errors.map(err => ({
    path: err.path.join('.') || 'root',
    message: err.message,
  }))
}

function updateValidationMetrics(
  current: RuntimeValidationState['_validation'],
  validationTime: number
): RuntimeValidationState['_validation']['performance'] {
  const count = (current?.performance.validationCount || 0) + 1
  const currentAverage = current?.performance.averageValidationTime || 0
  const newAverage = (currentAverage * (count - 1) + validationTime) / count
  
  return {
    lastValidationTime: validationTime,
    averageValidationTime: newAverage,
    validationCount: count,
  }
}

/**
 * Runtime Validation Middleware
 * Provides real-time validation and PII scanning for Zustand stores
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
  options: RuntimeValidationOptions
): StateCreator<
  T & RuntimeValidationState & RuntimeValidationApi,
  Mps,
  Mcs,
  T & RuntimeValidationState & RuntimeValidationApi
> => (set, get, api) => {
  const opts = deepMerge({}, defaultOptions, options)
  const { storeName } = opts
  
  // If validation is disabled, return minimal implementation
  if (!opts.enabled) {
    return {
      ...stateCreator(set, get, api),
      validate: async () => ({ success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 }),
      scanPII: async () => ({ scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }),
      getValidationStatus: () => undefined,
      getPIIScanStatus: () => undefined,
      clearValidationStatus: () => {},
    }
  }
  
  // Validation queue to prevent race conditions
  const validationQueue = new ValidationQueue()
  const piiScanQueue = new ValidationQueue()
  
  // Rate limiter for DoS protection
  const rateLimiter = new RateLimiter(opts.behavior?.debounceMs || 100)
  
  // Memoized debounced functions
  const { debounced: debouncedValidate, cancel: _cancelValidate } = createDebouncedFunction(
    () => validationQueue.enqueue(() => performValidationAsync()),
    opts.behavior?.debounceMs || 100
  )
  
  const { debounced: debouncedPIIScan, cancel: _cancelPIIScan } = createDebouncedFunction(
    () => piiScanQueue.enqueue(() => performPIIScanAsync()),
    opts.behavior?.debounceMs || 100
  )
  
  // Async validation function for non-blocking execution
  const performValidationAsync = async (): Promise<ValidationResult> => {
    // Rate limiting check
    if (!rateLimiter.shouldAllow()) {
      return { success: true, errors: [], warnings: [], validationTime: 0, schemaVersion: 1 }
    }
    
    const startTime = perf.now()
    
    try {
      const state = get()
      const targetVersion = opts.schema?.targetVersion || getLatestSchemaVersion(storeName) || 1
      
      // Get appropriate schema
      let schema = getLatestSchema(storeName)
      if (opts.schema?.targetVersion) {
        // Use specific version if requested
        schema = getLatestSchema(storeName) // TODO: Add version-specific schema retrieval
      }
      
      if (!schema) {
        const warning = {
          path: 'schema',
          message: `No schema found for store ${storeName}`,
        }
        
        if (opts.behavior?.logToConsole) {
          console.warn(`⚠️ [${storeName}] Validation warning:`, warning.message)
        }
        
        return {
          success: false,
          errors: [],
          warnings: [warning],
          validationTime: perf.now() - startTime,
          schemaVersion: targetVersion,
        }
      }
      
      // Perform validation
      const validation = validateWithSchema(storeName, targetVersion, state)
      const validationTime = perf.now() - startTime
      
      let result: ValidationResult
      
      if (validation.success) {
        result = {
          success: true,
          errors: [],
          warnings: [],
          validationTime,
          schemaVersion: targetVersion,
        }
        
        if (opts.development?.verbose) {
          console.log(`✅ [${storeName}] Validation passed (${validationTime.toFixed(2)}ms)`)
        }
      } else {
        // Type assertion: we know validation.success is false, so error property exists
        const validationError = (validation as { success: false; error: ZodError }).error
        const errors = formatZodError(validationError)
        
        result = {
          success: false,
          errors,
          warnings: [],
          validationTime,
          schemaVersion: targetVersion,
        }
        
        if (opts.behavior?.logToConsole) {
          console.error(`❌ [${storeName}] Validation failed:`, errors)
          if (opts.behavior?.includeStackTrace) {
            console.error('Validation error details:', validationError)
          }
        }
        
        if (opts.behavior?.throwOnError) {
          throw new Error(`Validation failed for ${storeName}: ${errors.map(e => e.message).join(', ')}`)
        }
      }
      
      // Performance warning
      if (opts.performance?.enabled && validationTime > (opts.performance?.slowValidationThresholdMs || 100)) {
        console.warn(`🐌 [${storeName}] Slow validation detected: ${validationTime.toFixed(2)}ms`)
      }
      
      // Update validation state
      const currentValidation = get()._validation
      set({
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
        },
      } as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
      
      return result
      
    } catch (error) {
      const validationTime = perf.now() - startTime
      const errorMessage = error instanceof Error ? error.message : 'Unknown validation error'
      
      console.error(`❌ [${storeName}] Validation exception:`, error)
      
      return {
        success: false,
        errors: [{ path: 'validation', message: errorMessage }],
        warnings: [],
        validationTime,
        schemaVersion: 1,
      }
    }
  }
  
  // Async PII scanning function for non-blocking execution
  const performPIIScanAsync = async (): Promise<PIIScanResult> => {
    if (!opts.security?.scanForPII) {
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
    
    // Rate limiting check
    if (!rateLimiter.shouldAllow()) {
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
    
    const startTime = perf.now()
    
    try {
      const state = get()
      const scanResult = scanStoreForPII(
        storeName,
        state,
        { partialize: (state: unknown) => state } // TODO: Get actual partialize function
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
      
      // Report PII if configured (ONLY in development, with masked values)
      if (opts.security?.reportPII && scanResult.piiDetections.length > 0 && process.env.NODE_ENV === 'development') {
        console.warn(`🔒 [${storeName}] PII detected:`)
        // Create masked version of scan result
        const maskedResult = {
          ...scanResult,
          piiDetections: scanResult.piiDetections.map(detection => ({
            ...detection,
            value: maskPIIValue(detection.value, detection.path),
          })),
        }
        reportPIIToConsole(maskedResult)
      }
      
      // Throw on PII if configured
      if (opts.security?.throwOnPII && (result.hasCritical || result.hasHigh)) {
        throw new Error(`PII detected in ${storeName}: ${result.detections} items`)
      }
      
      // Update PII scan state
      set({
        _piiScan: {
          lastScan: new Date().toISOString(),
          detections: result.detections,
          hasCritical: result.hasCritical,
          hasHigh: result.hasHigh,
          details: result.details,
        },
      } as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
      
      return result
      
    } catch (error) {
      console.error(`❌ [${storeName}] PII scan exception:`, error)
      return { scanTime: 0, detections: 0, hasCritical: false, hasHigh: false, details: [] }
    }
  }
  
  // Public validation API methods that use queueMicrotask for non-blocking execution
  const validate = async (): Promise<ValidationResult> => {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        validationQueue.enqueue(() => performValidationAsync()).then(resolve)
      })
    })
  }
  
  const scanPII = async (): Promise<PIIScanResult> => {
    return new Promise((resolve) => {
      queueMicrotask(() => {
        piiScanQueue.enqueue(() => performPIIScanAsync()).then(resolve)
      })
    })
  }
  
  // Intercept state changes for validation
  const originalSet = set
  const interceptedSet = (
    partial: 
      | (T & RuntimeValidationState & RuntimeValidationApi)
      | Partial<T & RuntimeValidationState & RuntimeValidationApi>
      | ((state: T & RuntimeValidationState & RuntimeValidationApi) => 
          | (T & RuntimeValidationState & RuntimeValidationApi)
          | Partial<T & RuntimeValidationState & RuntimeValidationApi>),
    replace?: boolean | undefined
  ) => {
    originalSet(partial, replace)
    
    // Trigger validation on change if enabled
    if (opts.triggers?.onChange) {
      debouncedValidate()
      
      if (opts.security?.piiScanTrigger === 'onChange') {
        debouncedPIIScan()
      }
    }
  }
  
  // Initialize store
  const initialState = stateCreator(interceptedSet, get, api)
  
  // Initial validation and PII scan (non-blocking)
  if (opts.triggers?.onInit) {
    queueMicrotask(() => {
      validate()
      
      if (opts.security?.piiScanTrigger === 'onInit') {
        scanPII()
      }
    })
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
    
    // Validation API
    validate,
    scanPII,
    getValidationStatus: () => get()._validation,
    getPIIScanStatus: () => get()._piiScan,
    clearValidationStatus: () => {
      set({
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
      } as Partial<T & RuntimeValidationState & RuntimeValidationApi>)
    },
  }
}

// Export type for store creators
export type RuntimeValidationMiddleware = typeof runtimeValidation

// Development utilities interface
interface WindowWithDebugUtils extends Window {
  __dceRuntimeValidation?: {
    formatZodError: typeof formatZodError
    updateValidationMetrics: typeof updateValidationMetrics
  }
}

// Development utilities
if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
  (window as WindowWithDebugUtils).__dceRuntimeValidation = {
    formatZodError,
    updateValidationMetrics,
  }
}