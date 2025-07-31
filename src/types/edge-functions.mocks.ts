/**
 * Mock Types and Utilities for Edge Functions Testing
 * 
 * These types and utilities provide comprehensive mocking capabilities
 * for testing Edge Function integrations without actual network calls
 */

import type {
  EdgeFunctionContext,
  EdgeFunctionResponse,
  EdgeFunctionError,
  SanitizeContentRequest,
  SanitizeContentResponse,
  ContentValidation,
  ResponseMetadata,
  RateLimitInfo
} from './edge-functions'
import { EdgeFunctionErrorCode } from './edge-functions'

// Mock Edge Function Context
export interface MockEdgeFunctionContext extends Partial<EdgeFunctionContext> {
  mockRequest?: Partial<Request>
  mockNext?: () => Promise<Response>
  mockParams?: Record<string, string>
  mockSite?: {
    id: string
    name: string
    url: string
  }
  mockIp?: string
  mockGeo?: EdgeFunctionContext['geo']
  mockCookies?: {
    storage: Map<string, string>
    get: (name: string) => string | undefined
    set: (name: string, value: string) => void
    delete: (name: string) => void
  }
}

// Mock request builders
export class MockRequestBuilder {
  private requestData: {
    url?: string
    method?: string
    headers?: Record<string, string>
    body?: string
  } = {}

  url(url: string): this {
    this.requestData.url = url
    return this
  }

  method(method: string): this {
    this.requestData.method = method
    return this
  }

  headers(headers: Record<string, string>): this {
    this.requestData.headers = { ...this.requestData.headers, ...headers }
    return this
  }

  body(body: string | object): this {
    this.requestData.body = typeof body === 'string' ? body : JSON.stringify(body)
    return this
  }

  build(): Request {
    return new Request(this.requestData.url || 'http://localhost', {
      method: this.requestData.method || 'GET',
      headers: this.requestData.headers,
      body: this.requestData.body
    })
  }
}

// Mock response builders
export class MockResponseBuilder<T = unknown> {
  private responseData: EdgeFunctionResponse<T> = {
    success: true
  }

  success(data: T): this {
    this.responseData = {
      success: true,
      data,
      metadata: this.createMockMetadata()
    }
    return this
  }

  error(error: EdgeFunctionError): this {
    this.responseData = {
      success: false,
      error,
      metadata: this.createMockMetadata()
    }
    return this
  }

  metadata(metadata: Partial<ResponseMetadata>): this {
    this.responseData.metadata = {
      ...this.createMockMetadata(),
      ...metadata
    }
    return this
  }

  build(): EdgeFunctionResponse<T> {
    return this.responseData
  }

