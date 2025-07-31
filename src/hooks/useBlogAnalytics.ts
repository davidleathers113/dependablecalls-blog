import React, { useEffect, useRef, useCallback } from 'react'
import { useAuth } from './useAuth'
import { useBlogAnalytics as useAnalyticsUtils } from '../lib/blog-analytics'
import type { 
  AnalyticsTimeWindow, 
  PopularPost, 
  BlogPostAnalytics,
  ABTestVariant 
} from '../lib/blog-analytics'

/**
 * React hook for blog analytics tracking and data retrieval
 * 
 * Provides easy-to-use methods for tracking user interactions
 * and retrieving analytics data in React components.
 * 
 * @example
 * ```typescript
 * function BlogPost({ slug }: { slug: string }) {
 *   const { trackPageView, trackEngagement } = useBlogAnalytics()
 *   
 *   useEffect(() => {
 *     trackPageView(slug)
 *   }, [slug, trackPageView])
 *   
 *   const handleCTAClick = () => {
 *     trackEngagement('cta_click', { elementId: 'signup-button' })
 *   }
 *   
 *   return (
 *     <div>
 *       <button onClick={handleCTAClick}>Sign Up</button>
 *     </div>
 *   )
 * }
 * ```
 */

interface UseBlogAnalyticsOptions {
  /** Auto-track page views on mount */
  autoTrack?: boolean
  /** Auto-track scroll progress */
  trackScrollProgress?: boolean
  /** Auto-track reading time */
  trackReadingTime?: boolean
  /** Enable performance monitoring */
  trackPerformance?: boolean
  /** Debounce delay for scroll tracking (ms) */
  scrollDebounceMs?: number
}

interface BlogAnalyticsHook {
  // Tracking methods
  trackPageView: (postSlug: string, additionalData?: Record<string, unknown>) => Promise<void>
  trackEngagement: (eventType: 'cta_click' | 'newsletter_signup' | 'comment_posted' | 'share_click', metadata?: Record<string, unknown>) => Promise<void>
  trackSearch: (query: string, resultsCount: number, selectedIndex?: number) => Promise<void>
  trackNewsletter: (email: string, location: string) => Promise<void>
  
  // A/B testing
  getABTestVariant: (testName: string) => Promise<ABTestVariant>
  trackConversion: (testName: string, conversionEvent: string) => Promise<void>
  
  // Analytics queries
  getPopularPosts: (timeWindow: AnalyticsTimeWindow, options?: { limit?: number; category?: string }) => Promise<PopularPost[]>
  getPostAnalytics: (postSlug: string, timeWindow: AnalyticsTimeWindow) => Promise<BlogPostAnalytics | null>
  
  // Utilities
  sessionId: string | null
  isTracking: boolean
}

