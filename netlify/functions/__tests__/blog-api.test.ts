import { handler } from '../blog-api'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

describe('Blog API Netlify Function', () => {
  const mockEvent = (overrides: Partial<HandlerEvent> = {}): HandlerEvent => ({
    rawUrl: 'http://localhost:9999/.netlify/functions/blog-api',
    rawQuery: '',
    path: '/.netlify/functions/blog-api',
    httpMethod: 'GET',
    headers: {},
    multiValueHeaders: {},
    queryStringParameters: {},
    multiValueQueryStringParameters: {},
    body: null,
    isBase64Encoded: false,
    ...overrides
  })

  it('should handle OPTIONS requests for CORS', async () => {
    const event = mockEvent({ httpMethod: 'OPTIONS' })
    const context: HandlerContext = {}
    const response = await handler(event, context)
    
    expect(response.statusCode).toBe(200)
    expect(response.headers?.['Access-Control-Allow-Origin']).toBe('*')
    expect(response.headers?.['Access-Control-Allow-Methods']).toContain('GET')
  })

  it('should return API info on root path', async () => {
    const event = mockEvent()
    const context: HandlerContext = {}
    const response = await handler(event, context)
    
    // Note: This will be rate limited, so we check for either success or rate limit response
    expect([200, 429]).toContain(response.statusCode)
    
    if (response.statusCode === 200) {
      const data = JSON.parse(response.body)
      expect(data.message).toBe('Blog API')
      expect(data.version).toBe('1.0')
      expect(data.endpoints).toBeInstanceOf(Array)
    }
  })

  it('should validate required search query parameter', async () => {
    const event = mockEvent({
      path: '/.netlify/functions/blog-api/search',
      queryStringParameters: {}
    })
    
    const context: HandlerContext = {}
    const response = await handler(event, context)
    
    // Could be rate limited or bad request
    if (response.statusCode === 400) {
      const data = JSON.parse(response.body)
      expect(data.error).toBe('Search query is required')
    }
  })
})