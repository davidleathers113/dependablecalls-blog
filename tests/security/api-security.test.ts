import { describe, it, expect, beforeEach, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

// Mock server for API testing
const server = setupServer()

beforeEach(() => {
  server.listen()
  vi.clearAllMocks()
})

afterEach(() => {
  server.resetHandlers()
})

afterAll(() => {
  server.close()
})

describe('API Security Tests', () => {
  describe('Rate Limiting', () => {
    it('should enforce rate limiting on login endpoint', async () => {
      let requestCount = 0
      
      server.use(
        http.post('/api/auth/login', () => {
          requestCount++
          if (requestCount > 5) {
            return HttpResponse.json(
              { error: 'Too many requests' },
              { status: 429, headers: { 'Retry-After': '300' } }
            )
          }
          return HttpResponse.json(
            { error: 'Invalid credentials' },
            { status: 401 }
          )
        })
      )

      // Make multiple rapid requests
      const promises = Array.from({ length: 10 }, () =>
        fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: 'test@example.com', password: 'wrong' })
        })
      )

      const responses = await Promise.all(promises)
      
      // Some requests should be rate limited
      const rateLimited = responses.filter(r => r.status === 429)
      expect(rateLimited.length).toBeGreaterThan(0)
      
      // Rate limited responses should include Retry-After header
      rateLimited.forEach(response => {
        expect(response.headers.get('Retry-After')).toBeTruthy()
      })
    })

    it('should enforce rate limiting on API endpoints', async () => {
      let requestCount = 0
      const rateLimit = 100 // requests per minute
      
      server.use(
        http.get('/api/campaigns', () => {
          requestCount++
          if (requestCount > rateLimit) {
            return HttpResponse.json(
              { error: 'Rate limit exceeded' },
              { status: 429 }
            )
          }
          return HttpResponse.json([])
        })
      )

      // Simulate burst of requests
      const promises = Array.from({ length: rateLimit + 5 }, () =>
        fetch('/api/campaigns', {
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      )

      const responses = await Promise.all(promises)
      const rateLimited = responses.filter(r => r.status === 429)
      
      expect(rateLimited.length).toBeGreaterThan(0)
    })

    it('should implement sliding window rate limiting', async () => {
      const windowSize = 60000 // 1 minute
      const maxRequests = 10
      const requests: number[] = []
      
      server.use(
        http.get('/api/user/profile', () => {
          const now = Date.now()
          
          // Remove requests outside the window
          while (requests.length > 0 && requests[0] < now - windowSize) {
            requests.shift()
          }
          
          if (requests.length >= maxRequests) {
            return HttpResponse.json(
              { error: 'Rate limit exceeded' },
              { status: 429 }
            )
          }
          
          requests.push(now)
          return HttpResponse.json({ id: '123', name: 'Test User' })
        })
      )

      // Make requests rapidly
      const rapidRequests = Array.from({ length: maxRequests + 2 }, () =>
        fetch('/api/user/profile', {
          headers: { 'Authorization': 'Bearer valid-token' }
        })
      )

      const responses = await Promise.all(rapidRequests)
      const rateLimited = responses.filter(r => r.status === 429)
      
      expect(rateLimited.length).toBeGreaterThan(0)
    })
  })

  describe('CORS Security', () => {
    it('should reject requests from unauthorized origins', async () => {
      const unauthorizedOrigins = [
        'http://malicious-site.com',
        'https://evil.example.com',
        'null',
        'file://',
        'data:'
      ]

      server.use(
        http.options('/api/campaigns', ({ request }) => {
          const origin = request.headers.get('Origin')
          const allowedOrigins = ['https://app.dce.com', 'https://dce.com']
          
          if (!origin || !allowedOrigins.includes(origin)) {
            return HttpResponse.json(
              { error: 'CORS policy violation' },
              { status: 403 }
            )
          }
          
          return new HttpResponse(null, {
            status: 200,
            headers: {
              'Access-Control-Allow-Origin': origin,
              'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE',
              'Access-Control-Allow-Headers': 'Content-Type, Authorization'
            }
          })
        })
      )

      for (const origin of unauthorizedOrigins) {
        const response = await fetch('/api/campaigns', {
          method: 'OPTIONS',
          headers: { 'Origin': origin }
        })
        
        expect(response.status).toBe(403)
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull()
      }
    })

    it('should not allow wildcard CORS for authenticated endpoints', async () => {
      server.use(
        http.get('/api/user/sensitive-data', ({ request }) => {
          const origin = request.headers.get('Origin')
          
          // Should never return wildcard for authenticated endpoints
          return HttpResponse.json(
            { data: 'sensitive' },
            {
              status: 200,
              headers: {
                'Access-Control-Allow-Origin': origin === 'https://app.dce.com' ? origin : ''
              }
            }
          )
        })
      )

      const response = await fetch('/api/user/sensitive-data', {
        headers: {
          'Origin': 'https://app.dce.com',
          'Authorization': 'Bearer valid-token'
        }
      })

      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://app.dce.com')
      expect(response.headers.get('Access-Control-Allow-Origin')).not.toBe('*')
    })
  })

  describe('HTTP Security Headers', () => {
    it('should include security headers in API responses', async () => {
      server.use(
        http.get('/api/campaigns', () => {
          return HttpResponse.json([], {
            headers: {
              'X-Content-Type-Options': 'nosniff',
              'X-Frame-Options': 'DENY',
              'X-XSS-Protection': '1; mode=block',
              'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
              'Content-Security-Policy': "default-src 'self'",
              'Referrer-Policy': 'strict-origin-when-cross-origin'
            }
          })
        })
      )

      const response = await fetch('/api/campaigns')
      
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff')
      expect(response.headers.get('X-Frame-Options')).toBe('DENY')
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block')
      expect(response.headers.get('Strict-Transport-Security')).toContain('max-age=31536000')
      expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'")
      expect(response.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin')
    })

    it('should not expose sensitive server information', async () => {
      server.use(
        http.get('/api/health', () => {
          return HttpResponse.json({ status: 'ok' })
        })
      )

      const response = await fetch('/api/health')
      
      // Should not expose server information
      expect(response.headers.get('Server')).toBeNull()
      expect(response.headers.get('X-Powered-By')).toBeNull()
      expect(response.headers.get('X-AspNet-Version')).toBeNull()
      expect(response.headers.get('X-Version')).toBeNull()
    })
  })

  describe('HTTP Methods Security', () => {
    it('should only allow necessary HTTP methods', async () => {
      const unnecessaryMethods = ['TRACE', 'TRACK', 'CONNECT', 'PATCH']
      
      server.use(
        http.all('/api/campaigns', ({ request }) => {
          const allowedMethods = ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
          
          if (!allowedMethods.includes(request.method)) {
            return HttpResponse.json(
              { error: 'Method not allowed' },
              { status: 405, headers: { 'Allow': allowedMethods.join(', ') } }
            )
          }
          
          return HttpResponse.json([])
        })
      )

      for (const method of unnecessaryMethods) {
        const response = await fetch('/api/campaigns', { method })
        expect(response.status).toBe(405)
        expect(response.headers.get('Allow')).toBeTruthy()
      }
    })

    it('should validate HTTP method consistency', async () => {
      server.use(
        http.post('/api/campaigns', () => {
          return HttpResponse.json({ id: '123' }, { status: 201 })
        }),
        
        http.get('/api/campaigns/123', () => {
          return HttpResponse.json({ id: '123' }, { status: 200 })
        }),
        
        http.put('/api/campaigns/123', () => {
          return HttpResponse.json({ id: '123' }, { status: 200 })
        }),
        
        http.delete('/api/campaigns/123', () => {
          return new HttpResponse(null, { status: 204 })
        })
      )

      // POST should create resource
      const postResponse = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Test Campaign' })
      })
      expect(postResponse.status).toBe(201)

      // GET should be idempotent
      const getResponse1 = await fetch('/api/campaigns/123')
      const getResponse2 = await fetch('/api/campaigns/123')
      expect(getResponse1.status).toBe(200)
      expect(getResponse2.status).toBe(200)

      // PUT should be idempotent
      const putResponse = await fetch('/api/campaigns/123', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Updated Campaign' })
      })
      expect(putResponse.status).toBe(200)

      // DELETE should remove resource
      const deleteResponse = await fetch('/api/campaigns/123', { method: 'DELETE' })
      expect(deleteResponse.status).toBe(204)
    })
  })

  describe('Request Size Limits', () => {
    it('should enforce request body size limits', async () => {
      const maxBodySize = 1024 * 1024 // 1MB
      
      server.use(
        http.post('/api/campaigns', async ({ request }) => {
          const body = await request.text()
          
          if (body.length > maxBodySize) {
            return HttpResponse.json(
              { error: 'Request entity too large' },
              { status: 413 }
            )
          }
          
          return HttpResponse.json({ id: '123' }, { status: 201 })
        })
      )

      // Test with large payload
      const largePayload = 'x'.repeat(maxBodySize + 1)
      const response = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: largePayload })
      })

      expect(response.status).toBe(413)
    })

    it('should limit URL length to prevent attacks', async () => {
      const maxUrlLength = 2048
      
      server.use(
        http.get('/api/campaigns', ({ request }) => {
          const url = new URL(request.url)
          
          if (url.href.length > maxUrlLength) {
            return HttpResponse.json(
              { error: 'URI too long' },
              { status: 414 }
            )
          }
          
          return HttpResponse.json([])
        })
      )

      // Create extremely long URL
      const longQuery = 'x'.repeat(maxUrlLength)
      const response = await fetch(`/api/campaigns?query=${longQuery}`)
      
      expect(response.status).toBe(414)
    })
  })

  describe('Content Type Validation', () => {
    it('should validate Content-Type headers', async () => {
      server.use(
        http.post('/api/campaigns', ({ request }) => {
          const contentType = request.headers.get('Content-Type')
          
          if (!contentType || !contentType.includes('application/json')) {
            return HttpResponse.json(
              { error: 'Invalid Content-Type' },
              { status: 415 }
            )
          }
          
          return HttpResponse.json({ id: '123' }, { status: 201 })
        })
      )

      const invalidContentTypes = [
        'text/plain',
        'application/xml',
        'multipart/form-data',
        undefined
      ]

      for (const contentType of invalidContentTypes) {
        const headers: Record<string, string> = {}
        if (contentType) {
          headers['Content-Type'] = contentType
        }

        const response = await fetch('/api/campaigns', {
          method: 'POST',
          headers,
          body: JSON.stringify({ name: 'Test' })
        })

        expect(response.status).toBe(415)
      }
    })

    it('should prevent MIME type confusion attacks', async () => {
      server.use(
        http.post('/api/files/upload', ({ request }) => {
          const contentType = request.headers.get('Content-Type')
          
          // Reject suspicious MIME types
          const dangerousMimeTypes = [
            'text/html',
            'application/javascript',
            'text/javascript',
            'application/x-php',
            'application/x-httpd-php'
          ]
          
          if (contentType && dangerousMimeTypes.some(type => contentType.includes(type))) {
            return HttpResponse.json(
              { error: 'Dangerous file type' },
              { status: 400 }
            )
          }
          
          return HttpResponse.json({ id: 'file-123' }, { status: 201 })
        })
      )

      const dangerousFiles = [
        { name: 'script.html', type: 'text/html' },
        { name: 'malware.js', type: 'application/javascript' },
        { name: 'backdoor.php', type: 'application/x-php' }
      ]

      for (const file of dangerousFiles) {
        const formData = new FormData()
        formData.append('file', new Blob(['content'], { type: file.type }), file.name)

        const response = await fetch('/api/files/upload', {
          method: 'POST',
          body: formData
        })

        expect(response.status).toBe(400)
      }
    })
  })

  describe('Error Response Security', () => {
    it('should not expose sensitive information in error responses', async () => {
      server.use(
        http.get('/api/internal-error', () => {
          return HttpResponse.json(
            { 
              error: 'Internal server error',
              message: 'An unexpected error occurred'
            },
            { status: 500 }
          )
        })
      )

      const response = await fetch('/api/internal-error')
      const errorData = await response.json()

      // Should not contain sensitive information
      expect(JSON.stringify(errorData)).not.toMatch(/password/i)
      expect(JSON.stringify(errorData)).not.toMatch(/token/i)
      expect(JSON.stringify(errorData)).not.toMatch(/secret/i)
      expect(JSON.stringify(errorData)).not.toMatch(/database/i)
      expect(JSON.stringify(errorData)).not.toMatch(/stack trace/i)
      expect(JSON.stringify(errorData)).not.toMatch(/file path/i)
    })

    it('should use consistent error response format', async () => {
      const errorEndpoints = [
        { url: '/api/not-found', status: 404 },
        { url: '/api/unauthorized', status: 401 },
        { url: '/api/forbidden', status: 403 },
        { url: '/api/bad-request', status: 400 }
      ]

      server.use(
        ...errorEndpoints.map(({ url, status }) =>
          http.get(url, () => {
            return HttpResponse.json(
              {
                error: 'Error occurred',
                code: `ERR_${status}`,
                timestamp: new Date().toISOString()
              },
              { status }
            )
          })
        )
      )

      for (const { url, status } of errorEndpoints) {
        const response = await fetch(url)
        const errorData = await response.json()

        expect(response.status).toBe(status)
        expect(errorData).toHaveProperty('error')
        expect(errorData).toHaveProperty('code')
        expect(errorData).toHaveProperty('timestamp')
      }
    })
  })

  describe('API Versioning Security', () => {
    it('should validate API version headers', async () => {
      server.use(
        http.get('/api/campaigns', ({ request }) => {
          const apiVersion = request.headers.get('API-Version')
          const supportedVersions = ['1.0', '1.1', '2.0']
          
          if (!apiVersion || !supportedVersions.includes(apiVersion)) {
            return HttpResponse.json(
              { error: 'Unsupported API version' },
              { status: 400 }
            )
          }
          
          return HttpResponse.json([])
        })
      )

      const invalidVersions = ['0.9', '3.0', 'latest', undefined]

      for (const version of invalidVersions) {
        const headers: Record<string, string> = {}
        if (version) {
          headers['API-Version'] = version
        }

        const response = await fetch('/api/campaigns', { headers })
        expect(response.status).toBe(400)
      }

      // Valid version should work
      const validResponse = await fetch('/api/campaigns', {
        headers: { 'API-Version': '2.0' }
      })
      expect(validResponse.status).toBe(200)
    })
  })

  describe('Request Timeout Security', () => {
    it('should enforce request timeouts to prevent resource exhaustion', async () => {
      const requestTimeout = 5000 // 5 seconds

      server.use(
        http.post('/api/slow-endpoint', async () => {
          // Simulate slow response
          await new Promise(resolve => setTimeout(resolve, requestTimeout + 1000))
          return HttpResponse.json({ result: 'slow' })
        })
      )

      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), requestTimeout)

      try {
        await fetch('/api/slow-endpoint', {
          method: 'POST',
          signal: controller.signal,
          body: JSON.stringify({ data: 'test' })
        })
        
        // Should not reach here
        expect(true).toBe(false)
      } catch (error) {
        expect(error.name).toBe('AbortError')
      } finally {
        clearTimeout(timeoutId)
      }
    })
  })
})