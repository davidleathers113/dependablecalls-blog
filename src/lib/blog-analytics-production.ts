import { onCLS, onINP, onLCP, onTTFB, onFCP } from 'web-vitals'
import * as Sentry from '@sentry/react'
import { addBreadcrumb } from './sentry-config'

/**
 * Production Blog Analytics Implementation
 * 
 * Tracks Core Web Vitals, blog engagement metrics, and performance
 * data for the DCE blog system. Integrates with Google Analytics
 * and Sentry for comprehensive monitoring.
 */

// Google Analytics global declaration
declare global {
  interface Window {
    gtag?: (
      command: 'event' | 'config' | 'set',
      action: string,
      parameters?: Record<string, any>
    ) => void
    dataLayer?: unknown[]
  }
}

// Core Web Vitals thresholds (in milliseconds or score)
const WEB_VITALS_THRESHOLDS = {
  CLS: 0.1,      // Cumulative Layout Shift (score)
  FID: 100,      // First Input Delay (ms)
  LCP: 2500,     // Largest Contentful Paint (ms)
  FCP: 1800,     // First Contentful Paint (ms)
  TTFB: 800,     // Time to First Byte (ms)
} as const

// Blog engagement tracking configuration
const SCROLL_DEPTH_THRESHOLDS = [0.25, 0.5, 0.75, 1.0]
const VIEW_TIME_THRESHOLD = 15000 // 15 seconds for engaged view

interface BlogMetricData {
  postId: string
  postSlug: string
  postTitle?: string
  category?: string
  author?: string
  publishedAt?: string
}

interface ScrollMetric extends BlogMetricData {
  scrollDepth: number
  viewTime: number
  contentLength?: number
  readingSpeed?: number
}

interface EngagementMetric extends BlogMetricData {
  action: 'view' | 'scroll' | 'click' | 'share' | 'comment'
  label?: string
  value?: number
}

class BlogAnalyticsProduction {
  private isInitialized = false
  private scrollObserver: IntersectionObserver | null = null
  private viewStartTime: Map<string, number> = new Map()
  private lastScrollDepth: Map<string, number> = new Map()
  private engagementTimers: Map<string, NodeJS.Timeout> = new Map()

  /**
   * Initialize blog analytics with Core Web Vitals and custom metrics
   */
  init(): void {
    if (this.isInitialized || typeof window === 'undefined') {
      return
    }

    this.isInitialized = true

    // Initialize Core Web Vitals monitoring
    this.initWebVitals()

    // Initialize custom blog metrics
    this.initBlogMetrics()

    // Track initial page view
    this.trackInitialPageView()

    addBreadcrumb('Blog analytics initialized', 'analytics', 'info')
  }

  /**
   * Initialize Core Web Vitals monitoring
   */
  private initWebVitals(): void {
    // Cumulative Layout Shift
    onCLS(this.handleWebVital.bind(this))
    
    // First Input Delay
    onINP(this.handleWebVital.bind(this))
    
    // Largest Contentful Paint
    onLCP(this.handleWebVital.bind(this))
    
    // First Contentful Paint
    onFCP(this.handleWebVital.bind(this))
    
    // Time to First Byte
    onTTFB(this.handleWebVital.bind(this))
  }

