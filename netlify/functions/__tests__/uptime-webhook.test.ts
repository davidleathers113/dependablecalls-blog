import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { handler } from '../uptime-webhook'
import type { HandlerEvent, HandlerContext } from '@netlify/functions'

// Mock Supabase
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      insert: vi.fn(() => Promise.resolve({ error: null }))
    }))
  }))
}))

// Mock fetch for Slack webhook
global.fetch = vi.fn()

describe('Uptime Webhook Handler', () => {
  const mockEvent = (options: Partial<HandlerEvent> = {}): HandlerEvent => ({
    rawUrl: 'https://example.com/.netlify/functions/uptime-webhook',
    rawQuery: '',
    path: '/.netlify/functions/uptime-webhook',
    httpMethod: 'POST',
    headers: {
      'content-type': 'application/json'
    },
    multiValueHeaders: {},
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    body: null,
    isBase64Encoded: false,
    ...options
  })

  beforeEach(() => {
    vi.clearAllMocks()
    // Reset environment variables
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key'
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/services/test'
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('GET requests', () => {
    it('should return 200 for webhook validation', async () => {
      const event = mockEvent({ httpMethod: 'GET' })
      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.status).toBe('ok')
      expect(body.service).toBe('blog-uptime-monitor')
      expect(body.timestamp).toBeDefined()
    })
  })

  describe('POST requests', () => {
    it('should reject non-POST methods', async () => {
      const event = mockEvent({ httpMethod: 'PUT' })
      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(405)
      expect(JSON.parse(response.body)).toEqual({ error: 'Method Not Allowed' })
    })

    it('should reject invalid payload', async () => {
      const event = mockEvent({
        body: JSON.stringify({ invalid: 'data' })
      })
      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(400)
      expect(JSON.parse(response.body)).toEqual({ error: 'Invalid payload' })
    })

    it('should process valid uptime webhook', async () => {
      const payload = {
        monitor: 'Blog Health Check',
        monitor_id: 'blog-health-123',
        status: 'up',
        response_time: 150,
        status_code: 200,
        url: 'https://dependablecalls.com/health'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.received).toBe(true)
      expect(body.status).toBe('success')
      expect(body.timestamp).toBeDefined()
    })

    it('should send Slack alert for critical status', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      } as Response)

      const payload = {
        monitor: 'Blog Health Check',
        status: 'down',
        error_message: 'Connection timeout',
        url: 'https://dependablecalls.com/health'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      await handler(event, {} as HandlerContext)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('Blog Monitoring Alert')
        })
      )
    })

    it('should send recovery alert for up status after incident', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      } as Response)

      const payload = {
        monitor: 'Blog Health Check',
        status: 'up',
        alert_type: 'incident_end',
        url: 'https://dependablecalls.com/health'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      await handler(event, {} as HandlerContext)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://hooks.slack.com/services/test',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('Blog Monitoring Recovery')
        })
      )
    })

    it('should not send alert for warning severity when ALERT_ON_WARNING is false', async () => {
      delete process.env.ALERT_ON_WARNING
      const mockFetch = vi.mocked(global.fetch)

      const payload = {
        monitor: 'Blog Performance',
        status: 'degraded',
        error_message: 'Slow response times'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      await handler(event, {} as HandlerContext)

      expect(mockFetch).not.toHaveBeenCalled()
    })

    it('should send alert for warning severity when ALERT_ON_WARNING is true', async () => {
      process.env.ALERT_ON_WARNING = 'true'
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      } as Response)

      const payload = {
        monitor: 'Blog Performance',
        status: 'degraded',
        error_message: 'Slow response times'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      await handler(event, {} as HandlerContext)

      expect(mockFetch).toHaveBeenCalled()
    })

    it('should handle missing Slack webhook URL gracefully', async () => {
      delete process.env.SLACK_WEBHOOK_URL
      const consoleSpy = vi.spyOn(console, 'warn')

      const payload = {
        monitor: 'Blog Health Check',
        status: 'down',
        error_message: 'Service unavailable'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        'SLACK_WEBHOOK_URL not configured, skipping Slack notification'
      )
    })

    it('should handle Slack webhook errors gracefully', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockRejectedValueOnce(new Error('Network error'))
      const consoleSpy = vi.spyOn(console, 'error')

      const payload = {
        monitor: 'Blog Health Check',
        status: 'down',
        error_message: 'Service unavailable'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(200)
      expect(consoleSpy).toHaveBeenCalledWith(
        'Error sending Slack alert:',
        expect.any(Error)
      )
    })

    it('should return 200 even on processing errors to prevent webhook retries', async () => {
      const event = mockEvent({
        body: 'invalid json'
      })

      const response = await handler(event, {} as HandlerContext)

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.received).toBe(true)
      expect(body.status).toBe('error')
      expect(body.error).toBeDefined()
    })
  })

  describe('Slack message formatting', () => {
    it('should format critical alert correctly', async () => {
      const mockFetch = vi.mocked(global.fetch)
      mockFetch.mockResolvedValueOnce({
        ok: true,
        statusText: 'OK'
      } as Response)

      const payload = {
        monitor: 'Blog API',
        status: 'down',
        error_message: '502 Bad Gateway',
        response_time: 5000,
        status_code: 502,
        url: 'https://dependablecalls.com/api/blog'
      }

      const event = mockEvent({
        body: JSON.stringify(payload)
      })

      await handler(event, {} as HandlerContext)

      const slackCall = mockFetch.mock.calls[0]
      const slackBody = JSON.parse(slackCall[1]?.body as string)

      expect(slackBody.text).toContain('🚨')
      expect(slackBody.text).toContain('Blog API')
      expect(slackBody.text).toContain('DOWN')
      expect(slackBody.attachments[0].color).toBe('#ff0000')
      expect(slackBody.attachments[0].fields).toContainEqual({
        title: 'Response Time',
        value: '5000ms',
        short: true
      })
      expect(slackBody.attachments[0].fields).toContainEqual({
        title: 'Status Code',
        value: '502',
        short: true
      })
    })
  })
})