export function useBlogAnalytics(
  postSlug?: string, 
  options: UseBlogAnalyticsOptions = {}
): BlogAnalyticsHook {
  const { user } = useAuth()
  const analytics = useAnalyticsUtils()
  
  const {
    autoTrack = true,
    trackScrollProgress = true,
    trackReadingTime = true,
    trackPerformance = true,
    scrollDebounceMs = 500
  } = options

  // Refs for tracking state
  const sessionIdRef = useRef<string | null>(null)
  const isTrackingRef = useRef(false)
  const scrollTimerRef = useRef<NodeJS.Timeout | null>(null)
  const readingStartTime = useRef<number>(0)
  const lastScrollDepth = useRef<number>(0)

  // Generate session ID on mount
  useEffect(() => {
    if (!sessionIdRef.current) {
      sessionIdRef.current = generateSessionId()
    }
  }, [])

  // Move trackPageView here temporarily to fix hoisting issue
  const trackPageViewTemp = useCallback(async (
    slug: string, 
    additionalData: Record<string, unknown> = {}
  ) => {
    if (!sessionIdRef.current) return

    try {
      isTrackingRef.current = true
      readingStartTime.current = Date.now()
      lastScrollDepth.current = 0

      const viewportSize = {
        width: window.innerWidth,
        height: window.innerHeight
      }

      // Extract UTM parameters from URL
      const urlParams = new URLSearchParams(window.location.search)
      const utmParams = {
        source: urlParams.get('utm_source') || undefined,
        medium: urlParams.get('utm_medium') || undefined,
        campaign: urlParams.get('utm_campaign') || undefined,
        content: urlParams.get('utm_content') || undefined,
        term: urlParams.get('utm_term') || undefined
      }

      await analytics.trackPageView({
        postSlug: slug,
        sessionId: sessionIdRef.current,
        userId: user?.id,
        referrer: document.referrer || undefined,
        userAgent: navigator.userAgent,
        viewport: viewportSize,
        utmParams,
        ...additionalData
      })
    } catch (error) {
      console.error('Failed to track page view:', error)
    }
  }, [analytics, user?.id])

  // Auto-track page view on mount
  useEffect(() => {
    if (autoTrack && postSlug && sessionIdRef.current) {
      trackPageViewTemp(postSlug)
    }
  }, [postSlug, autoTrack, trackPageViewTemp])

  // Set up scroll progress tracking
  useEffect(() => {
    if (!trackScrollProgress || !postSlug) return

    const handleScroll = () => {
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
      
      scrollTimerRef.current = setTimeout(() => {
        const scrollDepth = calculateScrollDepth()
        const timeSpent = Date.now() - readingStartTime.current
        
        // Only track if scroll depth has increased significantly
        if (scrollDepth > lastScrollDepth.current + 0.1) {
          analytics.trackReadingProgress({
            postSlug,
            sessionId: sessionIdRef.current!,
            scrollDepth,
            timeSpent,
            readingSpeed: calculateReadingSpeed(timeSpent)
          })
          
          lastScrollDepth.current = scrollDepth
        }
      }, scrollDebounceMs)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })
    readingStartTime.current = Date.now()

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (scrollTimerRef.current) {
        clearTimeout(scrollTimerRef.current)
      }
    }
  }, [postSlug, trackScrollProgress, scrollDebounceMs, analytics])

  // Set up performance tracking
  useEffect(() => {
    if (!trackPerformance || !postSlug) return

    // Track page load performance
    const trackPageLoadPerformance = () => {
      if ('performance' in window && 'getEntriesByType' in performance) {
        const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
        if (navigationEntries.length > 0) {
          const entry = navigationEntries[0]
          
          analytics.trackPerformanceMetric({
            metricType: 'page_load',
            postSlug,
            value: entry.loadEventEnd - entry.loadEventStart,
            userAgent: navigator.userAgent,
            connectionType: (navigator as unknown as { connection?: { effectiveType?: string } }).connection?.effectiveType
          })

          // Track Core Web Vitals
          if (entry.domContentLoadedEventEnd) {
            analytics.trackPerformanceMetric({
              metricType: 'first_contentful_paint',
              postSlug,
              value: entry.domContentLoadedEventEnd - entry.fetchStart,
              userAgent: navigator.userAgent
            })
          }
        }
      }
    }

    // Track when page is fully loaded
    if (document.readyState === 'complete') {
      trackPageLoadPerformance()
    } else {
      window.addEventListener('load', trackPageLoadPerformance)
    }

    return () => {
      window.removeEventListener('load', trackPageLoadPerformance)
    }
  }, [postSlug, trackPerformance, analytics])

  // Track reading time on page unload
  useEffect(() => {
    if (!trackReadingTime || !postSlug) return

    const handleUnload = () => {
      const totalTimeSpent = Date.now() - readingStartTime.current
      const finalScrollDepth = calculateScrollDepth()
      
      analytics.trackReadingProgress({
        postSlug,
        sessionId: sessionIdRef.current!,
        scrollDepth: finalScrollDepth,
        timeSpent: totalTimeSpent,
        completionRate: finalScrollDepth
      })
    }

    window.addEventListener('beforeunload', handleUnload)
    window.addEventListener('pagehide', handleUnload)

    return () => {
      window.removeEventListener('beforeunload', handleUnload)
      window.removeEventListener('pagehide', handleUnload)
    }
  }, [postSlug, trackReadingTime, analytics])

  // Tracking methods
  const trackPageView = trackPageViewTemp // Use the hoisted version

  const trackEngagement = useCallback(async (
    eventType: 'cta_click' | 'newsletter_signup' | 'comment_posted' | 'share_click',
    metadata: Record<string, unknown> = {}
  ) => {
    if (!sessionIdRef.current || !postSlug) return

    try {
      await analytics.trackEngagementEvent({
        eventType: eventType as 'cta_click' | 'newsletter_signup' | 'comment_posted' | 'share_click',
        postSlug,
        sessionId: sessionIdRef.current,
        metadata
      })
    } catch (error) {
      console.error('Failed to track engagement:', error)
    }
  }, [analytics, postSlug])

  const trackSearch = useCallback(async (
    query: string,
    resultsCount: number,
    selectedIndex?: number
  ) => {
    if (!sessionIdRef.current) return

    try {
      await analytics.trackSearchAnalytics({
        query,
        sessionId: sessionIdRef.current,
        resultsCount,
        selectedResultIndex: selectedIndex
      })
    } catch (error) {
      console.error('Failed to track search:', error)
    }
  }, [analytics])

  const trackNewsletter = useCallback(async (
    email: string,
    location: string
  ) => {
    if (!sessionIdRef.current) return

    try {
      // Track as engagement event
      await analytics.trackEngagementEvent({
        eventType: 'newsletter_signup',
        postSlug: postSlug || 'unknown',
        sessionId: sessionIdRef.current,
        metadata: { email, location }
      })
    } catch (error) {
      console.error('Failed to track newsletter signup:', error)
    }
  }, [analytics, postSlug])

  const getABTestVariant = useCallback(async (testName: string): Promise<ABTestVariant> => {
    try {
      return await analytics.getABTestVariant(testName)
    } catch (error) {
      console.error('Failed to get A/B test variant:', error)
      return 'control'
    }
  }, [analytics])

  const trackConversion = useCallback(async (
    testName: string,
    conversionEvent: string
  ) => {
    if (!sessionIdRef.current || !postSlug) return

    try {
      // Get current variant
      const variant = await getABTestVariant(testName)
      
      await analytics.trackABTestEvent({
        testName,
        variant,
        postSlug,
        sessionId: sessionIdRef.current,
        conversionEvent
      })
    } catch (error) {
      console.error('Failed to track conversion:', error)
    }
  }, [analytics, postSlug, getABTestVariant])

  const getPopularPosts = useCallback(async (
    timeWindow: AnalyticsTimeWindow,
    options: { limit?: number; category?: string } = {}
  ): Promise<PopularPost[]> => {
    try {
      return await analytics.getPopularPosts({
        timeWindow,
        ...options
      })
    } catch (error) {
      console.error('Failed to get popular posts:', error)
      return []
    }
  }, [analytics])

  const getPostAnalytics = useCallback(async (
    slug: string,
    timeWindow: AnalyticsTimeWindow
  ): Promise<BlogPostAnalytics | null> => {
    try {
      return await analytics.getPostAnalytics(slug, timeWindow)
    } catch (error) {
      console.error('Failed to get post analytics:', error)
      return null
    }
  }, [analytics])

  return {
    trackPageView,
    trackEngagement,
    trackSearch,
    trackNewsletter,
    getABTestVariant,
    trackConversion,
    getPopularPosts,
    getPostAnalytics,
    sessionId: sessionIdRef.current,
    isTracking: isTrackingRef.current
  }
}

