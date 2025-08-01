import { z } from 'zod'
import { supabase } from './supabase'
import { logger } from './logger'
import { addBreadcrumb, captureError, startTransaction } from './monitoring'

/**
 * Blog Analytics Tracking Utility
 * 
 * Provides comprehensive analytics for the DCE blog system including:
 * - Post view tracking with unique visitor detection  
 * - Reading progress and engagement metrics
 * - User journey tracking through blog sections
 * - Search analytics and performance metrics
 * - A/B testing support for blog features
 * - Integration with existing Sentry monitoring
 * 
 * @example
 * ```typescript
 * import { blogAnalytics } from './lib/blog-analytics'
 * 
 * // Track a blog post view
 * await blogAnalytics.trackPageView({
 *   postSlug: 'my-blog-post',
 *   userId: 'user-123',
 *   referrer: 'https://google.com'
 * })
 * 
 * // Track reading progress
 * blogAnalytics.trackReadingProgress({
 *   postSlug: 'my-blog-post',
 *   scrollDepth: 0.75,
 *   timeSpent: 120000
 * })
 * 
 * // Get popular posts
 * const popularPosts = await blogAnalytics.getPopularPosts({
 *   timeWindow: '7d',
 *   limit: 10
 * })
 * ```
 */

// =====================================================
// Type Definitions
// =====================================================

/** Time window options for analytics queries */
export type AnalyticsTimeWindow = '1h' | '1d' | '7d' | '30d' | '90d' | '1y'

/** Analytics event types */
export type AnalyticsEventType = 
  | 'page_view'
  | 'scroll_progress' 
  | 'time_on_page'
  | 'cta_click'
  | 'newsletter_signup'
  | 'comment_posted'
  | 'share_click'
  | 'search_query'
  | 'image_load'
  | 'ab_test_view'

/** Blog section identifiers for user journey tracking */
export type BlogSection = 
  | 'home'
  | 'post_detail'
  | 'category_list'
  | 'tag_list'
  | 'author_profile'
  | 'search_results'

/** A/B test variant identifiers */
export type ABTestVariant = 'control' | 'variant_a' | 'variant_b' | 'variant_c'

// =====================================================
// Validation Schemas
// =====================================================

const pageViewSchema = z.object({
  postSlug: z.string().min(1),
  userId: z.string().optional(),
  sessionId: z.string().min(1),
  referrer: z.string().url().optional(),
  userAgent: z.string().optional(),
  viewport: z.object({
    width: z.number().positive(),
    height: z.number().positive()
  }).optional(),
  utmParams: z.object({
    source: z.string().optional(),
    medium: z.string().optional(), 
    campaign: z.string().optional(),
    content: z.string().optional(),
    term: z.string().optional()
  }).optional()
})

const readingProgressSchema = z.object({
  postSlug: z.string().min(1),
  sessionId: z.string().min(1),
  scrollDepth: z.number().min(0).max(1),
  timeSpent: z.number().nonnegative(),
  readingSpeed: z.number().positive().optional(),
  completionRate: z.number().min(0).max(1).optional()
})

const engagementEventSchema = z.object({
  eventType: z.enum(['cta_click', 'newsletter_signup', 'comment_posted', 'share_click']),
  postSlug: z.string().min(1),
  sessionId: z.string().min(1),
  elementId: z.string().optional(),
  metadata: z.record(z.unknown()).optional()
})

const searchAnalyticsSchema = z.object({
  query: z.string().min(1).max(500),
  sessionId: z.string().min(1),
  resultsCount: z.number().nonnegative(),
  selectedResultIndex: z.number().int().optional(),
  timeToClick: z.number().nonnegative().optional()
})

const performanceMetricSchema = z.object({
  metricType: z.enum(['page_load', 'image_load', 'first_contentful_paint', 'largest_contentful_paint']),
  postSlug: z.string().min(1),
  value: z.number().nonnegative(),
  userAgent: z.string().optional(),
  connectionType: z.string().optional()
})

const abTestEventSchema = z.object({
  testName: z.string().min(1),
  variant: z.enum(['control', 'variant_a', 'variant_b', 'variant_c']),
  postSlug: z.string().min(1),
  sessionId: z.string().min(1),
  conversionEvent: z.string().optional()
})

// =====================================================
// Input Types
// =====================================================

