import React, { 
  useEffect, 
  useCallback, 
  useRef, 
  useState, 
  useMemo
} from 'react'
import * as Sentry from '@sentry/react'
import { trackMetric, startMeasure, endMeasure, trackAPICall } from '../../lib/apm'
import { captureError, addBreadcrumb } from '../../lib/monitoring'
import { BlogPerformanceContext } from './BlogPerformanceUtils'

/**
 * Core Web Vitals interfaces
 */
interface WebVitalMetric {
  name: 'CLS' | 'LCP' | 'FID' | 'INP' | 'FCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  threshold: { good: number; poor: number }
}

interface BlogPerformanceMetrics {
  // Core Web Vitals
  webVitals: {
    cls: WebVitalMetric | null
    lcp: WebVitalMetric | null
    fid: WebVitalMetric | null
    inp: WebVitalMetric | null
    fcp: WebVitalMetric | null
    ttfb: WebVitalMetric | null
  }
  
  // Blog-specific metrics
  blogMetrics: {
    timeToFirstContent: number | null
    readingTimeAccuracy: number | null
    contentRenderTime: number | null
    imageLoadTime: number | null
    commentsLoadTime: number | null
  }
  
  // Loading performance
  loadingMetrics: {
    pageLoadTime: number | null
    apiCallsTotal: number
    apiCallsSuccess: number
    apiCallsError: number
    averageApiResponseTime: number | null
  }
  
  // User interaction tracking
  userMetrics: {
    scrollDepth: number
    clickTracking: ClickEvent[]
    readingProgress: number
    engagementTime: number
  }
}

interface ClickEvent {
  element: string
  timestamp: number
  position: { x: number; y: number }
  metadata?: Record<string, unknown>
}

interface PerformanceBudget {
  lcp: number // 2500ms
  fid: number // 100ms
  cls: number // 0.1
  contentRender: number // 1000ms
  imageLoad: number // 2000ms
  apiResponse: number // 500ms
}

interface BlogPerformanceConfig {
  enableWebVitals: boolean
  enableUserTracking: boolean
  enableBudgetAlerting: boolean
  enableABTesting: boolean
  sampleRate: number
  budgets: PerformanceBudget
  alertThresholds: {
    errorRate: number // 0.05 (5%)
    slowResponseRate: number // 0.1 (10%)
  }
}

interface BlogPerformanceContextValue {
  metrics: BlogPerformanceMetrics
  isRecording: boolean
  startTracking: (componentName: string) => void
  stopTracking: (componentName: string) => void
  trackUserAction: (action: string, metadata?: Record<string, unknown>) => void
  trackApiCall: <T>(name: string, call: () => Promise<T>) => Promise<T>
  getPerformanceReport: () => PerformanceReport
}

interface PerformanceReport {
  summary: {
    overallScore: number
    budgetStatus: 'passed' | 'warning' | 'failed'
    issues: string[]
    recommendations: string[]
  }
  webVitals: WebVitalMetric[]
  blogMetrics: BlogPerformanceMetrics['blogMetrics']
  userEngagement: {
    averageScrollDepth: number
    averageEngagementTime: number
    clickHeatmap: ClickEvent[]
  }
}

/**
 * Default configuration for blog performance monitoring
 */
const DEFAULT_CONFIG: BlogPerformanceConfig = {
  enableWebVitals: true,
  enableUserTracking: true,
  enableBudgetAlerting: true,
  enableABTesting: false,
  sampleRate: 1.0,
  budgets: {
    lcp: 2500,
    fid: 100,
    cls: 0.1,
    contentRender: 1000,
    imageLoad: 2000,
    apiResponse: 500,
  },
  alertThresholds: {
    errorRate: 0.05,
    slowResponseRate: 0.1,
  },
}

/**
 * Performance thresholds for Web Vitals ratings
 */
const WEB_VITAL_THRESHOLDS = {
  LCP: { good: 2500, poor: 4000 },
  FID: { good: 100, poor: 300 },
  CLS: { good: 0.1, poor: 0.25 },
  INP: { good: 200, poor: 500 },
  FCP: { good: 1800, poor: 3000 },
  TTFB: { good: 800, poor: 1800 },
} as const


/**
 * Props for the BlogPerformance wrapper component
 */
export interface BlogPerformanceProps {
  children: React.ReactNode
  config?: Partial<BlogPerformanceConfig>
  componentName?: string
  enableRealTimeUpdates?: boolean
  onPerformanceUpdate?: (metrics: BlogPerformanceMetrics) => void
  onBudgetExceeded?: (metric: string, value: number, budget: number) => void
  className?: string
}

