/**
 * Tests for DCE Error Types
 */

import { describe, it, expect } from 'vitest'
import {
  DCEError,
  AuthenticationError,
  AuthorizationError,
  NetworkError,
  ValidationError,
  StateError,
  BusinessLogicError,
  ConfigurationError,
  createError,
} from '../errorTypes'

describe('DCE Error Types', () => {
  describe('Base DCEError', () => {
    class TestError extends DCEError {
      toMonitoringError() {
        return {
          id: this.errorId,
          timestamp: this.timestamp,
          type: 'system' as const,
          severity: this.severity,
          message: this.message,
          stack: this.stack,
          context: this.context,
          resolved: false,
        }
      }

      protected getDefaultRecoveryStrategy() {
        return {
          type: 'fallback' as const,
          action: 'showErrorMessage',
          message: this.message,
        }
      }
    }

    it('should create error with default properties', () => {
      const error = new TestError('Test error')
      
      expect(error.message).toBe('Test error')
      expect(error.name).toBe('TestError')
      expect(error.severity).toBe('medium')
      expect(error.category).toBe('system')
      expect(error.recoverable).toBe(false)
      expect(error.retryable).toBe(false)
      expect(error.timestamp).toBeTypeOf('number')
      expect(error.errorId).toMatch(/^dce_\d+_[a-z0-9]{9}$/)
    })

    it('should create error with custom options', () => {
      const error = new TestError('Test error', {
        severity: 'high',
        category: 'authentication',
        recoverable: true,
        retryable: true,
        context: { userId: '123' },
      })
      
      expect(error.severity).toBe('high')
      expect(error.category).toBe('authentication')
      expect(error.recoverable).toBe(true)
      expect(error.retryable).toBe(true)
      expect(error.context.userId).toBe('123')
    })

    it('should determine retry eligibility', () => {
      const retryableError = new TestError('Test error', { retryable: true })
      const nonRetryableError = new TestError('Test error', { retryable: false })
      
      expect(retryableError.shouldRetry(1)).toBe(true)
      expect(retryableError.shouldRetry(3)).toBe(false)
      expect(nonRetryableError.shouldRetry(1)).toBe(false)
    })

    it('should provide recovery strategy for recoverable errors', () => {
      const recoverableError = new TestError('Test error', { recoverable: true })
      const nonRecoverableError = new TestError('Test error', { recoverable: false })
      
      expect(recoverableError.getRecoveryStrategy()).toBeTruthy()
      expect(nonRecoverableError.getRecoveryStrategy()).toBeNull()
    })
  })

  describe('AuthenticationError', () => {
    it('should create authentication error with correct defaults', () => {
      const error = new AuthenticationError('Invalid credentials')
      
      expect(error.category).toBe('authentication')
      expect(error.severity).toBe('high')
      expect(error.recoverable).toBe(true)
      expect(error.retryable).toBe(false)
    })

    it('should provide appropriate recovery strategy', () => {
      const error = new AuthenticationError('Session expired')
      const strategy = error.getRecoveryStrategy()
      
      expect(strategy).toBeTruthy()
      expect(strategy?.type).toBe('redirect')
      expect(strategy?.action).toBe('signOut')
    })

    it('should convert to monitoring error', () => {
      const error = new AuthenticationError('Test auth error')
      const monitoringError = error.toMonitoringError()
      
      expect(monitoringError.type).toBe('authentication')
      expect(monitoringError.message).toBe('Test auth error')
      expect(monitoringError.severity).toBe('high')
    })
  })

  describe('AuthorizationError', () => {
    it('should create authorization error with role information', () => {
      const error = new AuthorizationError(
        'Access denied',
        'admin',
        'user'
      )
      
      expect(error.requiredRole).toBe('admin')
      expect(error.userRole).toBe('user')
      expect(error.category).toBe('authorization')
    })

    it('should include role information in monitoring error', () => {
      const error = new AuthorizationError('Access denied', 'admin', 'user')
      const monitoringError = error.toMonitoringError()
      
      expect(monitoringError.context.requiredRole).toBe('admin')
      expect(monitoringError.context.userRole).toBe('user')
    })
  })

  describe('NetworkError', () => {
    it('should determine severity from status code', () => {
      const serverError = new NetworkError('Server error', 500)
      const clientError = new NetworkError('Bad request', 400)
      const unknownError = new NetworkError('Unknown error')
      
      expect(serverError.severity).toBe('high')
      expect(clientError.severity).toBe('medium')
      expect(unknownError.severity).toBe('medium')
    })

    it('should determine retryability from status code', () => {
      const serverError = new NetworkError('Server error', 500)
      const timeoutError = new NetworkError('Timeout', 408)
      const rateLimitError = new NetworkError('Rate limit', 429)
      const notFoundError = new NetworkError('Not found', 404)
      
      expect(serverError.retryable).toBe(true)
      expect(timeoutError.retryable).toBe(true)
      expect(rateLimitError.retryable).toBe(true)
      expect(notFoundError.retryable).toBe(false)
    })

    it('should provide appropriate recovery strategy', () => {
      const serverError = new NetworkError('Server error', 500)
      const rateLimitError = new NetworkError('Rate limit', 429)
      const clientError = new NetworkError('Bad request', 400)
      
      const serverStrategy = serverError.getRecoveryStrategy()
      const rateLimitStrategy = rateLimitError.getRecoveryStrategy()
      const clientStrategy = clientError.getRecoveryStrategy()
      
      expect(serverStrategy?.action).toBe('exponentialBackoff')
      expect(rateLimitStrategy?.action).toBe('rateLimitBackoff')
      expect(clientStrategy?.action).toBe('showErrorMessage')
    })
  })

  describe('ValidationError', () => {
    it('should create validation error with field information', () => {
      const error = new ValidationError(
        'Email is required',
        'email',
        'required',
        ''
      )
      
      expect(error.field).toBe('email')
      expect(error.validationRule).toBe('required')
      expect(error.receivedValue).toBe('')
      expect(error.category).toBe('validation')
      expect(error.retryable).toBe(false)
    })

    it('should provide field-specific recovery strategy', () => {
      const error = new ValidationError('Invalid email', 'email')
      const strategy = error.getRecoveryStrategy()
      
      expect(strategy?.type).toBe('validation')
      expect(strategy?.action).toBe('showFieldError')
      expect(strategy?.field).toBe('email')
    })
  })

  describe('StateError', () => {
    it('should create state error with store information', () => {
      const error = new StateError(
        'Invalid state transition',
        'authStore',
        'signIn',
        { user: null }
      )
      
      expect(error.storeName).toBe('authStore')
      expect(error.actionType).toBe('signIn')
      expect(error.stateSnapshot).toEqual({ user: null })
      expect(error.severity).toBe('high')
    })

    it('should provide store reset recovery strategy', () => {
      const error = new StateError('State corruption', 'authStore')
      const strategy = error.getRecoveryStrategy()
      
      expect(strategy?.type).toBe('state')
      expect(strategy?.action).toBe('resetStore')
      expect(strategy?.storeName).toBe('authStore')
    })
  })

  describe('BusinessLogicError', () => {
    it('should create business logic error with rule information', () => {
      const error = new BusinessLogicError(
        'Campaign budget exceeds limit',
        'max_budget',
        'campaign',
        'camp_123'
      )
      
      expect(error.businessRule).toBe('max_budget')
      expect(error.entityType).toBe('campaign')
      expect(error.entityId).toBe('camp_123')
      expect(error.category).toBe('business')
    })
  })

  describe('ConfigurationError', () => {
    it('should create configuration error as critical', () => {
      const error = new ConfigurationError(
        'API key not configured',
        'API_KEY',
        'string'
      )
      
      expect(error.severity).toBe('critical')
      expect(error.recoverable).toBe(false)
      expect(error.retryable).toBe(false)
    })
  })

  describe('Error Factory', () => {
    it('should create authentication errors', () => {
      const error = createError.authentication('Login failed')
      expect(error).toBeInstanceOf(AuthenticationError)
      expect(error.message).toBe('Login failed')
    })

    it('should create network errors', () => {
      const error = createError.network('Connection failed', 500, '/api/test', 'GET')
      expect(error).toBeInstanceOf(NetworkError)
      expect(error.statusCode).toBe(500)
      expect(error.endpoint).toBe('/api/test')
      expect(error.method).toBe('GET')
    })

    it('should create validation errors', () => {
      const error = createError.validation('Email invalid', 'email', 'format', 'invalid-email')
      expect(error).toBeInstanceOf(ValidationError)
      expect(error.field).toBe('email')
      expect(error.validationRule).toBe('format')
      expect(error.receivedValue).toBe('invalid-email')
    })

    it('should create state errors', () => {
      const error = createError.state('State error', 'authStore', 'signIn', { user: null })
      expect(error).toBeInstanceOf(StateError)
      expect(error.storeName).toBe('authStore')
      expect(error.actionType).toBe('signIn')
    })

    it('should create business logic errors', () => {
      const error = createError.business('Rule violation', 'max_limit', 'campaign', '123')
      expect(error).toBeInstanceOf(BusinessLogicError)
      expect(error.businessRule).toBe('max_limit')
      expect(error.entityType).toBe('campaign')
      expect(error.entityId).toBe('123')
    })
  })
})