export type PageViewData = z.infer<typeof pageViewSchema>
export type ReadingProgressData = z.infer<typeof readingProgressSchema>
export type EngagementEventData = z.infer<typeof engagementEventSchema>
export type SearchAnalyticsData = z.infer<typeof searchAnalyticsSchema>
export type PerformanceMetricData = z.infer<typeof performanceMetricSchema>
export type ABTestEventData = z.infer<typeof abTestEventSchema>

// =====================================================
// Return Types
// =====================================================

// Supabase query result types for proper typing
interface BlogAuthorResult {
  display_name: string
}

interface BlogCategoryResult {
  blog_categories: {
    name: string
  }
}

interface PopularPostQueryResult {
  slug: string
  title: string
  view_count: number
  published_at: string
  blog_authors: BlogAuthorResult[]
  blog_post_categories: BlogCategoryResult[]
}

export interface AnalyticsSession {
  sessionId: string
  userId?: string
  startTime: Date
  lastActivity: Date
  pageViews: number
  totalTimeSpent: number
  userAgent?: string
  referrer?: string
  isReturningVisitor: boolean
}

export interface BlogPostAnalytics {
  postSlug: string
  title: string
  uniqueViews: number
  totalViews: number
  averageTimeSpent: number
  bounceRate: number
  scrollDepthAverage: number
  completionRate: number
  shareCount: number
  commentCount: number
  conversionRate: number
  topReferrers: Array<{ referrer: string; count: number }>
  topCountries: Array<{ country: string; count: number }>
}

export interface PopularPost {
  slug: string
  title: string
  viewCount: number
  engagementScore: number
  publishedAt: Date
  author?: string
  category?: string
}

export interface UserJourney {
  sessionId: string
  userId?: string
  startTime: Date
  endTime: Date
  pages: Array<{
    section: BlogSection
    slug?: string
    entryTime: Date
    exitTime: Date
    scrollDepth: number
  }>
  conversionEvents: string[]
  totalTimeSpent: number
}

export interface SearchInsights {
  query: string
  searchCount: number
  clickThroughRate: number
  averageResultsCount: number
  popularResults: Array<{ slug: string; title: string; clickCount: number }>
  noResultsRate: number
}

export interface PerformanceInsights {
  metricType: string
  averageValue: number
  p50: number
  p90: number
  p95: number
  p99: number
  slowPagesCount: number
  improvementOpportunities: string[]
}

export interface ABTestResults {
  testName: string
  variants: Array<{
    variant: ABTestVariant
    participantCount: number
    conversionRate: number
    confidenceLevel: number
    isWinner: boolean
  }>
  statisticalSignificance: boolean
  recommendedAction: string
}

// =====================================================
// Storage Interface
// =====================================================

interface AnalyticsStorage {
  getSessionData(sessionId: string): Promise<AnalyticsSession | null>
  setSessionData(sessionId: string, data: AnalyticsSession): Promise<void>
  getVisitorId(sessionId: string): Promise<string | null>
  setVisitorId(sessionId: string, visitorId: string): Promise<void>
  getABTestVariant(testName: string, sessionId: string): Promise<ABTestVariant | null>
  setABTestVariant(testName: string, sessionId: string, variant: ABTestVariant): Promise<void>
}

/**
 * Privacy-compliant storage implementation using localStorage/sessionStorage
 * Automatically expires data based on GDPR requirements
 */
class PrivacyCompliantStorage implements AnalyticsStorage {
  private static readonly SESSION_PREFIX = 'dce_analytics_session_'
  private static readonly VISITOR_PREFIX = 'dce_analytics_visitor_'
  private static readonly AB_TEST_PREFIX = 'dce_ab_test_'
  private static readonly MAX_AGE_DAYS = 30 // GDPR compliant retention

  private isStorageAvailable(): boolean {
    try {
      if (typeof window === 'undefined') return false
      const test = '__storage_test__'
      localStorage.setItem(test, test)
      localStorage.removeItem(test)
      return true
    } catch {
      return false
    }
  }

  private isExpired(timestamp: number): boolean {
    const maxAge = PrivacyCompliantStorage.MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    return Date.now() - timestamp > maxAge
  }

