/**
 * Validation Helper Utilities
 * Provides utilities for runtime validation middleware
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
 */
export function maskPIIValue(value: unknown, path: string): string {
  // Sensitive field patterns
  const sensitivePatterns = [
    /password/i,
    /secret/i,
    /token/i,
    /key/i,
    /ssn/i,
    /social.*security/i,
    /credit.*card/i,
    /phone/i,
    /email/i,
    /address/i,
    /dob|birth.*date/i,
    /name/i,
  ]
  
  // Check if field name matches sensitive patterns
  const isSensitive = sensitivePatterns.some(pattern => pattern.test(path))
  
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