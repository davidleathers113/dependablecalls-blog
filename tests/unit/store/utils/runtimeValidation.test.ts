/**
 * Runtime Validation Middleware Tests
 * Tests all critical fixes and improvements
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { create } from 'zustand'
import { runtimeValidation } from '../../../../src/store/utils/middleware/runtimeValidation'
import { 
  deepMerge, 
  maskPIIValue, 
  ValidationQueue, 
  RateLimiter,
  createDebouncedFunction 
} from '../../../../src/store/utils/validationHelpers'
import { z } from 'zod'

// Mock schemas module
vi.mock('../../../../src/store/utils/schemas', () => ({
  validateWithSchema: vi.fn(),
  getLatestSchema: vi.fn(),
  getLatestSchemaVersion: vi.fn(),
  registerSchema: vi.fn(),
}))

// Mock PII scanner
vi.mock('../../../../src/store/utils/piiScanner', () => ({
  scanStoreForPII: vi.fn(),
  reportPIIToConsole: vi.fn(),
}))

describe('Runtime Validation Middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
  })
  
  afterEach(() => {
    vi.useRealTimers()
  })

  describe('Deep Merge Fix', () => {
    it('should properly deep merge nested options', () => {
      const defaultOptions = {
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
      }
      
      const userOptions = {
        triggers: {
          onChange: false, // Only override this
        },
        behavior: {
          debounceMs: 200, // Only override this
        },
      }
      
      const merged = deepMerge({}, defaultOptions, userOptions)
      
      // Verify nested properties are preserved
      expect(merged.triggers.onChange).toBe(false)
      expect(merged.triggers.onInit).toBe(true) // Should be preserved
      expect(merged.triggers.beforePersist).toBe(true) // Should be preserved
      expect(merged.triggers.afterRehydrate).toBe(true) // Should be preserved
      
      expect(merged.behavior.debounceMs).toBe(200)
      expect(merged.behavior.throwOnError).toBe(false) // Should be preserved
      expect(merged.behavior.logToConsole).toBe(true) // Should be preserved
      expect(merged.behavior.includeStackTrace).toBe(false) // Should be preserved
    })
    
    it('should handle deeply nested objects', () => {
      const target = {
        a: {
          b: {
            c: 1,
            d: 2,
          },
          e: 3,
        },
      }
      
      const source = {
        a: {
          b: {
            c: 10, // Override only this
          },
        },
      }
      
      const merged = deepMerge({}, target, source)
      
      expect(merged.a.b.c).toBe(10)
      expect(merged.a.b.d).toBe(2) // Preserved
      expect(merged.a.e).toBe(3) // Preserved
    })
  })

  describe('Async Validation (Non-blocking)', () => {
    it('should not block the event loop during validation', async () => {
      const mockValidation = vi.fn().mockResolvedValue({ success: true })
      const { validateWithSchema } = await import('../../../../src/store/utils/schemas')
      ;(validateWithSchema as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(() => {
        // Simulate heavy computation
        const start = Date.now()
        while (Date.now() - start < 50) {
          // Simulate heavy computation - intentionally blocking for 50ms
        }
        return mockValidation()
      })
      
      interface TestState {
        value: number
        setValue: (value: number) => void
      }
      
      const useStore = create<TestState>()(
        runtimeValidation(
          (set) => ({
            value: 0,
            setValue: (value) => set({ value }),
          }),
          { storeName: 'testStore', enabled: true }
        )
      )
      
      const startTime = Date.now()
      const { validate } = useStore.getState()
      
      // Start validation (should be non-blocking)
      const validationPromise = validate()
      
      // This should execute immediately, not after 50ms
      const immediateTime = Date.now()
      expect(immediateTime - startTime).toBeLessThan(10)
      
      // Wait for validation to complete
      await validationPromise
    })
    
    it('should use queueMicrotask for async execution', async () => {
      const queueMicrotaskSpy = vi.spyOn(globalThis, 'queueMicrotask')
      
      interface TestState {
        value: number
      }
      
      const useStore = create<TestState>()(
        runtimeValidation(
          () => ({ value: 0 }),
          { storeName: 'testStore', enabled: true }
        )
      )
      
      const { validate } = useStore.getState()
      await validate()
      
      expect(queueMicrotaskSpy).toHaveBeenCalled()
    })
  })

  describe('Validation Queue (Race Condition Fix)', () => {
    it('should process validations sequentially without race conditions', async () => {
      const queue = new ValidationQueue()
      const results: number[] = []
      
      // Enqueue multiple async operations
      const promises = [
        queue.enqueue(async () => {
          await new Promise(resolve => setTimeout(resolve, 30))
          results.push(1)
          return 1
        }),
        queue.enqueue(async () => {
          await new Promise(resolve => setTimeout(resolve, 20))
          results.push(2)
          return 2
        }),
        queue.enqueue(async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          results.push(3)
          return 3
        }),
      ]
      
      // Advance all timers and wait for promises
      vi.runAllTimersAsync()
      const values = await Promise.all(promises)
      
      // Results should be in order despite different delays
      expect(results).toEqual([1, 2, 3])
      expect(values).toEqual([1, 2, 3])
    }, 10000)
    
    it('should handle errors without breaking the queue', async () => {
      const queue = new ValidationQueue()
      const results: string[] = []
      
      const promise1 = queue.enqueue(async () => {
        results.push('start1')
        throw new Error('Test error')
      })
      
      const promise2 = queue.enqueue(async () => {
        results.push('start2')
        return 'success'
      })
      
      await expect(promise1).rejects.toThrow('Test error')
      expect(await promise2).toBe('success')
      expect(results).toEqual(['start1', 'start2'])
    })
  })

  describe('PII Masking (Security Fix)', () => {
    it('should mask sensitive PII values', () => {
      expect(maskPIIValue('password123', 'user.password')).toBe('pa*******23')
      expect(maskPIIValue('secret-key-value', 'apiKey')).toBe('se************ue')
      expect(maskPIIValue('123-45-6789', 'ssn')).toBe('12*******89')
      expect(maskPIIValue('john@example.com', 'email')).toBe('jo************om')
      expect(maskPIIValue('+1234567890', 'phone')).toBe('+1*******90')
    })
    
    it('should not mask non-sensitive fields', () => {
      expect(maskPIIValue('regular-value', 'status')).toBe('regular-value')
      expect(maskPIIValue('12345', 'count')).toBe('12345')
    })
    
    it('should handle short values', () => {
      expect(maskPIIValue('abc', 'password')).toBe('****')
      expect(maskPIIValue('1234', 'ssn')).toBe('****')
    })
    
    it('should only log PII in development mode', async () => {
      const originalEnv = process.env.NODE_ENV
      const { scanStoreForPII } = await import('../../../../src/store/utils/piiScanner')
      
      ;(scanStoreForPII as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue({
        piiDetections: [{
          path: 'user.password',
          type: 'password',
          severity: 'high',
          value: 'secret123',
          isEncrypted: false,
        }],
        criticalCount: 0,
        highCount: 1,
      })
      
      // Test production mode - should not log
      process.env.NODE_ENV = 'production'
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation()
      
      interface TestState {
        user: { password: string }
      }
      
      const useStore = create<TestState>()(
        runtimeValidation(
          () => ({ user: { password: 'secret123' } }),
          { 
            storeName: 'testStore',
            enabled: true,
            security: { scanForPII: true, reportPII: true }
          }
        )
      )
      
      const { scanPII } = useStore.getState()
      await scanPII()
      
      expect(consoleSpy).not.toHaveBeenCalled()
      
      // Restore
      process.env.NODE_ENV = originalEnv
      consoleSpy.mockRestore()
    })
  })

  describe('Rate Limiting (DoS Protection)', () => {
    it('should prevent rapid validation requests', () => {
      const limiter = new RateLimiter(100) // 100ms minimum interval
      
      expect(limiter.shouldAllow()).toBe(true)
      expect(limiter.shouldAllow()).toBe(false) // Too soon
      
      // Advance time
      vi.advanceTimersByTime(101)
      expect(limiter.shouldAllow()).toBe(true)
    })
    
    it('should reset rate limiter', () => {
      const limiter = new RateLimiter(100)
      
      limiter.shouldAllow()
      expect(limiter.shouldAllow()).toBe(false)
      
      limiter.reset()
      expect(limiter.shouldAllow()).toBe(true)
    })
  })

  describe('Debounced Functions (Memoization)', () => {
    it('should memoize debounced functions', () => {
      const fn = vi.fn()
      const { debounced } = createDebouncedFunction(fn, 100)
      
      // Call multiple times rapidly
      debounced()
      debounced()
      debounced()
      
      // Function not called yet
      expect(fn).not.toHaveBeenCalled()
      
      // Advance time
      vi.advanceTimersByTime(101)
      
      // Function called only once
      expect(fn).toHaveBeenCalledTimes(1)
    })
    
    it('should support cancellation', () => {
      const fn = vi.fn()
      const { debounced, cancel } = createDebouncedFunction(fn, 100)
      
      debounced()
      cancel()
      
      vi.advanceTimersByTime(101)
      
      // Function should not be called
      expect(fn).not.toHaveBeenCalled()
    })
  })

  describe('Performance Polyfill', () => {
    it('should provide performance.now() fallback', async () => {
      const { getPerformance } = await import('../../../../src/store/utils/validationHelpers')
      const perf = getPerformance()
      
      expect(typeof perf.now).toBe('function')
      expect(typeof perf.now()).toBe('number')
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete validation flow without errors', async () => {
      const testSchema = z.object({
        id: z.string(),
        value: z.number(),
      })
      
      const { getLatestSchema, getLatestSchemaVersion, validateWithSchema } = await import('../../../../src/store/utils/schemas')
      ;(getLatestSchema as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(testSchema)
      ;(getLatestSchemaVersion as unknown as { mockReturnValue: (value: unknown) => void }).mockReturnValue(1)
      ;(validateWithSchema as unknown as { mockImplementation: (fn: (storeName: string, version: number, data: unknown) => unknown) => void }).mockImplementation((storeName, version, data) => {
        const result = testSchema.safeParse(data)
        return result
      })
      
      interface TestState {
        id: string
        value: number
        setValue: (value: number) => void
      }
      
      const useStore = create<TestState>()(
        runtimeValidation(
          (set) => ({
            id: 'test',
            value: 0,
            setValue: (value) => set({ value }),
          }),
          { 
            storeName: 'testStore',
            enabled: true,
            triggers: { onChange: true },
          }
        )
      )
      
      const { setValue, validate } = useStore.getState()
      
      // Change state
      setValue(42)
      
      // Wait for debounced validation
      vi.advanceTimersByTime(101)
      
      // Manual validation
      const result = await validate()
      
      expect(result.success).toBe(true)
      expect(result.errors).toEqual([])
    })
  })
})