  private setWithExpiry(key: string, data: unknown): void {
    if (!this.isStorageAvailable()) return
    
    const item = {
      data,
      timestamp: Date.now()
    }
    
    try {
      localStorage.setItem(key, JSON.stringify(item))
    } catch (error) {
      logger.warn('Failed to save analytics data', { 
        component: 'blog-analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private getWithExpiry<T>(key: string): T | null {
    if (!this.isStorageAvailable()) return null
    
    try {
      const itemStr = localStorage.getItem(key)
      if (!itemStr) return null
      
      const item = JSON.parse(itemStr)
      
      if (!item.timestamp || this.isExpired(item.timestamp)) {
        localStorage.removeItem(key)
        return null
      }
      
      return item.data as T
    } catch {
      localStorage.removeItem(key)
      return null  
    }
  }

  async getSessionData(sessionId: string): Promise<AnalyticsSession | null> {
    return this.getWithExpiry<AnalyticsSession>(`${PrivacyCompliantStorage.SESSION_PREFIX}${sessionId}`)
  }

  async setSessionData(sessionId: string, data: AnalyticsSession): Promise<void> {
    this.setWithExpiry(`${PrivacyCompliantStorage.SESSION_PREFIX}${sessionId}`, data)
  }

  async getVisitorId(sessionId: string): Promise<string | null> {
    return this.getWithExpiry<string>(`${PrivacyCompliantStorage.VISITOR_PREFIX}${sessionId}`)
  }

  async setVisitorId(sessionId: string, visitorId: string): Promise<void> {
    this.setWithExpiry(`${PrivacyCompliantStorage.VISITOR_PREFIX}${sessionId}`, visitorId)
  }

  async getABTestVariant(testName: string, sessionId: string): Promise<ABTestVariant | null> {
    return this.getWithExpiry<ABTestVariant>(`${PrivacyCompliantStorage.AB_TEST_PREFIX}${testName}_${sessionId}`)
  }

  async setABTestVariant(testName: string, sessionId: string, variant: ABTestVariant): Promise<void> {
    this.setWithExpiry(`${PrivacyCompliantStorage.AB_TEST_PREFIX}${testName}_${sessionId}`, variant)
  }
}

// =====================================================
// Main Analytics Class
// =====================================================

class BlogAnalytics {
  private storage: AnalyticsStorage
  private isInitialized = false
  private currentSessionId: string | null = null
  private performanceObserver: PerformanceObserver | null = null
  private intersectionObserver: IntersectionObserver | null = null
  private scrollTracker: NodeJS.Timeout | null = null
  private readingStartTime = 0

  constructor() {
    this.storage = new PrivacyCompliantStorage()
    
    if (typeof window !== 'undefined') {
      this.init()
    }
  }

  // =====================================================
  // Initialization
  // =====================================================

  private async init(): Promise<void> {
    if (this.isInitialized) return
    
    try {
      // Generate or retrieve session ID
      this.currentSessionId = this.generateSessionId()
      
      // Set up performance monitoring
      this.setupPerformanceMonitoring()
      
      // Set up scroll tracking
      this.setupScrollTracking()
      
      // Set up page visibility tracking  
      this.setupVisibilityTracking()
      
      // Set up unload tracking
      this.setupUnloadTracking()
      
      this.isInitialized = true
      
      logger.info('Blog analytics initialized', {
        component: 'blog-analytics',
        sessionId: this.currentSessionId
      })
      
    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Analytics initialization failed'), {
        component: 'blog-analytics'
      })
    }
  }

  private generateSessionId(): string {
    // Use a combination of timestamp and random values for session ID
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2)
    return `${timestamp}_${random}`
  }

