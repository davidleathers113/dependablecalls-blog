/**
 * Validation Helper Utilities
 * Provides utilities for runtime validation middleware
 * 
 * PERFORMANCE: Uses native APIs when available
 * SECURITY: No regex patterns, proper data sanitization
 */

/**
 * Deep merge utility for configuration objects
 * Properly merges nested objects without overwriting
 */
export function deepMerge<T extends object>(
  target: T,
  ...sources: Partial<T>[]
): T {
  if (!sources.length) return target
  
  const result = { ...target }
  
  for (const source of sources) {
    if (!source) continue
    
    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const sourceValue = source[key]
        const targetValue = result[key]
        
        if (
          sourceValue !== null &&
          typeof sourceValue === 'object' &&
          !Array.isArray(sourceValue) &&
          targetValue !== null &&
          typeof targetValue === 'object' &&
          !Array.isArray(targetValue)
        ) {
          // Recursively merge nested objects
          result[key] = deepMerge(targetValue as Record<string, unknown>, sourceValue as Record<string, unknown>) as T[Extract<keyof T, string>]
        } else {
          // Direct assignment for primitives and arrays
          result[key] = sourceValue as T[Extract<keyof T, string>]
        }
      }
    }
  }
  
  return result
}

/**
 * Mask sensitive PII data for safe logging
 * Replaces values with asterisks while preserving structure
 * SECURITY: Always masks regardless of environment
 */
export function maskPIIValue(value: unknown, path: string): string {
  // Sensitive field keywords (NO REGEX - uses simple string matching)
  const sensitiveKeywords = [
    'password',
    'secret',
    'token',
    'key',
    'ssn',
    'social',
    'security',
    'credit',
    'card',
    'phone',
    'email',
    'address',
    'dob',
    'birth',
    'date',
    'name',
    'api',
    'auth',
    'bearer',
    'private'
  ]
  
  // Check if field name contains sensitive keywords (case-insensitive)
  const pathLower = path.toLowerCase()
  const isSensitive = sensitiveKeywords.some(keyword => pathLower.includes(keyword))
  
  if (!isSensitive) {
    return String(value)
  }
  
  // Mask based on value type
  if (typeof value === 'string') {
    if (value.length <= 4) return '****'
    return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2)
  }
  
  if (typeof value === 'number') {
    const str = String(value)
    if (str.length <= 4) return '****'
    return str.substring(0, 1) + '*'.repeat(str.length - 2) + str.substring(str.length - 1)
  }
  
  return '****'
}

/**
 * Performance polyfill for Node.js environments
 * Ensures performance.now() is available
 */
let cachedPerformance: Performance | undefined

export const getPerformance = (): Performance => {
  if (cachedPerformance) {
    return cachedPerformance
  }

  if (typeof globalThis !== 'undefined' && globalThis.performance) {
    cachedPerformance = globalThis.performance
    return cachedPerformance
  }
  
  if (typeof window !== 'undefined' && window.performance) {
    cachedPerformance = window.performance
    return cachedPerformance
  }
  
  // Ultimate fallback - just use Date.now()
  cachedPerformance = {
    now: () => Date.now(),
  } as unknown as Performance
  
  return cachedPerformance
}

/**
 * Validation queue for managing async validations
 * Ensures validations run sequentially without overlap
 */
export class ValidationQueue {
  private queue: Promise<void> = Promise.resolve()
  
  /**
   * Add a validation task to the queue
   */
  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    const result = await new Promise<T>((resolve, reject) => {
      this.queue = this.queue
        .then(async () => {
          try {
            const value = await task()
            resolve(value)
          } catch (error) {
            reject(error)
          }
        })
        .catch(() => {
          // Ignore previous errors, continue queue
        })
    })
    
    return result
  }
  
  /**
   * Wait for all queued validations to complete
   */
  async waitForAll(): Promise<void> {
    await this.queue
  }
}

/**
 * Rate limiter for validation operations
 * Prevents validation flooding attacks
 */
export class RateLimiter {
  private lastExecution = 0
  private readonly minInterval: number
  
  constructor(minIntervalMs: number) {
    this.minInterval = minIntervalMs
  }
  
  /**
   * Check if operation should be allowed
   */
  shouldAllow(): boolean {
    const now = Date.now()
    if (now - this.lastExecution < this.minInterval) {
      return false
    }
    this.lastExecution = now
    return true
  }
  
  /**
   * Reset the rate limiter
   */
  reset(): void {
    this.lastExecution = 0
  }
}

/**
 * Create a memoized debounce function
 * Prevents recreation on each instantiation
 */
/**
 * Create a memoized debounce function
 * Prevents recreation on each instantiation
 * @deprecated Use lodash.debounce instead for better edge case handling
 */
export function createDebouncedFunction<T extends (...args: readonly unknown[]) => unknown>(
  fn: T,
  delay: number
): { debounced: (...args: Parameters<T>) => void; cancel: () => void } {
  let timeoutId: NodeJS.Timeout | undefined
  
  const debounced = (...args: Parameters<T>): void => {
    clearTimeout(timeoutId)
    timeoutId = setTimeout(() => fn(...args), delay)
  }
  
  const cancel = (): void => {
    clearTimeout(timeoutId)
  }
  
  return { debounced, cancel }
}

/**
 * Create a structured clone of an object
 * Uses native structuredClone when available, falls back to JSON parse/stringify
 * PERFORMANCE: Native API is much faster than deep merge
 */
export function createStructuredClone<T>(obj: T): T | undefined {
  try {
    // Use native structuredClone if available (Node 17+, modern browsers)
    if (typeof globalThis !== 'undefined' && 'structuredClone' in globalThis) {
      return globalThis.structuredClone(obj)
    }
    
    // Fallback to JSON parse/stringify for simple objects
    // Note: This won't preserve functions, undefined, symbols, dates as Date objects, etc.
    return JSON.parse(JSON.stringify(obj))
  } catch (_error) {
    // If cloning fails, return undefined to trigger fallback to deepMerge
    return undefined
  }
}

/**
 * PIIScanQueue - Specialized queue for PII scanning operations
 * Extends ValidationQueue with PII-specific functionality
 */
export class PIIScanQueue extends ValidationQueue {
  private scanCount = 0
  private readonly maxScansPerMinute = 60
  private lastResetTime = Date.now()
  
  /**
   * Add a PII scan task to the queue with rate limiting
   */
  async enqueue<T>(task: () => Promise<T>): Promise<T> {
    // Reset counter every minute
    const now = Date.now()
    if (now - this.lastResetTime > 60000) {
      this.scanCount = 0
      this.lastResetTime = now
    }
    
    // Enforce rate limit
    if (this.scanCount >= this.maxScansPerMinute) {
      throw new Error('PII scan rate limit exceeded')
    }
    
    this.scanCount++
    return super.enqueue(task)
  }
  
  /**
   * Get current scan statistics
   */
  getStats(): { scanCount: number; timeUntilReset: number } {
    const now = Date.now()
    const timeUntilReset = Math.max(0, 60000 - (now - this.lastResetTime))
    return { scanCount: this.scanCount, timeUntilReset }
  }
}