  /**
   * Handle Core Web Vitals measurements
   */
  private handleWebVital(metric: { name: string; value: number; entries?: PerformanceEntry[]; id?: string; delta?: number }): void {
    const { name, value, id = '', delta = 0, entries } = metric

    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', name, {
        value: Math.round(name === 'CLS' ? value * 1000 : value),
        metric_id: id,
        metric_value: value,
        metric_delta: delta,
        event_category: 'Web Vitals',
        event_label: id,
        non_interaction: true,
      })
    }

    // Check thresholds and alert Sentry on poor performance
    const threshold = WEB_VITALS_THRESHOLDS[name as keyof typeof WEB_VITALS_THRESHOLDS]
    if (threshold && value > threshold) {
      const severity = this.getVitalSeverity(name, value)
      
      console.warn(`Poor ${name}: ${value}`)
      
      // Capture to Sentry with context
      Sentry.captureMessage(`Poor Web Vital: ${name}`, severity)
      Sentry.withScope(scope => {
        scope.setContext('web_vital', {
          metric: name,
          value,
          threshold,
          delta,
          id,
          url: window.location.href,
          entries: entries?.length || 0,
        })
        scope.setLevel(severity)
        scope.setTag('performance.issue', 'web-vital')
      })

      // Add breadcrumb for debugging
      addBreadcrumb(
        `Poor ${name} detected: ${value}`,
        'performance',
        severity,
        { value, threshold, delta }
      )
    }
  }

  /**
   * Determine severity level based on how much the metric exceeds threshold
   */
  private getVitalSeverity(metric: string, value: number): Sentry.SeverityLevel {
    const threshold = WEB_VITALS_THRESHOLDS[metric as keyof typeof WEB_VITALS_THRESHOLDS]
    if (!threshold) return 'info'

    const ratio = value / threshold
    if (ratio > 2) return 'error'
    if (ratio > 1.5) return 'warning'
    return 'info'
  }

  /**
   * Initialize custom blog engagement metrics
   */
  private initBlogMetrics(): void {
    // Set up intersection observer for scroll tracking
    this.setupScrollTracking()

    // Track page visibility changes
    this.setupVisibilityTracking()

    // Track user interactions
    this.setupInteractionTracking()
  }

  /**
   * Set up scroll depth tracking with IntersectionObserver
   */
  private setupScrollTracking(): void {
    if (!('IntersectionObserver' in window)) {
      console.warn('IntersectionObserver not supported')
      return
    }

    this.scrollObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const postElement = entry.target as HTMLElement
            const postId = postElement.getAttribute('data-post-id')
            const postSlug = postElement.getAttribute('data-post-slug')
            
            if (postId && postSlug) {
              const scrollDepth = this.calculateScrollDepth(entry)
              this.trackScrollProgress(postId, postSlug, scrollDepth)
            }
          }
        })
      },
      {
        root: null,
        rootMargin: '0px',
        threshold: SCROLL_DEPTH_THRESHOLDS,
      }
    )

    // Start observing blog post elements
    this.observeBlogPosts()
  }

  /**
   * Calculate scroll depth from intersection ratio
   */
  private calculateScrollDepth(entry: IntersectionObserverEntry): number {
    // Get the actual scroll position relative to the element
    const windowHeight = window.innerHeight
    const elementTop = entry.boundingClientRect.top
    const elementHeight = entry.boundingClientRect.height
    
    // Calculate how much of the element has been scrolled past
    const scrolledPast = windowHeight - elementTop
    const scrollDepth = Math.min(Math.max(scrolledPast / elementHeight, 0), 1)
    
    return scrollDepth
  }

  /**
   * Track blog post scroll progress
   */
  private trackScrollProgress(postId: string, postSlug: string, scrollDepth: number): void {
    const lastDepth = this.lastScrollDepth.get(postId) || 0
    
    // Only track if scroll depth increased significantly (at least 10%)
    if (scrollDepth - lastDepth < 0.1) {
      return
    }

    this.lastScrollDepth.set(postId, scrollDepth)

    const viewTime = this.getViewTime(postId)
    const scrollPercentage = Math.round(scrollDepth * 100)

    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', 'blog_scroll_progress', {
        post_id: postId,
        post_slug: postSlug,
        scroll_depth: scrollPercentage,
        view_time: Math.round(viewTime / 1000), // Convert to seconds
        event_category: 'Blog Engagement',
        event_label: postSlug,
        value: scrollPercentage,
      })
    }

    // Track milestone scroll depths
    const milestones = [25, 50, 75, 100]
    const milestone = milestones.find(m => 
      scrollPercentage >= m && lastDepth * 100 < m
    )

    if (milestone) {
      this.trackEngagementMilestone(postId, postSlug, `scroll_${milestone}`, milestone)
    }
  }

  /**
   * Set up page visibility tracking
   */
  private setupVisibilityTracking(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        // Page is being hidden, track view time for all posts
        this.trackAllViewTimes()
      } else if (document.visibilityState === 'visible') {
        // Page is visible again, reset timers
        this.resetViewTimers()
      }
    })

    // Also track on page unload
    window.addEventListener('beforeunload', () => {
      this.trackAllViewTimes()
    })

    // Track on page hide (mobile support)
    window.addEventListener('pagehide', () => {
      this.trackAllViewTimes()
    })
  }

  /**
   * Set up interaction tracking for clicks, shares, etc.
   */
  private setupInteractionTracking(): void {
    // Use event delegation for better performance
    document.addEventListener('click', (event) => {
      const target = event.target as HTMLElement
      
      // Track CTA clicks
      if (target.matches('[data-track-cta]')) {
        const postId = target.getAttribute('data-post-id') || 'unknown'
        const postSlug = target.getAttribute('data-post-slug') || 'unknown'
        const ctaType = target.getAttribute('data-cta-type') || 'generic'
        
        this.trackEngagement({
          postId,
          postSlug,
          action: 'click',
          label: `cta_${ctaType}`,
        })
      }

      // Track share button clicks
      if (target.matches('[data-track-share]')) {
        const postId = target.getAttribute('data-post-id') || 'unknown'
        const postSlug = target.getAttribute('data-post-slug') || 'unknown'
        const shareType = target.getAttribute('data-share-type') || 'generic'
        
        this.trackEngagement({
          postId,
          postSlug,
          action: 'share',
          label: shareType,
        })
      }

      // Track comment interactions
      if (target.matches('[data-track-comment]')) {
        const postId = target.getAttribute('data-post-id') || 'unknown'
        const postSlug = target.getAttribute('data-post-slug') || 'unknown'
        
        this.trackEngagement({
          postId,
          postSlug,
          action: 'comment',
          label: 'interaction',
        })
      }
    })
  }

  /**
   * Track initial page view when a blog post loads
   */
  private trackInitialPageView(): void {
    // Wait for DOM content to be loaded
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.trackInitialPageView())
      return
    }

    // Find all blog post elements and track views
    const blogPosts = document.querySelectorAll('[data-post-id]')
    blogPosts.forEach((element) => {
      const postId = element.getAttribute('data-post-id')
      const postSlug = element.getAttribute('data-post-slug')
      
      if (postId && postSlug) {
        this.trackPageView(postId, postSlug, element as HTMLElement)
      }
    })
  }

  /**
   * Track blog post page view
   */
  private trackPageView(postId: string, postSlug: string, element: HTMLElement): void {
    // Start view timer
    this.viewStartTime.set(postId, Date.now())

    // Extract additional metadata
    const metadata: BlogMetricData = {
      postId,
      postSlug,
      postTitle: element.getAttribute('data-post-title') || undefined,
      category: element.getAttribute('data-post-category') || undefined,
      author: element.getAttribute('data-post-author') || undefined,
      publishedAt: element.getAttribute('data-post-published') || undefined,
    }

    // Send to Google Analytics
    if (window.gtag) {
      window.gtag('event', 'blog_post_view', {
        post_id: postId,
        post_slug: postSlug,
        post_title: metadata.postTitle,
        post_category: metadata.category,
        post_author: metadata.author,
        event_category: 'Blog Engagement',
        event_label: postSlug,
      })
    }

    // Set up engaged view timer (15 seconds)
    const timer = setTimeout(() => {
      this.trackEngagedView(postId, postSlug)
    }, VIEW_TIME_THRESHOLD)

    this.engagementTimers.set(postId, timer)
  }

  /**
   * Track engaged view (user spent significant time on post)
   */
  private trackEngagedView(postId: string, postSlug: string): void {
    const viewTime = this.getViewTime(postId)
    
    if (window.gtag) {
      window.gtag('event', 'blog_engaged_view', {
        post_id: postId,
        post_slug: postSlug,
        view_time: Math.round(viewTime / 1000),
        event_category: 'Blog Engagement',
        event_label: postSlug,
        value: 1,
      })
    }

    // Clear the timer
    const timer = this.engagementTimers.get(postId)
    if (timer) {
      clearTimeout(timer)
      this.engagementTimers.delete(postId)
    }
  }

  /**
   * Track engagement events
   */
  trackEngagement(metric: EngagementMetric): void {
    if (window.gtag) {
      window.gtag('event', `blog_${metric.action}`, {
        post_id: metric.postId,
        post_slug: metric.postSlug,
        action_label: metric.label,
        event_category: 'Blog Engagement',
        event_label: metric.postSlug,
        value: metric.value || 1,
      })
    }

    // Add breadcrumb for debugging
    addBreadcrumb(
      `Blog ${metric.action}: ${metric.postSlug}`,
      'user',
      'info',
      { label: metric.label, value: metric.value }
    )
  }

  /**
   * Track engagement milestones
   */
  private trackEngagementMilestone(
    postId: string,
    postSlug: string,
    milestone: string,
    value: number
  ): void {
    if (window.gtag) {
      window.gtag('event', 'blog_milestone', {
        post_id: postId,
        post_slug: postSlug,
        milestone_type: milestone,
        event_category: 'Blog Engagement',
        event_label: `${postSlug}_${milestone}`,
        value,
      })
    }
  }

  /**
   * Get view time for a post
   */
  private getViewTime(postId: string): number {
    const startTime = this.viewStartTime.get(postId)
    if (!startTime) return 0
    return Date.now() - startTime
  }

  /**
   * Track view times for all visible posts
   */
  private trackAllViewTimes(): void {
    this.viewStartTime.forEach((startTime, postId) => {
      const viewTime = Date.now() - startTime
      const postElement = document.querySelector(`[data-post-id="${postId}"]`)
      const postSlug = postElement?.getAttribute('data-post-slug') || 'unknown'

      if (viewTime > 1000) { // Only track if viewed for more than 1 second
        if (window.gtag) {
          window.gtag('event', 'blog_view_time', {
            post_id: postId,
            post_slug: postSlug,
            view_time: Math.round(viewTime / 1000),
            event_category: 'Blog Engagement',
            event_label: postSlug,
            value: Math.round(viewTime / 1000),
          })
        }
      }
    })
  }

  /**
   * Reset view timers when page becomes visible again
   */
  private resetViewTimers(): void {
    const now = Date.now()
    this.viewStartTime.forEach((_, postId) => {
      this.viewStartTime.set(postId, now)
    })
  }

  /**
   * Start observing blog post elements
   */
  observeBlogPosts(): void {
    if (!this.scrollObserver) return

    // Observe all elements with data-post-id attribute
    const blogPosts = document.querySelectorAll('[data-post-id]')
    blogPosts.forEach((element) => {
      this.scrollObserver!.observe(element)
      
      // Track initial view
      const postId = element.getAttribute('data-post-id')
      const postSlug = element.getAttribute('data-post-slug')
      if (postId && postSlug && !this.viewStartTime.has(postId)) {
        this.trackPageView(postId, postSlug, element as HTMLElement)
      }
    })
  }

  /**
   * Stop observing a specific blog post
   */
  unobserveBlogPost(element: Element): void {
    if (this.scrollObserver) {
      this.scrollObserver.unobserve(element)
    }

    // Clean up associated data
    const postId = element.getAttribute('data-post-id')
    if (postId) {
      this.viewStartTime.delete(postId)
      this.lastScrollDepth.delete(postId)
      
      const timer = this.engagementTimers.get(postId)
      if (timer) {
        clearTimeout(timer)
        this.engagementTimers.delete(postId)
      }
    }
  }

  /**
   * Clean up and destroy analytics
   */
  destroy(): void {
    // Track final view times
    this.trackAllViewTimes()

    // Clean up observers
    if (this.scrollObserver) {
      this.scrollObserver.disconnect()
      this.scrollObserver = null
    }

    // Clear all timers
    this.engagementTimers.forEach(timer => clearTimeout(timer))
    this.engagementTimers.clear()

    // Clear data
    this.viewStartTime.clear()
    this.lastScrollDepth.clear()

    this.isInitialized = false
  }
}

// Create singleton instance
const blogAnalyticsProduction = new BlogAnalyticsProduction()

/**
 * Initialize blog analytics for production
 */
export function initBlogAnalytics(): void {
  blogAnalyticsProduction.init()
}

/**
 * Track custom blog engagement events
 */
export function trackBlogEngagement(metric: EngagementMetric): void {
  blogAnalyticsProduction.trackEngagement(metric)
}

/**
 * Observe new blog post elements (for dynamic content)
 */
export function observeBlogPosts(): void {
  blogAnalyticsProduction.observeBlogPosts()
}

/**
 * Stop observing a blog post element
 */
export function unobserveBlogPost(element: Element): void {
  blogAnalyticsProduction.unobserveBlogPost(element)
}

/**
 * Clean up analytics (call on unmount)
 */
export function destroyBlogAnalytics(): void {
  blogAnalyticsProduction.destroy()
}

// Export types for use in components
export type { BlogMetricData, ScrollMetric, EngagementMetric }