  private createMockMetadata(): ResponseMetadata {
    return {
      functionName: 'mock-function',
      executionTimeMs: Math.floor(Math.random() * 100),
      region: 'mock-region',
      requestId: `mock-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    }
  }
}

// Pre-built mock data
export const MOCK_SANITIZATION_RESPONSE: SanitizeContentResponse = {
  sanitizedContent: '<p>This is clean content</p>',
  metadata: {
    originalLength: 100,
    sanitizedLength: 32,
    removedTags: ['script', 'iframe'],
    removedAttributes: ['onclick', 'onerror'],
    processingTimeMs: 15,
    sanitizationLevel: 'strict'
  },
  warnings: [
    {
      type: 'xss_attempt',
      message: 'Removed potentially malicious script tag',
      position: 45,
      context: '<script>alert("xss")</script>'
    }
  ]
}

export const MOCK_VALIDATION_RESPONSE: ContentValidation = {
  isValid: true,
  errors: []
}

export const MOCK_VALIDATION_ERROR_RESPONSE: ContentValidation = {
  isValid: false,
  errors: [
    {
      field: 'content',
      rule: 'max_length',
      message: 'Content exceeds maximum allowed length',
      value: 50000
    },
    {
      field: 'content',
      rule: 'forbidden_tags',
      message: 'Content contains forbidden HTML tags',
      value: ['script', 'object', 'embed']
    }
  ]
}

// Mock error generators
export class MockErrorGenerator {
  static timeout(): EdgeFunctionError {
    return {
      code: EdgeFunctionErrorCode.TIMEOUT,
      message: 'Edge Function execution timed out',
      retryable: true,
      statusCode: 504
    }
  }

  static rateLimit(retryAfter = 60): EdgeFunctionError {
    return {
      code: EdgeFunctionErrorCode.RATE_LIMITED,
      message: 'Rate limit exceeded',
      details: {
        limit: 100,
        remaining: 0,
        reset: new Date(Date.now() + retryAfter * 1000),
        retryAfter
      },
      retryable: true,
      statusCode: 429
    }
  }

  static sanitizationFailed(): EdgeFunctionError {
    return {
      code: EdgeFunctionErrorCode.SANITIZATION_FAILED,
      message: 'Content sanitization failed',
      details: {
        reason: 'Malformed HTML structure',
        position: 123
      },
      retryable: false,
      statusCode: 422
    }
  }

  static networkError(): EdgeFunctionError {
    return {
      code: EdgeFunctionErrorCode.NETWORK_ERROR,
      message: 'Network connection failed',
      retryable: true,
      statusCode: 0
    }
  }

  static invalidRequest(field: string): EdgeFunctionError {
    return {
      code: EdgeFunctionErrorCode.INVALID_REQUEST,
      message: `Invalid request: ${field} is required`,
      details: { field },
      retryable: false,
      statusCode: 400
    }
  }
}

// Mock Edge Function service for testing
export class MockEdgeFunctionsService {
  private mockResponses: Map<string, EdgeFunctionResponse<unknown>> = new Map()
  private callHistory: Array<{
    path: string
    method: string
    body?: string
    timestamp: Date
  }> = []

  // Configure mock responses
  mockResponse<T>(path: string, response: EdgeFunctionResponse<T>): this {
    this.mockResponses.set(path, response)
    return this
  }

  // Simulate successful sanitization
  mockSanitizeSuccess(response?: Partial<SanitizeContentResponse>): this {
    return this.mockResponse('sanitize-content', {
      success: true,
      data: { ...MOCK_SANITIZATION_RESPONSE, ...response }
    })
  }

  // Simulate sanitization error
  mockSanitizeError(error?: Partial<EdgeFunctionError>): this {
    return this.mockResponse('sanitize-content', {
      success: false,
      error: { ...MockErrorGenerator.sanitizationFailed(), ...error }
    })
  }

  // Simulate validation success
  mockValidateSuccess(response?: Partial<ContentValidation>): this {
    return this.mockResponse('validate-content', {
      success: true,
      data: { ...MOCK_VALIDATION_RESPONSE, ...response }
    })
  }

  // Simulate validation error
  mockValidateError(response?: Partial<ContentValidation>): this {
    return this.mockResponse('validate-content', {
      success: true,
      data: { ...MOCK_VALIDATION_ERROR_RESPONSE, ...response }
    })
  }

  // Mock implementation methods
  async sanitizeContent(request: SanitizeContentRequest): Promise<EdgeFunctionResponse<SanitizeContentResponse>> {
    this.recordCall('sanitize-content', 'POST', JSON.stringify(request))
    const response = this.mockResponses.get('sanitize-content')
    return response as EdgeFunctionResponse<SanitizeContentResponse> || {
      success: true,
      data: MOCK_SANITIZATION_RESPONSE
    }
  }

  async validateContent(
    content: string,
    contentType: string
  ): Promise<EdgeFunctionResponse<ContentValidation>> {
    this.recordCall('validate-content', 'POST', JSON.stringify({ content, type: contentType }))
    const response = this.mockResponses.get('validate-content')
    return response as EdgeFunctionResponse<ContentValidation> || {
      success: true,
      data: MOCK_VALIDATION_RESPONSE
    }
  }

  async processWebhook(payload: unknown): Promise<EdgeFunctionResponse<{ processed: boolean; message: string }>> {
    this.recordCall('process-webhook', 'POST', JSON.stringify(payload))
    const response = this.mockResponses.get('process-webhook')
    return response as EdgeFunctionResponse<{ processed: boolean; message: string }> || {
      success: true,
      data: { processed: true, message: 'Webhook processed successfully' }
    }
  }

  async syncCache(
    entityType: string,
    entityId: string
  ): Promise<EdgeFunctionResponse<{ synced: boolean; timestamp: string }>> {
    this.recordCall('sync-cache', 'POST', JSON.stringify({ entityType, entityId }))
    const response = this.mockResponses.get('sync-cache')
    return response as EdgeFunctionResponse<{ synced: boolean; timestamp: string }> || {
      success: true,
      data: { synced: true, timestamp: new Date().toISOString() }
    }
  }

  // Testing utilities
  getCallHistory() {
    return [...this.callHistory]
  }

  getLastCall() {
    return this.callHistory[this.callHistory.length - 1]
  }

  clearHistory() {
    this.callHistory = []
  }

  reset() {
    this.mockResponses.clear()
    this.callHistory = []
  }

  private recordCall(path: string, method: string, body?: string) {
    this.callHistory.push({
      path,
      method,
      body,
      timestamp: new Date()
    })
  }
}

// Test data generators
export class MockDataGenerator {
  static sanitizeRequest(overrides?: Partial<SanitizeContentRequest>): SanitizeContentRequest {
    return {
      content: '<p>Hello <script>alert("xss")</script> world</p>',
      options: {
        allowedTags: ['p', 'br', 'strong', 'em'],
        allowedAttributes: {},
        allowedProtocols: ['http', 'https'],
        removeEmptyTags: true
      },
      context: {
        contentType: 'blog_post',
        userId: 'user-123',
        userRole: 'author'
      },
      ...overrides
    }
  }

  static edgeFunctionContext(overrides?: Partial<MockEdgeFunctionContext>): MockEdgeFunctionContext {
    return {
      mockRequest: new MockRequestBuilder()
        .url('http://localhost/.netlify/edge-functions/sanitize-content')
        .method('POST')
        .build(),
      mockParams: {},
      mockSite: {
        id: 'site-123',
        name: 'DCE Blog',
        url: 'https://blog.dependablecalls.com'
      },
      mockIp: '127.0.0.1',
      mockGeo: {
        city: 'Test City',
        country: { code: 'US', name: 'United States' },
        timezone: 'America/New_York'
      },
      mockCookies: {
        storage: new Map(),
        get: function(name: string) { return this.storage.get(name) },
        set: function(name: string, value: string) { this.storage.set(name, value) },
        delete: function(name: string) { this.storage.delete(name) }
      },
      ...overrides
    }
  }

  static rateLimitInfo(overrides?: Partial<RateLimitInfo>): RateLimitInfo {
    return {
      limit: 100,
      remaining: 50,
      reset: new Date(Date.now() + 3600000), // 1 hour from now
      retryAfter: 60,
      ...overrides
    }
  }
}

// All classes are already exported above, no need to re-export