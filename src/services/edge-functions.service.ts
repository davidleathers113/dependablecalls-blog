/**
 * Edge Functions Service
 * 
 * Service layer for interacting with Netlify Edge Functions
 * Implements typed calls with retry logic and error handling
 */

import type {
  EdgeFunctionResponse,
  EdgeFunctionError,
  SanitizeContentRequest,
  SanitizeContentResponse,
  RetryConfig,
  RateLimitInfo,
  ResponseMetadata,
  ContentValidation,
} from '../types/edge-functions'
import { 
  isEdgeFunctionError, 
  EdgeFunctionErrorCode,
  DEFAULT_RETRY_CONFIG,
  EDGE_FUNCTION_HEADERS
} from '../types/edge-functions'

export class EdgeFunctionsService {
  private baseUrl: string
  private defaultHeaders: Record<string, string>
  private retryConfig: RetryConfig

  constructor(config?: {
    baseUrl?: string
    headers?: Record<string, string>
    retryConfig?: Partial<RetryConfig>
  }) {
    this.baseUrl = config?.baseUrl || ''
    this.defaultHeaders = {
      'Content-Type': 'application/json',
      ...config?.headers
    }
    this.retryConfig = {
      ...DEFAULT_RETRY_CONFIG,
      ...config?.retryConfig
    }
  }

  /**
   * Sanitize content using the Edge Function
   */
  async sanitizeContent(
    request: SanitizeContentRequest
  ): Promise<EdgeFunctionResponse<SanitizeContentResponse>> {
    return this.callEdgeFunction<SanitizeContentRequest, SanitizeContentResponse>(
      '/.netlify/edge-functions/sanitize-content',
      {
        method: 'POST',
        body: JSON.stringify(request)
      }
    )
  }

  /**
   * Validate content structure and format
   */
  async validateContent(
    content: string,
    contentType: 'blog_post' | 'comment' | 'author_bio'
  ): Promise<EdgeFunctionResponse<ContentValidation>> {
    return this.callEdgeFunction<{ content: string; type: string }, ContentValidation>(
      '/.netlify/edge-functions/validate-content',
      {
        method: 'POST',
        body: JSON.stringify({ content, type: contentType })
      }
    )
  }

  /**
   * Process webhook from pg_net
   */
  async processWebhook(
    payload: unknown
  ): Promise<EdgeFunctionResponse<{ processed: boolean; message: string }>> {
    return this.callEdgeFunction(
      '/.netlify/edge-functions/process-webhook',
      {
        method: 'POST',
        body: JSON.stringify(payload)
      }
    )
  }

  /**
   * Sync cache for content updates
   */
  async syncCache(
    entityType: string,
    entityId: string
  ): Promise<EdgeFunctionResponse<{ synced: boolean; timestamp: string }>> {
    return this.callEdgeFunction(
      '/.netlify/edge-functions/sync-cache',
      {
        method: 'POST',
        body: JSON.stringify({ entityType, entityId })
      }
    )
  }

