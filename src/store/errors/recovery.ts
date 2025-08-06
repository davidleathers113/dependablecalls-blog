/**
 * DCE Error Recovery System
 * 
 * Comprehensive error recovery with exponential backoff, retry logic,
 * and intelligent failure handling for the DCE platform.
 */

import { DCEError } from './errorTypes'
import type { RecoveryStrategy, ErrorContext } from './errorTypes'
import type { ErrorHandlingConfig, ErrorHandlingContext } from '../middleware/errorHandling'

// Recovery Configuration
// =====================

export interface RecoveryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number
  
  /** Base delay for exponential backoff (ms) */
  baseDelay: number
  
  /** Maximum delay between retries (ms) */
  maxDelay: number
  
  /** Backoff multiplier */
  backoffMultiplier: number
  
  /** Add jitter to prevent thundering herd */
  jitter: boolean
  
  /** Timeout for individual recovery attempts (ms) */
  attemptTimeout: number
  
  /** Circuit breaker threshold */
  circuitBreakerThreshold: number
  
  /** Circuit breaker recovery time (ms) */
  circuitBreakerRecoveryTime: number
}

export interface RetryableOperation<T = unknown> {
  operation: () => Promise<T>
  context: ErrorContext
  shouldRetry?: (error: Error, attempt: number) => boolean
  onRetry?: (error: Error, attempt: number) => void
  onSuccess?: (result: T, attempts: number) => void
  onFailure?: (error: Error, attempts: number) => void
}

// Circuit Breaker State
// ====================

export interface CircuitBreakerState {
  failures: number
  lastFailureTime: number
  state: 'closed' | 'open' | 'half-open'
  nextAttemptTime: number
}

const circuitBreakers = new Map<string, CircuitBreakerState>()

// Recovery Manager
// ===============

export class RecoveryManager {
  private config: RecoveryConfig
  private recoveryStrategies: Map<string, RecoveryStrategyHandler>

  constructor(errorConfig: ErrorHandlingConfig) {
    this.config = {
      maxAttempts: errorConfig.maxRecoveryAttempts || 3,
      baseDelay: 1000,
      maxDelay: 30000,
      backoffMultiplier: 2,
      jitter: true,
      attemptTimeout: errorConfig.recoveryTimeout || 30000,
      circuitBreakerThreshold: 5,
      circuitBreakerRecoveryTime: 60000,
    }

    this.recoveryStrategies = new Map([
      ['retry', new RetryRecoveryStrategy(this.config)],
      ['fallback', new FallbackRecoveryStrategy(this.config)],
      ['redirect', new RedirectRecoveryStrategy(this.config)],
      ['validation', new ValidationRecoveryStrategy(this.config)],
      ['state', new StateRecoveryStrategy(this.config)],
    ])
  }

  async recover(error: DCEError, context: ErrorHandlingContext): Promise<boolean> {
    const strategy = error.getRecoveryStrategy()
    if (!strategy) return false

    const handler = this.recoveryStrategies.get(strategy.type)
    if (!handler) {
      console.warn(`No recovery handler found for strategy: ${strategy.type}`)
      return false
    }

    // Check circuit breaker
    const circuitKey = `${context.storeName}:${strategy.type}`
    if (this.isCircuitOpen(circuitKey)) {
      console.warn(`Circuit breaker open for ${circuitKey}`)
      return false
    }

    try {
      const recovered = await handler.execute(error, strategy, context)
      
      if (recovered) {
        this.recordSuccess(circuitKey)
      } else {
        this.recordFailure(circuitKey)
      }

      return recovered
    } catch (recoveryError) {
      this.recordFailure(circuitKey)
      throw recoveryError
    }
  }

  async executeWithRetry<T>(operation: RetryableOperation<T>): Promise<T> {
    let lastError: Error | null = null
    let attempt = 0

    const circuitKey = `${operation.context.storeName}:${operation.context.actionType}`

    while (attempt < this.config.maxAttempts) {
      // Check circuit breaker
      if (this.isCircuitOpen(circuitKey)) {
        throw lastError || new Error('Circuit breaker is open')
      }

      attempt++

      try {
        const result = await this.executeWithTimeout(operation.operation, this.config.attemptTimeout)
        
        operation.onSuccess?.(result, attempt)
        this.recordSuccess(circuitKey)
        
        return result
      } catch (error) {
        lastError = error as Error
        
        // Check if we should retry
        const shouldRetry = operation.shouldRetry 
          ? operation.shouldRetry(lastError, attempt)
          : this.defaultShouldRetry(lastError, attempt)

        if (!shouldRetry || attempt >= this.config.maxAttempts) {
          this.recordFailure(circuitKey)
          operation.onFailure?.(lastError, attempt)
          throw lastError
        }

        operation.onRetry?.(lastError, attempt)

        // Wait before retry with exponential backoff
        const delay = this.calculateDelay(attempt)
        await this.sleep(delay)
      }
    }

    throw lastError || new Error('Max retry attempts exceeded')
  }

