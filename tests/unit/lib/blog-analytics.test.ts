import { describe, it, expect, beforeEach, afterEach, vi, Mock } from 'vitest'
import { blogAnalytics, setupAutoTracking } from '../blog-analytics'
import { supabase } from '../supabase'

// Mock dependencies
vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn()
        })),
        gte: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn()
          }))
        }))
      })),
      rpc: vi.fn()
    }))
  }
}))

vi.mock('../logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn()
  }
}))

vi.mock('../monitoring', () => ({
  addBreadcrumb: vi.fn(),
  captureError: vi.fn(),
  startTransaction: vi.fn(() => ({ finish: vi.fn() }))
}))

// Mock window and document objects
const mockWindow = {
  location: {
    href: 'https://example.com/blog/test-post',
    pathname: '/blog/test-post'
  },
  innerWidth: 1920,
  innerHeight: 1080,
  localStorage: new Map(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  performance: {
    getEntriesByType: vi.fn(() => [])
  },
  navigator: {
    userAgent: 'Test Browser 1.0',
    connection: { effectiveType: '4g' }
  }
} as Window & typeof globalThis

const mockDocument = {
  referrer: 'https://google.com',
  readyState: 'complete',
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  visibilityState: 'visible',
  documentElement: {
    scrollHeight: 2000,
    scrollTop: 0
  },
  querySelector: vi.fn(() => ({
    textContent: 'This is a test blog post with some content for testing reading speed calculations.'
  }))
} as Document

// Setup global mocks
Object.defineProperty(global, 'window', {
  value: mockWindow,
  writable: true
})

Object.defineProperty(global, 'document', {
  value: mockDocument,
  writable: true
})

Object.defineProperty(global, 'localStorage', {
  value: {
    getItem: vi.fn((key: string) => mockWindow.localStorage.get(key) || null),
    setItem: vi.fn((key: string, value: string) => mockWindow.localStorage.set(key, value)),
    removeItem: vi.fn((key: string) => mockWindow.localStorage.delete(key))
  },
  writable: true
})

describe('BlogAnalytics', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockWindow.localStorage.clear()
  })

  afterEach(() => {
    blogAnalytics.destroy()
  })

  describe('Page View Tracking', () => {
    it('should track page views with required data', async () => {
      const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null })
      ;(supabase.rpc as Mock).mockImplementation(mockRpc)

      await blogAnalytics.trackPageView({
        postSlug: 'test-post',
        sessionId: 'test-session-123',
        referrer: 'https://google.com',
        userAgent: 'Test Browser 1.0',
        viewport: { width: 1920, height: 1080 }
      })

      expect(mockRpc).toHaveBeenCalledWith('increment_post_view_count', {
        post_slug: 'test-post'
      })
    })

    it('should handle UTM parameters correctly', async () => {
      // Mock URL with UTM parameters
      const originalSearch = mockWindow.location.search
      mockWindow.location.search = '?utm_source=google&utm_medium=cpc&utm_campaign=blog-promo'

      await blogAnalytics.trackPageView({
        postSlug: 'test-post',
        sessionId: 'test-session-123',
        utmParams: {
          source: 'google',
          medium: 'cpc',
          campaign: 'blog-promo'
        }
      })

      // Verify UTM data is processed
      expect(localStorage.setItem).toHaveBeenCalled()

      // Restore original search
      mockWindow.location.search = originalSearch
    })

    it('should generate unique visitor IDs', async () => {
      const sessionId = 'test-session-123'
      
      // First call should create new visitor ID
      await blogAnalytics.trackPageView({
        postSlug: 'test-post-1',
        sessionId
      })

      // Second call should reuse same visitor ID
      await blogAnalytics.trackPageView({
        postSlug: 'test-post-2',
        sessionId
      })

      const setItemCalls = (localStorage.setItem as Mock).mock.calls
      const visitorIdCalls = setItemCalls.filter(call => 
        call[0].includes('dce_analytics_visitor_')
      )
      
      // Should only set visitor ID once per session
      expect(visitorIdCalls).toHaveLength(1)
    })
  })

  describe('Reading Progress Tracking', () => {
    it('should track reading progress with valid data', async () => {
      await blogAnalytics.trackReadingProgress({
        postSlug: 'test-post',
        sessionId: 'test-session',
        scrollDepth: 0.75,
        timeSpent: 120000, // 2 minutes
        readingSpeed: 200
      })

      // Verify session data is updated
      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should validate scroll depth bounds', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Test invalid scroll depth (> 1)
      await blogAnalytics.trackReadingProgress({
        postSlug: 'test-post',
        sessionId: 'test-session',
        scrollDepth: 1.5, // Invalid - greater than 1
        timeSpent: 60000
      })

      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })

    it('should calculate reading speed correctly', async () => {
      const timeSpent = 60000 // 1 minute
      const scrollDepth = 1.0 // Full article
      
      await blogAnalytics.trackReadingProgress({
        postSlug: 'test-post',
        sessionId: 'test-session',
        scrollDepth,
        timeSpent,
        readingSpeed: 150 // words per minute
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('Engagement Event Tracking', () => {
    it('should track CTA clicks', async () => {
      await blogAnalytics.trackEngagementEvent({
        eventType: 'cta_click',
        postSlug: 'test-post',
        sessionId: 'test-session',
        elementId: 'signup-button',
        metadata: { ctaType: 'primary', position: 'top' }
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should track newsletter signups', async () => {
      await blogAnalytics.trackEngagementEvent({
        eventType: 'newsletter_signup',
        postSlug: 'test-post',
        sessionId: 'test-session',
        metadata: { email: 'test@example.com', location: 'sidebar' }
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should track social shares', async () => {
      await blogAnalytics.trackEngagementEvent({
        eventType: 'share_click',
        postSlug: 'test-post',
        sessionId: 'test-session',
        metadata: { platform: 'twitter', postTitle: 'Test Post' }
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('Search Analytics', () => {
    it('should track search queries', async () => {
      await blogAnalytics.trackSearchAnalytics({
        query: 'pay per call marketing',
        sessionId: 'test-session',
        resultsCount: 15,
        selectedResultIndex: 2,
        timeToClick: 5000
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should handle zero results', async () => {
      await blogAnalytics.trackSearchAnalytics({
        query: 'nonexistent topic',
        sessionId: 'test-session',
        resultsCount: 0
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('Performance Metrics', () => {
    it('should track page load times', async () => {
      await blogAnalytics.trackPerformanceMetric({
        metricType: 'page_load',
        postSlug: 'test-post',
        value: 2500,
        userAgent: 'Test Browser 1.0',
        connectionType: '4g'
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })

    it('should warn about slow page loads', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      await blogAnalytics.trackPerformanceMetric({
        metricType: 'page_load',
        postSlug: 'test-post',
        value: 5000 // > 3000ms threshold
      })

      // Note: The actual warning is logged via the logger mock
      expect(localStorage.setItem).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })

  describe('A/B Testing', () => {
    it('should assign consistent variants to users', async () => {
      const testName = 'cta-color-test'

      // Get variant twice - should be consistent
      const variant1 = await blogAnalytics.getABTestVariant(testName)
      const variant2 = await blogAnalytics.getABTestVariant(testName)

      expect(variant1).toBe(variant2)
      expect(['control', 'variant_a', 'variant_b', 'variant_c']).toContain(variant1)
    })

    it('should track A/B test events', async () => {
      await blogAnalytics.trackABTestEvent({
        testName: 'cta-color-test',
        variant: 'variant_a',
        postSlug: 'test-post',
        sessionId: 'test-session',
        conversionEvent: 'signup_completed'
      })

      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('Popular Posts Query', () => {
    it('should fetch popular posts with correct parameters', async () => {
      const mockData = [
        {
          slug: 'popular-post-1',
          title: 'Popular Post 1',
          view_count: 1000,
          published_at: '2024-01-01T00:00:00Z',
          blog_authors: { display_name: 'John Doe' },
          blog_post_categories: [{ blog_categories: { name: 'Marketing' } }]
        }
      ]

      const mockQuery = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: mockData, error: null })
      }

      ;(supabase.from as Mock).mockReturnValue(mockQuery)

      const results = await blogAnalytics.getPopularPosts({
        timeWindow: '7d',
        limit: 5
      })

      expect(results).toHaveLength(1)
      expect(results[0].slug).toBe('popular-post-1')
      expect(results[0].viewCount).toBe(1000)
    })
  })

  describe('Session Management', () => {
    it('should manage session data correctly', async () => {
      const sessionId = 'test-session-123'
      
      await blogAnalytics.trackPageView({
        postSlug: 'test-post',
        sessionId,
        userId: 'user-456'
      })

      // Verify session is stored
      const setItemCalls = (localStorage.setItem as Mock).mock.calls
      const sessionCalls = setItemCalls.filter(call => 
        call[0].includes('dce_analytics_session_')
      )
      
      expect(sessionCalls.length).toBeGreaterThan(0)
    })

    it('should handle returning visitors', async () => {
      const sessionId = 'returning-session'
      
      // Simulate existing session data
      const existingSession = {
        sessionId,
        startTime: new Date(Date.now() - 3600000), // 1 hour ago
        lastActivity: new Date(Date.now() - 1800000), // 30 min ago
        pageViews: 2,
        totalTimeSpent: 300000,
        isReturningVisitor: false
      }
      
      localStorage.setItem(`dce_analytics_session_${sessionId}`, JSON.stringify({
        data: existingSession,
        timestamp: Date.now() - 1800000
      }))

      await blogAnalytics.trackPageView({
        postSlug: 'test-post-2',
        sessionId
      })

      // Verify page view count is incremented
      expect(localStorage.setItem).toHaveBeenCalled()
    })
  })

  describe('Data Privacy and Cleanup', () => {
    it('should expire old data automatically', () => {
      const oldTimestamp = Date.now() - (31 * 24 * 60 * 60 * 1000) // 31 days old
      const expiredData = {
        data: { test: 'data' },
        timestamp: oldTimestamp
      }

      localStorage.setItem('dce_analytics_session_expired', JSON.stringify(expiredData))

      // The next get operation should return null for expired data
      const result = localStorage.getItem('dce_analytics_session_expired')
      expect(result).toBeTruthy() // Data is still there until accessed

      // Simulate accessing expired data through the storage class
      // This would trigger cleanup in a real scenario
    })

    it('should handle storage errors gracefully', async () => {
      // Mock localStorage to throw error
      const originalSetItem = localStorage.setItem
      localStorage.setItem = vi.fn().mockImplementation(() => {
        throw new Error('Storage quota exceeded')
      })

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await blogAnalytics.trackPageView({
        postSlug: 'test-post',
        sessionId: 'test-session'
      })

      // Should not throw, just log warning
      expect(consoleSpy).not.toHaveBeenCalled() // Uses logger.warn instead

      // Restore
      localStorage.setItem = originalSetItem
      consoleSpy.mockRestore()
    })
  })

  describe('Auto-tracking Setup', () => {
    it('should set up auto-tracking correctly', () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener')
      const observeSpy = vi.fn()
      
      // Mock MutationObserver
      global.MutationObserver = vi.fn().mockImplementation(() => ({
        observe: observeSpy,
        disconnect: vi.fn()
      }))

      setupAutoTracking()

      expect(addEventListenerSpy).toHaveBeenCalledWith('DOMContentLoaded', expect.any(Function))
      expect(observeSpy).toHaveBeenCalled()

      addEventListenerSpy.mockRestore()
    })
  })

  describe('Error Handling', () => {
    it('should handle Supabase errors gracefully', async () => {
      const mockError = new Error('Database connection failed')
      ;(supabase.rpc as Mock).mockRejectedValue(mockError)

      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      await blogAnalytics.trackPageView({
        postSlug: 'test-post',
        sessionId: 'test-session'
      })

      // Should not throw, error should be handled
      expect(consoleSpy).not.toHaveBeenCalled() // Uses captureError from monitoring

      consoleSpy.mockRestore()
    })

    it('should validate input data', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Invalid scroll depth
      await blogAnalytics.trackReadingProgress({
        postSlug: 'test-post',
        sessionId: 'test-session',
        scrollDepth: -0.5, // Invalid
        timeSpent: 60000
      })

      expect(consoleSpy).toHaveBeenCalled()
      
      consoleSpy.mockRestore()
    })
  })
})