  /**
   * Generic Edge Function caller with retry logic
   */
  private async callEdgeFunction<_TRequest = unknown, TResponse = unknown>(
    path: string,
    options: RequestInit
  ): Promise<EdgeFunctionResponse<TResponse>> {
    const url = `${this.baseUrl}${path}`
    const headers = {
      ...this.defaultHeaders,
      ...options.headers
    }

    let lastError: EdgeFunctionError | undefined
    let attempt = 0

    while (attempt <= this.retryConfig.maxRetries) {
      try {
        const startTime = Date.now()
        
        // Add timeout with AbortController
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), this.retryConfig.timeoutMs)
        
        const response = await fetch(url, {
          ...options,
          headers,
          signal: controller.signal
        }).finally(() => clearTimeout(timeoutId))

        const executionTime = Date.now() - startTime
        const responseHeaders = this.parseHeaders(response.headers)
        
        // Extract metadata from headers
        const metadata: ResponseMetadata = {
          functionName: responseHeaders[EDGE_FUNCTION_HEADERS.FUNCTION_NAME] || 'unknown',
          executionTimeMs: executionTime,
          region: responseHeaders['x-edge-region'] || 'unknown',
          requestId: responseHeaders[EDGE_FUNCTION_HEADERS.REQUEST_ID] || this.generateRequestId()
        }

        // Check for rate limiting
        if (response.status === 429) {
          const rateLimitInfo = this.extractRateLimitInfo(responseHeaders)
          const retryAfter = rateLimitInfo.retryAfter || 60
          
          lastError = {
            code: EdgeFunctionErrorCode.RATE_LIMITED,
            message: 'Rate limit exceeded',
            details: rateLimitInfo,
            retryable: true,
            statusCode: 429
          }

          if (attempt < this.retryConfig.maxRetries) {
            await this.delay(retryAfter * 1000)
            attempt++
            continue
          }
        }

        // Handle error responses
        if (!response.ok) {
          const errorData = await this.parseErrorResponse(response)
          lastError = errorData
          
          if (this.isRetryableError(errorData) && attempt < this.retryConfig.maxRetries) {
            await this.delay(this.calculateBackoff(attempt))
            attempt++
            continue
          }

          return {
            success: false,
            error: errorData,
            metadata
          }
        }

        // Parse successful response
        const data = await response.json() as TResponse
        return {
          success: true,
          data,
          metadata
        }

      } catch (error) {
        // Handle abort error specifically
        if (error instanceof Error && error.name === 'AbortError') {
          lastError = {
            code: EdgeFunctionErrorCode.TIMEOUT,
            message: `Request timed out after ${this.retryConfig.timeoutMs}ms`,
            details: error,
            retryable: true,
            statusCode: 0
          }
        } else {
          // Network or parsing errors
          lastError = {
            code: EdgeFunctionErrorCode.NETWORK_ERROR,
            message: error instanceof Error ? error.message : 'Network error occurred',
            details: error,
            retryable: true,
            statusCode: 0
          }
        }

        if (attempt < this.retryConfig.maxRetries) {
          await this.delay(this.calculateBackoff(attempt))
          attempt++
          continue
        }
      }
    }

    // All retries exhausted
    return {
      success: false,
      error: lastError || {
        code: EdgeFunctionErrorCode.INTERNAL_ERROR,
        message: 'Unknown error occurred',
        retryable: false,
        statusCode: 500
      }
    }
  }

  /**
   * Parse response headers into object
   */
  private parseHeaders(headers: Headers): Record<string, string> {
    const result: Record<string, string> = {}
    headers.forEach((value, key) => {
      result[key.toLowerCase()] = value
    })
    return result
  }

  /**
   * Extract rate limit information from headers
   */
  private extractRateLimitInfo(headers: Record<string, string>): RateLimitInfo {
    return {
      limit: parseInt(headers[EDGE_FUNCTION_HEADERS.RATE_LIMIT_LIMIT] || '60'),
      remaining: parseInt(headers[EDGE_FUNCTION_HEADERS.RATE_LIMIT_REMAINING] || '0'),
      reset: new Date(parseInt(headers[EDGE_FUNCTION_HEADERS.RATE_LIMIT_RESET] || '0') * 1000),
      retryAfter: parseInt(headers[EDGE_FUNCTION_HEADERS.RETRY_AFTER] || '60')
    }
  }

  /**
   * Parse error response from Edge Function
   */
  private async parseErrorResponse(response: Response): Promise<EdgeFunctionError> {
    try {
      const errorData = await response.json()
      if (isEdgeFunctionError(errorData)) {
        return errorData
      }
    } catch {
      // Failed to parse JSON error
    }

    // Default error based on status code
    return {
      code: this.mapStatusCodeToErrorCode(response.status),
      message: response.statusText || 'Edge Function error',
      retryable: this.isRetryableStatusCode(response.status),
      statusCode: response.status
    }
  }

  /**
   * Map HTTP status code to Edge Function error code
   */
  private mapStatusCodeToErrorCode(status: number): EdgeFunctionErrorCode {
    switch (status) {
      case 400:
        return EdgeFunctionErrorCode.INVALID_REQUEST
      case 429:
        return EdgeFunctionErrorCode.RATE_LIMITED
      case 504:
        return EdgeFunctionErrorCode.TIMEOUT
      case 507:
        return EdgeFunctionErrorCode.MEMORY_EXCEEDED
      default:
        return EdgeFunctionErrorCode.INTERNAL_ERROR
    }
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: EdgeFunctionError): boolean {
    return (
      error.retryable &&
      this.retryConfig.retryableErrors.includes(error.code)
    )
  }

  /**
   * Check if status code is retryable
   */
  private isRetryableStatusCode(status: number): boolean {
    return status >= 500 || status === 429
  }

  /**
   * Calculate backoff delay for retries
   */
  private calculateBackoff(attempt: number): number {
    // Decorrelated jitter backoff algorithm
    // This provides better performance under high concurrency compared to full jitter
    const baseDelay = Math.min(
      this.retryConfig.initialDelayMs * Math.pow(this.retryConfig.backoffMultiplier, attempt),
      this.retryConfig.maxDelayMs
    )
    
    // Decorrelated jitter: sleep = min(cap, random(base, sleep * 3))
    // This creates a more evenly distributed retry pattern
    const jitterMin = this.retryConfig.initialDelayMs
    const jitterMax = baseDelay * 3
    const jitteredDelay = jitterMin + Math.random() * (Math.min(jitterMax, this.retryConfig.maxDelayMs) - jitterMin)
    
    return Math.round(jitteredDelay)
  }

  /**
   * Delay helper for retries
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  /**
   * Generate request ID for tracking
   */
  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  /**
   * Batch sanitize multiple content items
   */
  async batchSanitizeContent(
    requests: SanitizeContentRequest[],
    options?: { concurrency?: number }
  ): Promise<EdgeFunctionResponse<SanitizeContentResponse[]>> {
    const results: SanitizeContentResponse[] = []
    const errors: Array<{ index: number; error: EdgeFunctionError }> = []

    // Process in parallel with configurable concurrency limit
    const concurrency = options?.concurrency || 5
    for (let i = 0; i < requests.length; i += concurrency) {
      const batch = requests.slice(i, i + concurrency)
      const promises = batch.map((request, index) =>
        this.sanitizeContent(request)
          .then(response => {
            if (response.success && response.data) {
              results[i + index] = response.data
            } else if (response.error) {
              errors.push({ index: i + index, error: response.error })
            }
          })
      )
      await Promise.all(promises)
    }

    if (errors.length > 0) {
      return {
        success: false,
        error: {
          code: EdgeFunctionErrorCode.SANITIZATION_FAILED,
          message: `Failed to sanitize ${errors.length} items`,
          details: errors,
          retryable: false,
          statusCode: 207 // Multi-status
        }
      }
    }

    return {
      success: true,
      data: results
    }
  }

  /**
   * Validate multiple content items
   */
  async batchValidateContent(
    items: Array<{ content: string; type: 'blog_post' | 'comment' | 'author_bio' }>
  ): Promise<EdgeFunctionResponse<ContentValidation[]>> {
    const results: ContentValidation[] = []
    
    for (const item of items) {
      const response = await this.validateContent(item.content, item.type)
      if (response.success && response.data) {
        results.push(response.data)
      } else {
        results.push({
          isValid: false,
          errors: [{
            field: 'content',
            rule: 'edge_function_error',
            message: response.error?.message || 'Validation failed'
          }]
        })
      }
    }

    return {
      success: true,
      data: results
    }
  }
}

// Export singleton instance
export const edgeFunctions = new EdgeFunctionsService()

// Export the service type
export type EdgeFunctionsServiceType = EdgeFunctionsService