  private async executeWithTimeout<T>(
    operation: () => Promise<T>, 
    timeoutMs: number
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`))
      }, timeoutMs)

      operation()
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId))
    })
  }

  private calculateDelay(attempt: number): number {
    let delay = this.config.baseDelay * Math.pow(this.config.backoffMultiplier, attempt - 1)
    delay = Math.min(delay, this.config.maxDelay)

    if (this.config.jitter) {
      // Add up to 25% jitter
      const jitter = delay * 0.25 * Math.random()
      delay += jitter
    }

    return Math.floor(delay)
  }

  private defaultShouldRetry(error: Error, attempt: number): boolean {
    // Don't retry on validation errors or business logic errors
    if (error.name.includes('Validation') || error.name.includes('Business')) {
      return false
    }

    // Retry on network errors, server errors, timeout errors
    if (error.message.includes('network') || 
        error.message.includes('timeout') ||
        error.message.includes('server') ||
        error.message.includes('5')) {
      return true
    }

    return attempt < this.config.maxAttempts
  }

  private async sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Circuit Breaker Implementation
  // =============================

  private isCircuitOpen(key: string): boolean {
    const breaker = circuitBreakers.get(key)
    if (!breaker) return false

    const now = Date.now()

    switch (breaker.state) {
      case 'closed':
        return false
      
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          breaker.state = 'half-open'
          return false
        }
        return true
      
      case 'half-open':
        return false
    }
  }

  private recordSuccess(key: string): void {
    const breaker = circuitBreakers.get(key)
    if (breaker) {
      breaker.failures = 0
      breaker.state = 'closed'
    }
  }

  private recordFailure(key: string): void {
    let breaker = circuitBreakers.get(key)
    if (!breaker) {
      breaker = {
        failures: 0,
        lastFailureTime: 0,
        state: 'closed',
        nextAttemptTime: 0,
      }
      circuitBreakers.set(key, breaker)
    }

    breaker.failures++
    breaker.lastFailureTime = Date.now()

    if (breaker.failures >= this.config.circuitBreakerThreshold) {
      breaker.state = 'open'
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreakerRecoveryTime
    }
  }
}

// Recovery Strategy Handlers
// =========================

abstract class RecoveryStrategyHandler {
  public config: RecoveryConfig
  
  constructor(config: RecoveryConfig) {
    this.config = config
  }
  
  abstract execute(
    error: DCEError, 
    strategy: RecoveryStrategy, 
    context: ErrorHandlingContext
  ): Promise<boolean>
}

class RetryRecoveryStrategy extends RecoveryStrategyHandler {
  async execute(
    _error: DCEError, 
    strategy: RecoveryStrategy, 
    context: ErrorHandlingContext
  ): Promise<boolean> {
    const maxAttempts = strategy.maxAttempts || this.config.maxAttempts
    const baseDelay = strategy.baseDelay || this.config.baseDelay

    if (context.attempt >= maxAttempts) {
      return false
    }

    // Wait before retry
    const delay = baseDelay * Math.pow(this.config.backoffMultiplier, context.attempt)
    await new Promise(resolve => setTimeout(resolve, Math.min(delay, this.config.maxDelay)))

    return true // Indicate that retry should be attempted
  }
}

class FallbackRecoveryStrategy extends RecoveryStrategyHandler {
  async execute(
    _error: DCEError, 
    strategy: RecoveryStrategy, 
    _context: ErrorHandlingContext
  ): Promise<boolean> {
    switch (strategy.action) {
      case 'showErrorMessage':
        this.showErrorMessage(strategy.message)
        return true

      case 'showCriticalError':
        this.showCriticalError(strategy.message)
        return true

      case 'loadFallbackData':
        await this.loadFallbackData(_context)
        return true

      default:
        console.warn(`Unknown fallback action: ${strategy.action}`)
        return false
    }
  }

  private showErrorMessage(message: string): void {
    // In a real implementation, this would show a toast/notification
    console.error('Error:', message)
    
    // Emit custom event for UI components to handle
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:error', {
        detail: { message, type: 'error' }
      }))
    }
  }

  private showCriticalError(message: string): void {
    console.error('Critical Error:', message)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:critical-error', {
        detail: { message, type: 'critical' }
      }))
    }
  }

  private async loadFallbackData(context: ErrorHandlingContext): Promise<void> {
    // Load cached or default data
    console.log(`Loading fallback data for ${context.storeName}`)
  }
}

class RedirectRecoveryStrategy extends RecoveryStrategyHandler {
  async execute(
    _error: DCEError, 
    strategy: RecoveryStrategy, 
    _context: ErrorHandlingContext  
  ): Promise<boolean> {
    switch (strategy.action) {
      case 'signOut':
        await this.signOut(strategy.fallbackUrl)
        return true

      case 'showAccessDenied':
        this.showAccessDenied(strategy.message, strategy.fallbackUrl)
        return true

      case 'redirectToLogin':
        this.redirectToLogin()
        return true

      default:
        console.warn(`Unknown redirect action: ${strategy.action}`)
        return false
    }
  }

  private async signOut(fallbackUrl?: string): Promise<void> {
    // Clear auth state and redirect
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:auth:signout'))
      if (fallbackUrl) {
        window.location.href = fallbackUrl
      }
    }
  }

  private showAccessDenied(message: string, fallbackUrl?: string): void {
    console.warn('Access Denied:', message)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:access-denied', {
        detail: { message, fallbackUrl }
      }))
    }
  }

  private redirectToLogin(): void {
    if (typeof window !== 'undefined') {
      window.location.href = '/login'
    }
  }
}

class ValidationRecoveryStrategy extends RecoveryStrategyHandler {
  async execute(
    _error: DCEError, 
    strategy: RecoveryStrategy, 
    context: ErrorHandlingContext
  ): Promise<boolean> {
    switch (strategy.action) {
      case 'showFieldError':
        this.showFieldError(strategy.message, strategy.field)
        return true

      case 'showBusinessRuleError':
        this.showBusinessRuleError(strategy.message, strategy.businessRule)
        return true

      case 'resetForm':
        this.resetForm(context.storeName)
        return true

      default:
        console.warn(`Unknown validation action: ${strategy.action}`)
        return false
    }
  }

  private showFieldError(message: string, field?: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:validation:field-error', {
        detail: { message, field }
      }))
    }
  }

  private showBusinessRuleError(message: string, rule?: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:validation:business-error', {
        detail: { message, rule }
      }))
    }
  }

  private resetForm(storeName?: string): void {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:form:reset', {
        detail: { storeName }
      }))
    }
  }
}

class StateRecoveryStrategy extends RecoveryStrategyHandler {
  async execute(
    _error: DCEError, 
    strategy: RecoveryStrategy, 
    context: ErrorHandlingContext
  ): Promise<boolean> {
    switch (strategy.action) {
      case 'resetStore':
        await this.resetStore(strategy.storeName || context.storeName)
        return true

      case 'refreshState':
        await this.refreshState(strategy.storeName || context.storeName)
        return true

      case 'revertToCheckpoint':
        await this.revertToCheckpoint(strategy.storeName || context.storeName)
        return true

      default:
        console.warn(`Unknown state action: ${strategy.action}`)
        return false
    }
  }

  private async resetStore(storeName: string): Promise<void> {
    console.log(`Resetting store: ${storeName}`)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:store:reset', {
        detail: { storeName }
      }))
    }
  }

  private async refreshState(storeName: string): Promise<void> {
    console.log(`Refreshing state: ${storeName}`)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:store:refresh', {
        detail: { storeName }
      }))
    }
  }

  private async revertToCheckpoint(storeName: string): Promise<void> {
    console.log(`Reverting to checkpoint: ${storeName}`)
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dce:store:revert', {
        detail: { storeName }
      }))
    }
  }
}

// Utility Functions
// ================

export function createRetryableOperation<T>(
  operation: () => Promise<T>,
  context: ErrorContext,
  options: Partial<RetryableOperation<T>> = {}
): RetryableOperation<T> {
  return {
    operation,
    context,
    ...options,
  }
}

export function isRetryableError(error: Error): boolean {
  const errorMessage = error.message.toLowerCase()
  
  // Check for retryable error patterns using string methods
  const retryablePatterns = [
    'timeout',
    'network',
    'connection',
    'rate limit',
    '500',
    '502',
    '503',
    '504',
  ]
  
  return retryablePatterns.some(pattern => errorMessage.includes(pattern))
}

export function calculateNextRetryDelay(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 30000,
  backoffMultiplier: number = 2,
  jitter: boolean = true
): number {
  let delay = baseDelay * Math.pow(backoffMultiplier, attempt - 1)
  delay = Math.min(delay, maxDelay)

  if (jitter) {
    const jitterAmount = delay * 0.25 * Math.random()
    delay += jitterAmount
  }

  return Math.floor(delay)
}