/**
 * BlogPerformance wrapper component for monitoring blog component performance
 */
export function BlogPerformance({
  children,
  config: userConfig = {},
  componentName = 'blog-component',
  enableRealTimeUpdates = false,
  onPerformanceUpdate,
  onBudgetExceeded,
  className = '',
}: BlogPerformanceProps) {
  const config = useMemo(() => ({ ...DEFAULT_CONFIG, ...userConfig }), [userConfig])
  
  // State for performance metrics
  const [metrics, setMetrics] = useState<BlogPerformanceMetrics>({
    webVitals: {
      cls: null,
      lcp: null,
      fid: null,
      inp: null,
      fcp: null,
      ttfb: null,
    },
    blogMetrics: {
      timeToFirstContent: null,
      readingTimeAccuracy: null,
      contentRenderTime: null,
      imageLoadTime: null,
      commentsLoadTime: null,
    },
    loadingMetrics: {
      pageLoadTime: null,
      apiCallsTotal: 0,
      apiCallsSuccess: 0,
      apiCallsError: 0,
      averageApiResponseTime: null,
    },
    userMetrics: {
      scrollDepth: 0,
      clickTracking: [],
      readingProgress: 0,
      engagementTime: 0,
    },
  })

  const [isRecording, setIsRecording] = useState(false)
  
  // Refs for tracking
  const componentRef = useRef<HTMLDivElement>(null)
  const startTimeRef = useRef<number>(performance.now())
  // const scrollStartRef = useRef<number>(0)
  const lastScrollDepthRef = useRef<number>(0)
  const engagementStartRef = useRef<number>(Date.now())
  const apiCallsRef = useRef<{ times: number[]; errors: number }>({ times: [], errors: 0 })

  /**
   * Rate a Web Vital metric
   */
  const rateWebVital = useCallback((name: keyof typeof WEB_VITAL_THRESHOLDS, value: number): WebVitalMetric['rating'] => {
    const thresholds = WEB_VITAL_THRESHOLDS[name]
    if (value <= thresholds.good) return 'good'
    if (value <= thresholds.poor) return 'needs-improvement'
    return 'poor'
  }, [])

  /**
   * Create a Web Vital metric object
   */
  const createWebVitalMetric = useCallback((
    name: WebVitalMetric['name'], 
    value: number
  ): WebVitalMetric => {
    const threshold = WEB_VITAL_THRESHOLDS[name]
    return {
      name,
      value,
      rating: rateWebVital(name, value),
      threshold,
    }
  }, [rateWebVital])

  /**
   * Check performance budgets and alert if exceeded
   */
  const checkBudgets = useCallback((metric: string, value: number) => {
    if (!config.enableBudgetAlerting) return

    const budgetKey = metric.toLowerCase() as keyof PerformanceBudget
    const budget = config.budgets[budgetKey]
    
    if (budget && value > budget) {
      const message = `Performance budget exceeded for ${metric}: ${value}ms > ${budget}ms`
      
      // Alert via callback
      onBudgetExceeded?.(metric, value, budget)
      
      // Log to monitoring
      addBreadcrumb(message, 'performance', 'warning', {
        component: componentName,
        metric,
        value,
        budget,
      })

      // Send to Sentry if severe
      if (value > budget * 1.5) {
        captureError(new Error(message), {
          component: componentName,
          metric,
          value,
          budget,
        })
      }
    }
  }, [config.enableBudgetAlerting, config.budgets, onBudgetExceeded, componentName])

  /**
   * Update metrics and trigger callbacks
   */
  const updateMetrics = useCallback((updater: (prev: BlogPerformanceMetrics) => BlogPerformanceMetrics) => {
    setMetrics(prev => {
      const updated = updater(prev)
      onPerformanceUpdate?.(updated)
      return updated
    })
  }, [onPerformanceUpdate])

  /**
   * Initialize Web Vitals observers
   */
  const initWebVitals = useCallback(() => {
    if (!config.enableWebVitals || !('PerformanceObserver' in window)) return

    try {
      // LCP Observer
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        const lastEntry = entries[entries.length - 1] as PerformanceNavigationTiming
        if (lastEntry) {
          const lcp = createWebVitalMetric('LCP', lastEntry.startTime)
          updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, lcp } }))
          checkBudgets('LCP', lastEntry.startTime)
          trackMetric('blog.webvitals.lcp', lastEntry.startTime, { component: componentName })
        }
      })
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] })

      // FID Observer
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries()
        entries.forEach((entry) => {
          if ('processingStart' in entry && 'startTime' in entry) {
            const fidValue = (entry as PerformanceEventTiming).processingStart - entry.startTime
            const fid = createWebVitalMetric('FID', fidValue)
            updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, fid } }))
            checkBudgets('FID', fidValue)
            trackMetric('blog.webvitals.fid', fidValue, { component: componentName })
          }
        })
      })
      fidObserver.observe({ entryTypes: ['first-input'] })

      // CLS Observer
      let clsValue = 0
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as LayoutShift[]
        entries.forEach((entry) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value
          }
        })
        const cls = createWebVitalMetric('CLS', clsValue)
        updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, cls } }))
        checkBudgets('CLS', clsValue)
        trackMetric('blog.webvitals.cls', clsValue, { component: componentName })
      })
      clsObserver.observe({ entryTypes: ['layout-shift'] })

      // INP Observer
      let inpValue = 0
      const inpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries() as PerformanceEventTiming[]
        entries.forEach((entry) => {
          if (entry.duration > inpValue) {
            inpValue = entry.duration
            const inp = createWebVitalMetric('INP', inpValue)
            updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, inp } }))
            trackMetric('blog.webvitals.inp', inpValue, { component: componentName })
          }
        })
      })
      inpObserver.observe({ entryTypes: ['event'] })

      // FCP & TTFB from Navigation Timing
      const navigationEntries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      if (navigationEntries.length > 0) {
        const nav = navigationEntries[0]
        
        // FCP from paint timing if available
        const paintEntries = performance.getEntriesByType('paint')
        const fcpEntry = paintEntries.find(entry => entry.name === 'first-contentful-paint')
        if (fcpEntry) {
          const fcp = createWebVitalMetric('FCP', fcpEntry.startTime)
          updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, fcp } }))
          trackMetric('blog.webvitals.fcp', fcpEntry.startTime, { component: componentName })
        }

        // TTFB
        const ttfbValue = nav.responseStart - nav.requestStart
        const ttfb = createWebVitalMetric('TTFB', ttfbValue)
        updateMetrics(prev => ({ ...prev, webVitals: { ...prev.webVitals, ttfb } }))
        trackMetric('blog.webvitals.ttfb', ttfbValue, { component: componentName })
      }

    } catch (error) {
      captureError(error as Error, { context: 'webvitals-init', component: componentName })
    }
  }, [config.enableWebVitals, componentName, createWebVitalMetric, updateMetrics, checkBudgets])

  /**
   * Track scroll depth and reading progress
   */
  const trackScrollProgress = useCallback(() => {
    if (!config.enableUserTracking || !componentRef.current) return

    // const element = componentRef.current
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop
    const windowHeight = window.innerHeight
    const documentHeight = Math.max(
      document.body.scrollHeight,
      document.body.offsetHeight,
      document.documentElement.clientHeight,
      document.documentElement.scrollHeight,
      document.documentElement.offsetHeight
    )

    const scrolled = (scrollTop + windowHeight) / documentHeight
    const scrollDepth = Math.min(Math.round(scrolled * 100), 100)

    // Only update if significant change
    if (scrollDepth > lastScrollDepthRef.current + 5) {
      lastScrollDepthRef.current = scrollDepth
      
      updateMetrics(prev => ({
        ...prev,
        userMetrics: {
          ...prev.userMetrics,
          scrollDepth,
          readingProgress: scrollDepth,
        },
      }))

      trackMetric('blog.scroll.depth', scrollDepth, { 
        component: componentName,
        timestamp: Date.now(),
      })
    }
  }, [config.enableUserTracking, componentName, updateMetrics])

  /**
   * Track click events
   */
  const trackClick = useCallback((event: MouseEvent) => {
    if (!config.enableUserTracking) return

    const target = event.target as HTMLElement
    const elementInfo = target.tagName.toLowerCase() + 
      (target.id ? `#${target.id}` : '') +
      (target.className ? `.${target.className.split(' ').join('.')}` : '')

    const clickEvent: ClickEvent = {
      element: elementInfo,
      timestamp: Date.now(),
      position: { x: event.clientX, y: event.clientY },
      metadata: {
        href: target.getAttribute('href'),
        text: target.textContent?.substring(0, 50),
      },
    }

    updateMetrics(prev => ({
      ...prev,
      userMetrics: {
        ...prev.userMetrics,
        clickTracking: [...prev.userMetrics.clickTracking.slice(-19), clickEvent], // Keep last 20
      },
    }))

    trackMetric('blog.click', 1, {
      component: componentName,
      element: elementInfo,
      position: `${event.clientX},${event.clientY}`,
    })
  }, [config.enableUserTracking, componentName, updateMetrics])

  /**
   * Calculate engagement time
   */
  const updateEngagementTime = useCallback(() => {
    const now = Date.now()
    const engagementTime = Math.round((now - engagementStartRef.current) / 1000)
    
    updateMetrics(prev => ({
      ...prev,
      userMetrics: {
        ...prev.userMetrics,
        engagementTime,
      },
    }))
  }, [updateMetrics])

  /**
   * Context methods
   */
  const startTracking = useCallback((name: string) => {
    // Tracking state removed - just measure performance
    startMeasure(`blog.${componentName}.${name}`)
    addBreadcrumb(`Started tracking: ${name}`, 'performance', 'info', { component: componentName })
  }, [componentName])

  const stopTracking = useCallback((name: string) => {
    // Tracking state removed - just measure performance
    
    const duration = endMeasure(`blog.${componentName}.${name}`)
    
    // Update blog-specific metrics
    if (name === 'content-render') {
      updateMetrics(prev => ({
        ...prev,
        blogMetrics: { ...prev.blogMetrics, contentRenderTime: duration },
      }))
      checkBudgets('contentRender', duration)
    } else if (name === 'image-load') {
      updateMetrics(prev => ({
        ...prev,
        blogMetrics: { ...prev.blogMetrics, imageLoadTime: duration },
      }))
      checkBudgets('imageLoad', duration)
    } else if (name === 'comments-load') {
      updateMetrics(prev => ({
        ...prev,
        blogMetrics: { ...prev.blogMetrics, commentsLoadTime: duration },
      }))
    }

    addBreadcrumb(`Stopped tracking: ${name}`, 'performance', 'info', { 
      component: componentName, 
      duration 
    })
  }, [componentName, updateMetrics, checkBudgets])

  const trackUserAction = useCallback((action: string, metadata: Record<string, unknown> = {}) => {
    trackMetric(`blog.user.${action}`, 1, {
      component: componentName,
      ...metadata,
    })
    
    addBreadcrumb(`User action: ${action}`, 'user-interaction', 'info', {
      component: componentName,
      ...metadata,
    })
  }, [componentName])

  const trackApiCallWrapper = useCallback(async <T,>(name: string, call: () => Promise<T>): Promise<T> => {
    const startTime = performance.now()
    
    try {
      const result = await trackAPICall(`blog.api.${name}`, call)
      const duration = performance.now() - startTime
      
      // Update API metrics
      apiCallsRef.current.times.push(duration)
      const avgTime = apiCallsRef.current.times.reduce((a, b) => a + b, 0) / apiCallsRef.current.times.length
      
      updateMetrics(prev => ({
        ...prev,
        loadingMetrics: {
          ...prev.loadingMetrics,
          apiCallsTotal: prev.loadingMetrics.apiCallsTotal + 1,
          apiCallsSuccess: prev.loadingMetrics.apiCallsSuccess + 1,
          averageApiResponseTime: avgTime,
        },
      }))

      checkBudgets('apiResponse', duration)
      return result
    } catch (error) {
      apiCallsRef.current.errors++
      
      updateMetrics(prev => ({
        ...prev,
        loadingMetrics: {
          ...prev.loadingMetrics,
          apiCallsTotal: prev.loadingMetrics.apiCallsTotal + 1,
          apiCallsError: prev.loadingMetrics.apiCallsError + 1,
        },
      }))

      throw error
    }
  }, [updateMetrics, checkBudgets])

  const getPerformanceReport = useCallback((): PerformanceReport => {
    const webVitalsList = Object.values(metrics.webVitals).filter(Boolean) as WebVitalMetric[]
    const avgScore = webVitalsList.length > 0 
      ? webVitalsList.reduce((sum, vital) => {
          const score = vital.rating === 'good' ? 100 : vital.rating === 'needs-improvement' ? 75 : 50
          return sum + score
        }, 0) / webVitalsList.length
      : 0

    const issues: string[] = []
    const recommendations: string[] = []

    // Analyze issues and provide recommendations
    webVitalsList.forEach(vital => {
      if (vital.rating === 'poor') {
        issues.push(`${vital.name} is poor: ${vital.value}`)
        
        switch (vital.name) {
          case 'LCP':
            recommendations.push('Optimize images and remove render-blocking resources')
            break
          case 'FID':
            recommendations.push('Reduce JavaScript execution time and break up long tasks')
            break
          case 'CLS':
            recommendations.push('Add size attributes to images and avoid inserting content above existing content')
            break
          case 'INP':
            recommendations.push('Optimize event handlers and reduce main thread blocking')
            break
        }
      }
    })

    const budgetStatus: PerformanceReport['summary']['budgetStatus'] = 
      issues.length === 0 ? 'passed' : 
      issues.length <= 2 ? 'warning' : 'failed'

    return {
      summary: {
        overallScore: Math.round(avgScore),
        budgetStatus,
        issues,
        recommendations,
      },
      webVitals: webVitalsList,
      blogMetrics: metrics.blogMetrics,
      userEngagement: {
        averageScrollDepth: metrics.userMetrics.scrollDepth,
        averageEngagementTime: metrics.userMetrics.engagementTime,
        clickHeatmap: metrics.userMetrics.clickTracking,
      },
    }
  }, [metrics])

  // Context value
  const contextValue: BlogPerformanceContextValue = useMemo(() => ({
    metrics,
    isRecording,
    startTracking,
    stopTracking,
    trackUserAction,
    trackApiCall: trackApiCallWrapper,
    getPerformanceReport,
  }), [metrics, isRecording, startTracking, stopTracking, trackUserAction, trackApiCallWrapper, getPerformanceReport])

  // Initialize performance monitoring
  useEffect(() => {
    setIsRecording(true)
    
    // Initialize Web Vitals
    initWebVitals()
    
    // Track initial page load
    const loadTime = performance.now() - startTimeRef.current
    updateMetrics(prev => ({
      ...prev,
      loadingMetrics: { ...prev.loadingMetrics, pageLoadTime: loadTime },
    }))

    // Track time to first content
    const observer = new MutationObserver(() => {
      if (componentRef.current?.textContent) {
        const timeToFirstContent = performance.now() - startTimeRef.current
        updateMetrics(prev => ({
          ...prev,
          blogMetrics: { ...prev.blogMetrics, timeToFirstContent },
        }))
        observer.disconnect()
      }
    })

    if (componentRef.current) {
      observer.observe(componentRef.current, { childList: true, subtree: true })
    }

    // Add event listeners
    if (config.enableUserTracking) {
      window.addEventListener('scroll', trackScrollProgress, { passive: true })
      window.addEventListener('click', trackClick, { passive: true })
      
      // Update engagement time periodically
      const engagementInterval = setInterval(updateEngagementTime, 5000)
      
      return () => {
        window.removeEventListener('scroll', trackScrollProgress)
        window.removeEventListener('click', trackClick)
        clearInterval(engagementInterval)
        observer.disconnect()
      }
    }

    return () => {
      observer.disconnect()
    }
  }, [config, initWebVitals, trackScrollProgress, trackClick, updateEngagementTime, updateMetrics])

  // Real-time updates
  useEffect(() => {
    if (!enableRealTimeUpdates) return

    const interval = setInterval(() => {
      updateEngagementTime()
      trackScrollProgress()
    }, 1000)

    return () => clearInterval(interval)
  }, [enableRealTimeUpdates, updateEngagementTime, trackScrollProgress])

  return (
    <BlogPerformanceContext.Provider value={contextValue}>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <h3 className="text-red-800 font-semibold">Performance Monitoring Error</h3>
            <p className="text-red-600 text-sm mt-1">
              Performance tracking encountered an error but your content is still available.
            </p>
            <button
              onClick={resetError}
              className="mt-2 px-3 py-1 bg-red-100 text-red-800 rounded text-sm hover:bg-red-200"
            >
              Retry Performance Tracking
            </button>
          </div>
        )}
        beforeCapture={(scope) => {
          scope.setTag('component', 'BlogPerformance')
          scope.setTag('componentName', componentName)
          scope.setContext('metrics', { ...metrics })
        }}
      >
        <div ref={componentRef} className={className} data-performance-component={componentName}>
          {children}
        </div>
      </Sentry.ErrorBoundary>
    </BlogPerformanceContext.Provider>
  )
}


// Export types for external use
export type {
  BlogPerformanceConfig,
  BlogPerformanceMetrics,
  WebVitalMetric,
  PerformanceReport,
  BlogPerformanceContextValue,
}

// Global type augmentation for LayoutShift
declare global {
  interface LayoutShift extends PerformanceEntry {
    value: number
    hadRecentInput: boolean
  }

  interface PerformanceEventTiming extends PerformanceEntry {
    readonly processingStart: number
    duration: number
  }
}