/**
 * Tests for DCE Recovery System
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  RecoveryManager,
  createRetryableOperation,
  isRetryableError,
  calculateNextRetryDelay,
} from '../recovery'
import { createError } from '../errorTypes'
import { ErrorHandlingConfig, ErrorHandlingContext } from '../../middleware/errorHandling'
import { ErrorReporter } from '../reporting'

// Mock timers
vi.useFakeTimers()

describe('Recovery System', () => {
  let recoveryManager: RecoveryManager
  let mockConfig: ErrorHandlingConfig
  let mockContext: ErrorHandlingContext

  beforeEach(() => {
    mockConfig = {
      storeName: 'test-store',
      enableRecovery: true,
      enableReporting: true,
      maxRecoveryAttempts: 3,
      recoveryTimeout: 5000,
    }

    mockContext = {
      storeName: 'test-store',
      actionName: 'testAction',
      attempt: 1,
      recoveryManager: null as unknown as RecoveryManager,
      reporter: null as unknown as ErrorReporter,
    }

    recoveryManager = new RecoveryManager(mockConfig)
  })

  afterEach(() => {
    vi.clearAllTimers()
    vi.clearAllMocks()
  })

  describe('RecoveryManager', () => {
    it('should recover retryable errors', async () => {
      const networkError = createError.network('Timeout', 408)
      const recovered = await recoveryManager.recover(networkError, mockContext)
      
      expect(recovered).toBe(true)
    })

    it('should not recover non-recoverable errors', async () => {
      const validationError = createError.validation('Invalid email', 'email')
      const recovered = await recoveryManager.recover(validationError, mockContext)
      
      expect(recovered).toBe(false)
    })

    it('should respect circuit breaker', async () => {
      const networkError = createError.network('Server error', 500)
      
      // Trigger multiple failures to open circuit breaker
      for (let i = 0; i < 6; i++) {
        try {
          await recoveryManager.recover(networkError, { ...mockContext, attempt: i + 1 })
        } catch (_error) { // eslint-disable-line @typescript-eslint/no-unused-vars
          // Expected to fail
        }
      }
      
      // Circuit should now be open
      const recovered = await recoveryManager.recover(networkError, mockContext)
      expect(recovered).toBe(false)
    })

    it('should execute retryable operation with success', async () => {
      let attempts = 0
      const operation = createRetryableOperation(
        async () => {
          attempts++
          if (attempts < 2) {
            throw new Error('Temporary failure')
          }
          return 'success'
        },
        { storeName: 'test-store', actionType: 'testAction' }
      )

      const result = await recoveryManager.executeWithRetry(operation)
      expect(result).toBe('success')
      expect(attempts).toBe(2)
    })

    it('should fail after max attempts', async () => {
      const operation = createRetryableOperation(
        async () => {
          throw new Error('Persistent failure')
        },
        { storeName: 'test-store', actionType: 'testAction' }
      )

      await expect(recoveryManager.executeWithRetry(operation)).rejects.toThrow('Persistent failure')
    })

    it('should use custom retry predicate', async () => {
      let attempts = 0
      const operation = createRetryableOperation(
        async () => {
          attempts++
          throw new Error('Custom error')
        },
        { storeName: 'test-store', actionType: 'testAction' },
        {
          shouldRetry: (error, attempt) => attempt < 2, // Only retry once
        }
      )

      await expect(recoveryManager.executeWithRetry(operation)).rejects.toThrow('Custom error')
      expect(attempts).toBe(2) // Initial attempt + 1 retry
    })

    it('should handle timeout', async () => {
      const operation = createRetryableOperation(
        async () => {
          // Simulate long-running operation
          await new Promise(resolve => setTimeout(resolve, 10000))
          return 'success'
        },
        { storeName: 'test-store', actionType: 'testAction' }
      )

      const promise = recoveryManager.executeWithRetry(operation)
      
      // Fast-forward past timeout
      vi.advanceTimersByTime(6000)
      
      await expect(promise).rejects.toThrow('timed out')
    })
  })

  describe('Utility Functions', () => {
    describe('isRetryableError', () => {
      it('should identify retryable errors', () => {
        expect(isRetryableError(new Error('Network timeout'))).toBe(true)
        expect(isRetryableError(new Error('Server error 500'))).toBe(true)
        expect(isRetryableError(new Error('Rate limit exceeded'))).toBe(true)
        expect(isRetryableError(new Error('Connection failed'))).toBe(true)
      })

      it('should identify non-retryable errors', () => {
        expect(isRetryableError(new Error('Validation failed'))).toBe(false)
        expect(isRetryableError(new Error('Not found'))).toBe(false)
        expect(isRetryableError(new Error('Unauthorized'))).toBe(false)
      })
    })

    describe('calculateNextRetryDelay', () => {
      it('should calculate exponential backoff', () => {
        expect(calculateNextRetryDelay(1, 1000, 30000, 2, false)).toBe(1000)
        expect(calculateNextRetryDelay(2, 1000, 30000, 2, false)).toBe(2000)
        expect(calculateNextRetryDelay(3, 1000, 30000, 2, false)).toBe(4000)
        expect(calculateNextRetryDelay(4, 1000, 30000, 2, false)).toBe(8000)
      })

      it('should respect max delay', () => {
        const delay = calculateNextRetryDelay(10, 1000, 5000, 2, false)
        expect(delay).toBe(5000)
      })

      it('should add jitter when enabled', () => {
        const delay1 = calculateNextRetryDelay(1, 1000, 30000, 2, true)
        const delay2 = calculateNextRetryDelay(1, 1000, 30000, 2, true)
        
        // With jitter, delays should be different (very high probability)
        expect(delay1).not.toBe(delay2)
        expect(delay1).toBeGreaterThanOrEqual(1000)
        expect(delay1).toBeLessThanOrEqual(1250) // Base + 25% jitter
      })
    })
  })

  describe('Recovery Strategies', () => {
    it('should handle retry strategy', async () => {
      const networkError = createError.network('Server error', 500, '/api/test', 'GET')
      const recovered = await recoveryManager.recover(networkError, mockContext)
      
      expect(recovered).toBe(true)
    })

    it('should handle fallback strategy', async () => {
      const dataError = createError.data('Data processing failed', 'user', 'parse')
      
      // Mock window events
      const mockDispatchEvent = vi.fn()
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      })

      const recovered = await recoveryManager.recover(dataError, mockContext)
      
      expect(recovered).toBe(true)
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dce:error',
          detail: expect.objectContaining({
            message: expect.stringContaining('Data processing error'),
            type: 'error',
          }),
        })
      )
    })

    it('should handle authentication redirect strategy', async () => {
      const authError = createError.authentication('Session expired')
      
      const mockDispatchEvent = vi.fn()
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      })

      const recovered = await recoveryManager.recover(authError, mockContext)
      
      expect(recovered).toBe(true)
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dce:auth:signout',
        })
      )
    })

    it('should handle validation strategy', async () => {
      const validationError = createError.validation('Email is required', 'email', 'required')
      
      const mockDispatchEvent = vi.fn()
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      })

      const recovered = await recoveryManager.recover(validationError, mockContext)
      
      expect(recovered).toBe(true)
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dce:validation:field-error',
          detail: expect.objectContaining({
            message: 'Email is required',
            field: 'email',
          }),
        })
      )
    })

    it('should handle state recovery strategy', async () => {
      const stateError = createError.state('State corruption', 'authStore', 'signIn')
      
      const mockDispatchEvent = vi.fn()
      Object.defineProperty(window, 'dispatchEvent', {
        value: mockDispatchEvent,
        writable: true,
      })

      const recovered = await recoveryManager.recover(stateError, mockContext)
      
      expect(recovered).toBe(true)
      expect(mockDispatchEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'dce:store:reset',
          detail: expect.objectContaining({
            storeName: 'authStore',
          }),
        })
      )
    })
  })

  describe('Circuit Breaker', () => {
    it('should track failures and open circuit', async () => {
      const error = createError.network('Server error', 500)
      
      // Trigger 5 failures (threshold)
      for (let i = 0; i < 5; i++) {
        try {
          await recoveryManager.recover(error, { ...mockContext, attempt: i + 1 })
        } catch (_e) { // eslint-disable-line @typescript-eslint/no-unused-vars
          // Expected
        }
      }
      
      // Circuit should now be open - next recovery should fail immediately
      const recovered = await recoveryManager.recover(error, mockContext)
      expect(recovered).toBe(false)
    })

    it('should reset circuit on success', async () => {
      const error = createError.network('Server error', 500)
      
      // Trigger failures
      for (let i = 0; i < 3; i++) {
        try {
          await recoveryManager.recover(error, { ...mockContext, attempt: i + 1 })
        } catch (_e) { // eslint-disable-line @typescript-eslint/no-unused-vars
          // Expected
        }
      }
      
      // Simulate successful recovery
      const recovered = await recoveryManager.recover(error, mockContext)
      expect(recovered).toBe(true)
      
      // Circuit should be reset - further attempts should work
      const recovered2 = await recoveryManager.recover(error, mockContext)
      expect(recovered2).toBe(true)
    })
  })
})