// =====================================================
// Utility Functions
// =====================================================

function generateSessionId(): string {
  const timestamp = Date.now().toString(36)
  const random = Math.random().toString(36).substring(2)
  return `${timestamp}_${random}`
}

function calculateScrollDepth(): number {
  const windowHeight = window.innerHeight
  const documentHeight = document.documentElement.scrollHeight
  const scrollTop = window.pageYOffset || document.documentElement.scrollTop
  
  const maxScrollTop = documentHeight - windowHeight
  if (maxScrollTop <= 0) return 1
  
  return Math.min(scrollTop / maxScrollTop, 1)
}

function calculateReadingSpeed(timeSpent: number): number | undefined {
  // Estimate reading speed based on time spent and content length
  const contentElement = document.querySelector('article, .blog-content, main')
  if (!contentElement || timeSpent < 5000) return undefined // Need at least 5 seconds
  
  const text = contentElement.textContent || ''
  const wordCount = text.split(/\s+/).length
  const minutesSpent = timeSpent / (1000 * 60)
  
  return minutesSpent > 0 ? wordCount / minutesSpent : undefined
}

// =====================================================
// Higher-Order Component for Auto-Tracking
// =====================================================

interface WithAnalyticsProps {
  postSlug?: string
  analyticsOptions?: UseBlogAnalyticsOptions
}