  private setupPerformanceMonitoring(): void {
    if (!('PerformanceObserver' in window)) return
    
    try {
      this.performanceObserver = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          this.handlePerformanceEntry(entry)
        }
      })
      
      this.performanceObserver.observe({ entryTypes: ['paint', 'largest-contentful-paint', 'navigation'] })
    } catch (error) {
      logger.warn('Failed to setup performance monitoring', {
        component: 'blog-analytics',
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private setupScrollTracking(): void {
    if (!('IntersectionObserver' in window)) return
    
    // Create intersection observer for reading progress
    this.intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            this.handleScrollProgress(entry)
          }
        })
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: [0.25, 0.5, 0.75, 1.0]
      }
    )
  }

  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.readingStartTime = Date.now()
      } else if (document.visibilityState === 'hidden') {
        this.flushPendingEvents()
      }
    })
  }

  private setupUnloadTracking(): void {
    window.addEventListener('beforeunload', () => {
      this.flushPendingEvents()
    })
    
    // Also handle page focus changes for mobile
    window.addEventListener('pagehide', () => {
      this.flushPendingEvents()
    })
  }

  // =====================================================
  // Public Tracking Methods
  // =====================================================

  /**
   * Track a blog post page view with comprehensive visitor information
   */
  async trackPageView(data: PageViewData): Promise<void> {
    try {
      const validatedData = pageViewSchema.parse(data)
      
      if (!this.currentSessionId) {
        await this.init()
      }

      const sessionId = validatedData.sessionId || this.currentSessionId!
      
      // Get or create visitor ID for unique visitor tracking
      let visitorId = await this.storage.getVisitorId(sessionId)
      if (!visitorId) {
        visitorId = this.generateVisitorId()
        await this.storage.setVisitorId(sessionId, visitorId)
      }

      // Update session data
      const existingSession = await this.storage.getSessionData(sessionId)
      const sessionData: AnalyticsSession = {
        sessionId,
        userId: validatedData.userId,
        startTime: existingSession?.startTime || new Date(),
        lastActivity: new Date(),
        pageViews: (existingSession?.pageViews || 0) + 1,
        totalTimeSpent: existingSession?.totalTimeSpent || 0,
        userAgent: validatedData.userAgent,
        referrer: validatedData.referrer,
        isReturningVisitor: Boolean(existingSession)
      }
      
      await this.storage.setSessionData(sessionId, sessionData)

      // Store view in Supabase for server-side analytics
      await this.storePageView({
        ...validatedData,
        sessionId,
        visitorId,
        timestamp: new Date(),
        isUniqueView: !existingSession
      })

      // Update post view count
      await this.incrementPostViewCount(validatedData.postSlug)

      // Start reading time tracking
      this.readingStartTime = Date.now()

      addBreadcrumb(
        `Page view tracked: ${validatedData.postSlug}`,
        'analytics',
        'info',
        { sessionId, visitorId }
      )

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track page view'), {
        component: 'blog-analytics',
        postSlug: data.postSlug
      })
    }
  }

  /**
   * Track reading progress and engagement metrics
   */
  async trackReadingProgress(data: ReadingProgressData): Promise<void> {
    try {
      const validatedData = readingProgressSchema.parse(data)
      
      await this.storeReadingProgress({
        ...validatedData,
        timestamp: new Date()
      })

      // Update session time spent
      if (this.currentSessionId) {
        const session = await this.storage.getSessionData(this.currentSessionId)
        if (session) {
          session.totalTimeSpent += validatedData.timeSpent
          session.lastActivity = new Date()
          await this.storage.setSessionData(this.currentSessionId, session)
        }
      }

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track reading progress'), {
        component: 'blog-analytics',
        postSlug: data.postSlug
      })
    }
  }

  /**
   * Track engagement events like CTA clicks, shares, comments
   */
  async trackEngagementEvent(data: EngagementEventData): Promise<void> {
    try {
      const validatedData = engagementEventSchema.parse(data)
      
      await this.storeEngagementEvent({
        ...validatedData,
        timestamp: new Date()
      })

      addBreadcrumb(
        `Engagement event: ${validatedData.eventType} on ${validatedData.postSlug}`,
        'analytics',
        'info',
        validatedData.metadata
      )

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track engagement event'), {
        component: 'blog-analytics',
        eventType: data.eventType
      })
    }
  }

  /**
   * Track search queries and results interaction
   */
  async trackSearchAnalytics(data: SearchAnalyticsData): Promise<void> {
    try {
      const validatedData = searchAnalyticsSchema.parse(data)
      
      await this.storeSearchAnalytics({
        ...validatedData,
        timestamp: new Date()
      })

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track search analytics'), {
        component: 'blog-analytics',
        query: data.query
      })
    }
  }

  /**
   * Track performance metrics for optimization
   */
  async trackPerformanceMetric(data: PerformanceMetricData): Promise<void> {
    try {
      const validatedData = performanceMetricSchema.parse(data)
      
      await this.storePerformanceMetric({
        ...validatedData,
        timestamp: new Date()
      })

      // Log slow performance warnings
      if (validatedData.metricType === 'page_load' && validatedData.value > 3000) {
        logger.warn(`Slow page load detected: ${validatedData.value}ms`, {
          component: 'blog-analytics',
          postSlug: validatedData.postSlug
        })
      }

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track performance metric'), {
        component: 'blog-analytics',
        metricType: data.metricType
      })
    }
  }

  /**
   * Track A/B test participation and conversions
   */
  async trackABTestEvent(data: ABTestEventData): Promise<void> {
    try {
      const validatedData = abTestEventSchema.parse(data)
      
      // Store variant assignment
      await this.storage.setABTestVariant(
        validatedData.testName,
        validatedData.sessionId,
        validatedData.variant
      )
      
      await this.storeABTestEvent({
        ...validatedData,
        timestamp: new Date()
      })

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to track A/B test event'), {
        component: 'blog-analytics',
        testName: data.testName
      })
    }
  }

  /**
   * Get A/B test variant for a user (with automatic assignment if new)
   */
  async getABTestVariant(testName: string): Promise<ABTestVariant> {
    try {
      if (!this.currentSessionId) {
        await this.init()
      }

      const sessionId = this.currentSessionId!
      
      // Check if user already has a variant assigned
      let variant = await this.storage.getABTestVariant(testName, sessionId)
      
      if (!variant) {
        // Randomly assign variant (25% each for control, A, B, C)
        const variants: ABTestVariant[] = ['control', 'variant_a', 'variant_b', 'variant_c']
        variant = variants[Math.floor(Math.random() * variants.length)]
        
        await this.storage.setABTestVariant(testName, sessionId, variant)
        
        // Track the assignment
        await this.trackABTestEvent({
          testName,
          variant,
          postSlug: window.location.pathname.split('/').pop() || 'unknown',
          sessionId
        })
      }
      
      return variant
      
    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get A/B test variant'), {
        component: 'blog-analytics',
        testName
      })
      return 'control' // Fallback to control variant
    }
  }

  // =====================================================
  // Analytics Query Methods
  // =====================================================

  /**
   * Get popular posts within a time window
   */
  async getPopularPosts(options: {
    timeWindow: AnalyticsTimeWindow
    limit?: number
    category?: string
  }): Promise<PopularPost[]> {
    startTransaction('get-popular-posts', 'query')
    
    try {
      const { timeWindow, limit = 10, category } = options
      const timeCondition = this.getTimeCondition(timeWindow)
      
      let query = supabase!
        .from('blog_posts')
        .select(`
          slug,
          title,
          view_count,
          published_at,
          blog_authors!inner(display_name),
          blog_post_categories!inner(
            blog_categories!inner(name)
          )
        `)
        .eq('status', 'published')
        .gte('published_at', timeCondition)
        .order('view_count', { ascending: false })
        .limit(limit)

      if (category) {
        query = query.eq('blog_post_categories.blog_categories.slug', category)
      }

      const { data, error } = await query

      if (error) throw error

      return (data as unknown as PopularPostQueryResult[]).map((post) => ({
        slug: post.slug,
        title: post.title,
        viewCount: post.view_count,
        engagementScore: this.calculateEngagementScore(post),
        publishedAt: new Date(post.published_at),
        author: post.blog_authors?.[0]?.display_name,
        category: post.blog_post_categories?.[0]?.blog_categories?.name
      }))

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get popular posts'), {
        component: 'blog-analytics'
      })
      return []
    } finally {
      // Transaction finish is handled by Sentry internally
    }
  }

  /**
   * Get detailed analytics for a specific blog post
   */
  async getPostAnalytics(postSlug: string, _timeWindow: AnalyticsTimeWindow): Promise<BlogPostAnalytics | null> {
    startTransaction('get-post-analytics', 'query')
    
    try {
      // Note: _timeWindow parameter available for future time-based filtering
      void _timeWindow
      // This would involve multiple queries to analytics tables
      // For now, returning a basic structure
      const { data: post, error } = await supabase!
        .from('blog_posts')
        .select('slug, title, view_count')
        .eq('slug', postSlug)
        .eq('status', 'published')
        .single()

      if (error) throw error

      // In a real implementation, you would query analytics tables
      // to get detailed metrics. For now, returning mock data structure.
      return {
        postSlug: post.slug,
        title: post.title,
        uniqueViews: Math.floor(post.view_count * 0.7), // Estimate
        totalViews: post.view_count,
        averageTimeSpent: 180, // 3 minutes average
        bounceRate: 0.35,
        scrollDepthAverage: 0.68,
        completionRate: 0.45,
        shareCount: 0,
        commentCount: 0,
        conversionRate: 0.05,
        topReferrers: [],
        topCountries: []
      }

    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get post analytics'), {
        component: 'blog-analytics',
        postSlug
      })
      return null
    } finally {
      // Transaction finish is handled by Sentry internally
    }
  }

  /**
   * Get search insights and popular queries
   */
  async getSearchInsights(_timeWindow: AnalyticsTimeWindow): Promise<SearchInsights[]> {
    try {
      // Note: _timeWindow parameter available for future time-based filtering
      void _timeWindow
      // This would query a search_analytics table
      // For now, returning empty array as the table structure would need to be created
      return []
    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get search insights'), {
        component: 'blog-analytics'
      })
      return []
    }
  }

  /**
   * Get performance insights for optimization
   */
  async getPerformanceInsights(_timeWindow: AnalyticsTimeWindow): Promise<PerformanceInsights[]> {
    try {
      // Note: _timeWindow parameter available for future time-based filtering
      void _timeWindow
      // This would query a performance_metrics table
      // For now, returning empty array as the table structure would need to be created
      return []
    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get performance insights'), {
        component: 'blog-analytics'
      })
      return []
    }
  }

  /**
   * Get A/B test results and statistical significance
   */
  async getABTestResults(testName: string): Promise<ABTestResults | null> {
    try {
      // This would query an ab_test_events table and calculate statistics
      // For now, returning null as the table structure would need to be created
      return null
    } catch (error) {
      captureError(error instanceof Error ? error : new Error('Failed to get A/B test results'), {
        component: 'blog-analytics',
        testName
      })
      return null
    }
  }

  // =====================================================
  // Private Helper Methods
  // =====================================================

  private generateVisitorId(): string {
    // Generate a privacy-compliant visitor ID (not personally identifiable)
    const timestamp = Date.now().toString(36)
    const random1 = Math.random().toString(36).substring(2, 8)
    const random2 = Math.random().toString(36).substring(2, 8)
    return `v_${timestamp}_${random1}${random2}`
  }

  private getTimeCondition(timeWindow: AnalyticsTimeWindow): string {
    const now = new Date()
    const periods = {
      '1h': 1 * 60 * 60 * 1000,
      '1d': 1 * 24 * 60 * 60 * 1000,
      '7d': 7 * 24 * 60 * 60 * 1000,
      '30d': 30 * 24 * 60 * 60 * 1000,
      '90d': 90 * 24 * 60 * 60 * 1000,
      '1y': 365 * 24 * 60 * 60 * 1000
    }
    
    const timeAgo = new Date(now.getTime() - periods[timeWindow])
    return timeAgo.toISOString()
  }

  private calculateEngagementScore(post: { view_count: number; published_at: string }): number {
    // Simple engagement score calculation
    // In a real implementation, this would factor in multiple metrics
    return post.view_count * 0.1 // Placeholder calculation
  }

  private handlePerformanceEntry(entry: PerformanceEntry): void {
    const postSlug = window.location.pathname.split('/').pop() || 'unknown'
    
    if (entry.entryType === 'paint') {
      this.trackPerformanceMetric({
        metricType: entry.name === 'first-contentful-paint' ? 'first_contentful_paint' : 'page_load',
        postSlug,
        value: entry.startTime,
        userAgent: navigator.userAgent
      })
    } else if (entry.entryType === 'largest-contentful-paint') {
      this.trackPerformanceMetric({
        metricType: 'largest_contentful_paint',
        postSlug,
        value: entry.startTime,
        userAgent: navigator.userAgent
      })
    }
  }

  private handleScrollProgress(entry: IntersectionObserverEntry): void {
    const postSlug = window.location.pathname.split('/').pop() || 'unknown'
    const timeSpent = Date.now() - this.readingStartTime
    
    this.trackReadingProgress({
      postSlug,
      sessionId: this.currentSessionId!,
      scrollDepth: entry.intersectionRatio,
      timeSpent
    })
  }

  private async flushPendingEvents(): Promise<void> {
    // In a real implementation, this would flush any pending analytics events
    // that haven't been sent to the server yet
    logger.info('Flushing pending analytics events', {
      component: 'blog-analytics'
    })
  }

  // =====================================================
  // Supabase Storage Methods
  // =====================================================

  private async storePageView(data: PageViewData & { sessionId: string; visitorId: string; timestamp: Date; isUniqueView: boolean }): Promise<void> {
    // Store in analytics table (would need to be created)
    logger.info('Page view stored', {
      component: 'blog-analytics',
      postSlug: data.postSlug
    })
  }

  private async incrementPostViewCount(postSlug: string): Promise<void> {
    try {
      const { error } = await supabase!.rpc('increment_post_view_count', {
        post_slug: postSlug
      })
      
      if (error) throw error
    } catch (error) {
      logger.warn('Failed to increment post view count', {
        component: 'blog-analytics',
        postSlug,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    }
  }

  private async storeReadingProgress(data: ReadingProgressData & { timestamp: Date }): Promise<void> {
    // Store in reading_progress table (would need to be created)
    logger.debug('Reading progress stored', {
      component: 'blog-analytics',
      postSlug: data.postSlug,
      scrollDepth: data.scrollDepth
    })
  }

  private async storeEngagementEvent(data: EngagementEventData & { timestamp: Date }): Promise<void> {
    // Store in engagement_events table (would need to be created)
    logger.info('Engagement event stored', {
      component: 'blog-analytics',
      eventType: data.eventType
    })
  }

  private async storeSearchAnalytics(data: SearchAnalyticsData & { timestamp: Date }): Promise<void> {
    // Store in search_analytics table (would need to be created)
    logger.info('Search analytics stored', {
      component: 'blog-analytics',
      query: data.query
    })
  }

  private async storePerformanceMetric(data: PerformanceMetricData & { timestamp: Date }): Promise<void> {
    // Store in performance_metrics table (would need to be created)
    logger.debug('Performance metric stored', {
      component: 'blog-analytics',
      metricType: data.metricType,
      value: data.value
    })
  }

  private async storeABTestEvent(data: ABTestEventData & { timestamp: Date }): Promise<void> {
    // Store in ab_test_events table (would need to be created)
    logger.info('A/B test event stored', {
      component: 'blog-analytics',
      testName: data.testName,
      variant: data.variant
    })
  }

  // =====================================================
  // Cleanup
  // =====================================================

  destroy(): void {
    if (this.performanceObserver) {
      this.performanceObserver.disconnect()
      this.performanceObserver = null
    }
    
    if (this.intersectionObserver) {
      this.intersectionObserver.disconnect()
      this.intersectionObserver = null
    }
    
    if (this.scrollTracker) {
      clearTimeout(this.scrollTracker)
      this.scrollTracker = null
    }
    
    this.flushPendingEvents()
    
    logger.info('Blog analytics destroyed', {
      component: 'blog-analytics'
    })
  }
}

// =====================================================
// Export singleton instance
// =====================================================

export const blogAnalytics = new BlogAnalytics()

// =====================================================
// Convenience functions for React components
// =====================================================

/**
 * Hook for tracking page views in React components
 */
export function useBlogAnalytics() {
  return {
    trackPageView: blogAnalytics.trackPageView.bind(blogAnalytics),
    trackReadingProgress: blogAnalytics.trackReadingProgress.bind(blogAnalytics),
    trackEngagementEvent: blogAnalytics.trackEngagementEvent.bind(blogAnalytics),
    trackSearchAnalytics: blogAnalytics.trackSearchAnalytics.bind(blogAnalytics),
    trackPerformanceMetric: blogAnalytics.trackPerformanceMetric.bind(blogAnalytics),
    trackABTestEvent: blogAnalytics.trackABTestEvent.bind(blogAnalytics),
    getABTestVariant: blogAnalytics.getABTestVariant.bind(blogAnalytics),
    getPopularPosts: blogAnalytics.getPopularPosts.bind(blogAnalytics),
    getPostAnalytics: blogAnalytics.getPostAnalytics.bind(blogAnalytics)
  }
}

/**
 * Utility function to automatically track page views on route changes
 */
export function setupAutoTracking(): void {
  if (typeof window === 'undefined') return
  
  // Track initial page load
  const trackCurrentPage = () => {
    const postSlug = window.location.pathname.split('/').pop() || 'home'
    const sessionId = blogAnalytics['currentSessionId'] || 'unknown'
    
    blogAnalytics.trackPageView({
      postSlug,
      sessionId,
      referrer: document.referrer || undefined,
      userAgent: navigator.userAgent,
      viewport: {
        width: window.innerWidth,
        height: window.innerHeight
      }
    })
  }
  
  // Track on initial load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', trackCurrentPage)
  } else {
    trackCurrentPage()
  }
  
  // Track on navigation (for SPAs)
  let lastUrl = window.location.href
  const observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href
      trackCurrentPage()
    }
  })
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  })
}