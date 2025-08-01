/**
 * Tests for DCE Error Reporting System
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  ErrorReporter,
  reportError,
  setGlobalErrorReporter,
  getGlobalErrorReporter,
  DEFAULT_ERROR_FILTERS,
  DEFAULT_ERROR_TRANSFORMERS,
} from '../reporting'
import { createError, NetworkError, ValidationError } from '../errorTypes'
import { ErrorHandlingConfig, ErrorHandlingContext } from '../../middleware/errorHandling'

// Mock fetch
global.fetch = vi.fn()

describe('Error Reporting System', () => {
  let errorReporter: ErrorReporter
  let mockConfig: ErrorHandlingConfig
  let mockContext: ErrorHandlingContext

  beforeEach(() => {
    mockConfig = {
      storeName: 'test-store',
      enableRecovery: true,
      enableReporting: true,
      maxRecoveryAttempts: 3,
      development: {
        logErrors: false, // Disable console logging in tests
        logRecovery: false,
        breakOnErrors: false,
      },
    }

    mockContext = {
      storeName: 'test-store',
      actionName: 'testAction',
      attempt: 1,
      recoveryManager: null as any,
      reporter: null as any,
    }

    errorReporter = new ErrorReporter(mockConfig)
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('ErrorReporter', () => {
    it('should report error and cache it', async () => {
      const networkError = createError.network('Connection failed', 500, '/api/test', 'GET')
      
      await errorReporter.report(networkError, mockContext)
      
      const report = await errorReporter.generateReport()
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].message).toBe('Connection failed')
      expect(report.errors[0].context.storeName).toBe('test-store')
    })

    it('should deduplicate identical errors', async () => {
      const error1 = createError.network('Connection failed', 500, '/api/test', 'GET')
      const error2 = createError.network('Connection failed', 500, '/api/test', 'GET')
      
      await errorReporter.report(error1, mockContext)
      await errorReporter.report(error2, mockContext)
      
      const report = await errorReporter.generateReport()
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].context.occurrenceCount).toBe(2)
    })

    it('should apply custom filters', async () => {
      const config = {
        ...mockConfig,
        customFilters: [{
          name: 'excludeValidation',
          predicate: (error: any) => !error.message.includes('validation'),
        }],
      }
      
      const reporter = new ErrorReporter(config)
      const validationError = createError.validation('Validation failed', 'email')
      const networkError = createError.network('Network failed', 500)
      
      await reporter.report(validationError, mockContext)
      await reporter.report(networkError, mockContext)
      
      const report = await reporter.generateReport()
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].message).toBe('Network failed')
    })

    it('should apply sample rate', async () => {
      const config = {
        ...mockConfig,
        sampleRate: 0, // Never sample
      }
      
      const reporter = new ErrorReporter(config)
      const error = createError.network('Test error', 500)
      
      await reporter.report(error, mockContext)
      
      const report = await reporter.generateReport()
      expect(report.errors).toHaveLength(0)
    })

    it('should process batch when size reached', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response('', { status: 200 }))
      
      const config = {
        ...mockConfig,
        batchSize: 2,
        endpoints: { webhook: 'https://example.com/webhook' },
      }
      
      const reporter = new ErrorReporter(config)
      
      const error1 = createError.network('Error 1', 500)
      const error2 = createError.network('Error 2', 500)
      
      await reporter.report(error1, mockContext)
      await reporter.report(error2, mockContext)
      
      // Wait for batch processing
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/webhook',
          expect.objectContaining({
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
          })
        )
      })
    })

    it('should generate comprehensive report', async () => {
      const errors = [
        createError.network('Network error 1', 500, '/api/test', 'GET'),
        createError.network('Network error 2', 404, '/api/test', 'GET'),
        createError.validation('Validation error', 'email', 'required'),
        createError.authentication('Auth error'),
      ]

      for (const error of errors) {
        await errorReporter.report(error, mockContext)
      }

      const report = await errorReporter.generateReport()
      
      expect(report.summary.total).toBe(4)
      expect(report.summary.byType.network).toBe(2)
      expect(report.summary.byType.validation).toBe(1)
      expect(report.summary.byType.authentication).toBe(1)
      expect(report.summary.bySeverity.high).toBe(3) // 1 server error + 1 auth + 1 validation  
      expect(report.summary.bySeverity.medium).toBe(1) // 1 404 error
      expect(report.summary.byStore['test-store']).toBe(4)
    })

    it('should analyze trends', async () => {
      const now = Date.now()
      const errors = [
        { ...createError.network('Error 1', 500), timestamp: now - 1000 },
        { ...createError.network('Error 2', 500), timestamp: now - 2000 },
        { ...createError.validation('Error 3', 'field'), timestamp: now - 3000 },
      ]

      for (const error of errors) {
        await errorReporter.report(error, mockContext)
      }

      const report = await errorReporter.generateReport()
      
      expect(report.trends.hourly).toHaveLength(24)
      expect(report.trends.daily).toHaveLength(7)
      expect(report.trends.weekly).toHaveLength(4)
      expect(report.trends.topErrors).toHaveLength(3)
    })

    it('should analyze user impact', async () => {
      const contextWithUser = {
        ...mockContext,
        userId: 'user123',
      }

      const error = createError.authentication('Auth failed')
      await errorReporter.report(error, contextWithUser)

      const report = await errorReporter.generateReport()
      
      expect(report.userImpact.affectedUsers).toBe(1)
      expect(report.userImpact.criticalPathsAffected).toContain('testAction')
    })

    it('should send to webhook endpoint', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockResolvedValue(new Response('', { status: 200 }))
      
      const config = {
        ...mockConfig,
        batchSize: 1,
        endpoints: { webhook: 'https://example.com/webhook' },
      }
      
      const reporter = new ErrorReporter(config)
      const error = createError.network('Test error', 500)
      
      await reporter.report(error, mockContext)
      
      await vi.waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          'https://example.com/webhook',
          expect.objectContaining({
            method: 'POST',
            body: expect.stringContaining('Test error'),
          })
        )
      })
    })

    it('should handle webhook failures gracefully', async () => {
      const mockFetch = vi.mocked(fetch)
      mockFetch.mockRejectedValue(new Error('Network error'))
      
      const config = {
        ...mockConfig,
        batchSize: 1,
        endpoints: { webhook: 'https://example.com/webhook' },
      }
      
      const reporter = new ErrorReporter(config)
      const error = createError.network('Test error', 500)
      
      // Should not throw
      await expect(reporter.report(error, mockContext)).resolves.toBeUndefined()
    })

    it('should integrate with Sentry when available', async () => {
      const mockSentry = {
        captureException: vi.fn(),
      }
      
      Object.defineProperty(window, 'Sentry', {
        value: mockSentry,
        writable: true,
      })
      
      const config = {
        ...mockConfig,
        batchSize: 1,
        sentryDsn: 'https://example.com/sentry',
      }
      
      const reporter = new ErrorReporter(config)
      const error = createError.network('Test error', 500)
      
      await reporter.report(error, mockContext)
      
      await vi.waitFor(() => {
        expect(mockSentry.captureException).toHaveBeenCalledWith(
          expect.any(Error),
          expect.objectContaining({
            tags: expect.objectContaining({
              storeName: 'test-store',
              errorType: 'network',
              severity: 'high',
            }),
          })
        )
      })
    })
  })

  describe('Global Error Reporting', () => {
    it('should set and get global reporter', () => {
      expect(getGlobalErrorReporter()).toBeNull()
      
      setGlobalErrorReporter(errorReporter)
      expect(getGlobalErrorReporter()).toBe(errorReporter)
    })

    it('should report error globally', async () => {
      setGlobalErrorReporter(errorReporter)
      
      const error = createError.network('Global error', 500)
      await reportError(error, { storeName: 'global-store' })
      
      const report = await errorReporter.generateReport()
      expect(report.errors).toHaveLength(1)
      expect(report.errors[0].message).toBe('Global error')
    })

    it('should handle missing global reporter', async () => {
      setGlobalErrorReporter(null as any)
      
      const error = createError.network('Test error', 500)
      
      // Should not throw
      await expect(reportError(error)).resolves.toBeUndefined()
    })
  })

  describe('Default Filters and Transformers', () => {
    it('should have default filters', () => {
      expect(DEFAULT_ERROR_FILTERS).toHaveLength(2)
      expect(DEFAULT_ERROR_FILTERS[0].name).toBe('excludeValidationErrors')
      expect(DEFAULT_ERROR_FILTERS[1].name).toBe('excludeNetworkTimeouts')
    })

    it('should exclude validation errors by default', () => {
      const filter = DEFAULT_ERROR_FILTERS.find(f => f.name === 'excludeValidationErrors')!
      const validationError = createError.validation('Test validation error')
      const networkError = createError.network('Test network error')
      
      expect(filter.predicate(validationError, {})).toBe(false)
      expect(filter.predicate(networkError, {})).toBe(true)
    })

    it('should exclude network timeouts by default', () => {
      const filter = DEFAULT_ERROR_FILTERS.find(f => f.name === 'excludeNetworkTimeouts')!
      const timeoutError = createError.network('Request timeout')
      const serverError = createError.network('Server error')
      
      expect(filter.predicate(timeoutError, {})).toBe(false)
      expect(filter.predicate(serverError, {})).toBe(true)
    })

    it('should have default transformers', () => {
      expect(DEFAULT_ERROR_TRANSFORMERS).toHaveLength(2)
      expect(DEFAULT_ERROR_TRANSFORMERS[0].name).toBe('addUserAgent')
      expect(DEFAULT_ERROR_TRANSFORMERS[1].name).toBe('addTimestamp')
    })

    it('should add user agent in transformer', () => {
      Object.defineProperty(window, 'navigator', {
        value: { userAgent: 'TestAgent/1.0' },
        writable: true,
      })
      
      const transformer = DEFAULT_ERROR_TRANSFORMERS.find(t => t.name === 'addUserAgent')!
      const error = createError.network('Test error')
      const result = transformer.transform(error, {})
      
      expect(result.context?.userAgent).toBe('TestAgent/1.0')
    })

    it('should add timestamp in transformer', () => {
      const transformer = DEFAULT_ERROR_TRANSFORMERS.find(t => t.name === 'addTimestamp')!
      const error = createError.network('Test error')
      const result = transformer.transform(error, {})
      
      expect(result.timestamp).toBeTypeOf('number')
      expect(result.timestamp).toBeCloseTo(Date.now(), -2) // Within 100ms
    })
  })

  describe('Error Caching and Cleanup', () => {
    it('should cache errors up to limit', async () => {
      const config = {
        ...mockConfig,
        maxCachedErrors: 2,
      }
      
      const reporter = new ErrorReporter(config)
      
      const errors = [
        createError.network('Error 1'),
        createError.network('Error 2'),
        createError.network('Error 3'),
      ]
      
      for (const error of errors) {
        await reporter.report(error, mockContext)
      }
      
      const report = await reporter.generateReport()
      expect(report.errors).toHaveLength(2) // Should have cleaned up oldest error
    })

    it('should preserve most recent errors during cleanup', async () => {
      const config = {
        ...mockConfig,
        maxCachedErrors: 2,
      }
      
      const reporter = new ErrorReporter(config)
      
      await reporter.report(createError.network('Old Error'), mockContext)
      await new Promise(resolve => setTimeout(resolve, 10)) // Small delay
      await reporter.report(createError.network('Recent Error 1'), mockContext)
      await reporter.report(createError.network('Recent Error 2'), mockContext)
      
      const report = await reporter.generateReport()
      expect(report.errors).toHaveLength(2)
      expect(report.errors.map(e => e.message)).toEqual(['Recent Error 1', 'Recent Error 2'])
    })
  })
})