/**
 * Higher-order component that automatically sets up analytics tracking
 * for blog post components.
 * 
 * @example
 * ```typescript
 * const BlogPostWithAnalytics = withBlogAnalytics(BlogPost, {
 *   autoTrack: true,
 *   trackScrollProgress: true
 * })
 * ```
 */
export function withBlogAnalytics<P extends WithAnalyticsProps>(
  Component: React.ComponentType<P>,
  defaultOptions: UseBlogAnalyticsOptions = {}
) {
  return function WrappedComponent(props: P) {
    const options = { ...defaultOptions, ...props.analyticsOptions }
    const analytics = useBlogAnalytics(props.postSlug, options)
    
    return React.createElement(Component, { ...props, analytics })
  }
}

// =====================================================
// Specialized Hooks
// =====================================================

/**
 * Specialized hook for tracking newsletter signups
 */
export function useNewsletterTracking(postSlug?: string) {
  const { trackNewsletter, trackConversion } = useBlogAnalytics(postSlug)
  
  const trackSignup = useCallback(async (
    email: string,
    location: 'inline' | 'popup' | 'sidebar' | 'footer' = 'inline'
  ) => {
    await trackNewsletter(email, location)
    
    // Track as conversion for any active A/B tests
    await trackConversion('newsletter_signup', 'signup_completed')
  }, [trackNewsletter, trackConversion])
  
  return { trackSignup }
}

/**
 * Specialized hook for tracking CTA clicks
 */
export function useCTATracking(postSlug?: string) {
  const { trackEngagement, trackConversion } = useBlogAnalytics(postSlug)
  
  const trackCTAClick = useCallback(async (
    ctaId: string,
    ctaType: 'button' | 'link' | 'banner' = 'button',
    targetUrl?: string
  ) => {
    await trackEngagement('cta_click', {
      elementId: ctaId,
      ctaType,
      targetUrl
    })
    
    // Track as conversion for CTA-focused A/B tests
    await trackConversion('cta_optimization', 'cta_clicked')
  }, [trackEngagement, trackConversion])
  
  return { trackCTAClick }
}

/**
 * Specialized hook for tracking social shares
 */
export function useShareTracking(postSlug?: string) {
  const { trackEngagement } = useBlogAnalytics(postSlug)
  
  const trackShare = useCallback(async (
    platform: 'twitter' | 'facebook' | 'linkedin' | 'email' | 'copy-link',
    postTitle?: string
  ) => {
    await trackEngagement('share_click', {
      platform,
      postTitle
    })
  }, [trackEngagement])
  
  return { trackShare }
}