import React from 'react'
import * as Sentry from '@sentry/react'
// BrowserTracing is imported from Sentry package if needed

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  enableWebVitals: boolean
  enableResourceTiming: boolean
  enableLongTasks: boolean
  enablePaintTiming: boolean
  sampleRate: number
}

/**
 * Web Vitals tracking
 */
export interface WebVitals {
  CLS: number // Cumulative Layout Shift
  FID: number // First Input Delay
  LCP: number // Largest Contentful Paint
  FCP: number // First Contentful Paint
  TTFB: number // Time to First Byte
  INP: number // Interaction to Next Paint
}

/**
 * Initialize Application Performance Monitoring
 */
export function initAPM(config: PerformanceConfig): void {
  // Web Vitals Observer
  if (config.enableWebVitals && 'PerformanceObserver' in window) {
    observeWebVitals()
  }

  // Resource Timing
  if (config.enableResourceTiming) {
    observeResourceTiming()
  }

  // Long Tasks
  if (config.enableLongTasks) {
    observeLongTasks()
  }

  // Paint Timing
  if (config.enablePaintTiming) {
    observePaintTiming()
  }
}

/**
 * Observe and track Web Vitals
 */
function observeWebVitals(): void {
  // LCP - Largest Contentful Paint
  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    const lastEntry = entries[entries.length - 1]
    if (lastEntry) {
      trackMetric('web-vitals.lcp', lastEntry.startTime)
    }
  }).observe({ entryTypes: ['largest-contentful-paint'] })

  // FID - First Input Delay
  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      if ('processingStart' in entry && 'startTime' in entry) {
        const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime
        trackMetric('web-vitals.fid', fid)
      }
    })
  }).observe({ entryTypes: ['first-input'] })

  // CLS - Cumulative Layout Shift
  let clsValue = 0
  const clsEntries: PerformanceEntry[] = []
  new PerformanceObserver((list) => {
    const entries = list.getEntries() as LayoutShift[]
    entries.forEach((entry) => {
      if (!entry.hadRecentInput) {
        clsValue += entry.value
        clsEntries.push(entry)
      }
    })
    trackMetric('web-vitals.cls', clsValue)
  }).observe({ entryTypes: ['layout-shift'] })

  // INP - Interaction to Next Paint
  let inpValue = 0
  new PerformanceObserver((list) => {
    const entries = list.getEntries() as PerformanceEventTiming[]
    entries.forEach((entry) => {
      if (entry.duration > inpValue) {
        inpValue = entry.duration
        trackMetric('web-vitals.inp', inpValue)
      }
    })
  }).observe({ entryTypes: ['event'] })
}

/**
 * Track resource loading performance
 */
function observeResourceTiming(): void {
  new PerformanceObserver((list) => {
    const entries = list.getEntries() as PerformanceResourceTiming[]
    entries.forEach((entry) => {
      // Track slow resources
      if (entry.duration > 1000) {
        trackMetric('resource.slow', entry.duration, {
          name: entry.name,
          type: entry.initiatorType,
          size: entry.transferSize,
        })
      }

      // Track resource types
      trackMetric(`resource.${entry.initiatorType}`, entry.duration)
    })
  }).observe({ entryTypes: ['resource'] })
}

/**
 * Track long running tasks
 */
function observeLongTasks(): void {
  if (!('PerformanceLongTaskTiming' in window)) return

  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      trackMetric('longtask', entry.duration, {
        startTime: entry.startTime,
      })
    })
  }).observe({ entryTypes: ['longtask'] })
}

/**
 * Track paint timing
 */
function observePaintTiming(): void {
  new PerformanceObserver((list) => {
    const entries = list.getEntries()
    entries.forEach((entry) => {
      if (entry.name === 'first-paint') {
        trackMetric('paint.fp', entry.startTime)
      } else if (entry.name === 'first-contentful-paint') {
        trackMetric('paint.fcp', entry.startTime)
      }
    })
  }).observe({ entryTypes: ['paint'] })
}

/**
 * Track custom performance metrics
 */
export function trackMetric(
  name: string,
  value: number,
  tags?: Record<string, string | number>
): void {
  // Send to Sentry
  Sentry.addBreadcrumb({
    category: 'performance',
    message: name,
    level: 'info',
    data: {
      value,
      ...tags,
    },
  })

  // Log to console in development
  if (import.meta.env.DEV) {
    console.log(`[APM] ${name}: ${value}ms`, tags)
  }

  // Send to custom analytics if configured
  if (window.analytics?.track) {
    window.analytics.track('Performance Metric', {
      metric_name: name,
      metric_value: value,
      ...tags,
    })
  }
}

/**
 * Measure component render performance
 */
export function measureComponentPerformance(componentName: string) {
  return function <T extends React.ComponentType<Record<string, unknown>>>(Component: T): T {
    const MeasuredComponent = (props: Record<string, unknown>) => {
      const startTime = performance.now()

      React.useEffect(() => {
        const renderTime = performance.now() - startTime
        trackMetric(`component.${componentName}.render`, renderTime)
      }, [startTime])

      return React.createElement(Component, props)
    }

    MeasuredComponent.displayName = `Measured(${componentName})`
    return MeasuredComponent as T
  }
}

/**
 * Track API call performance
 */
export async function trackAPICall<T>(endpoint: string, operation: () => Promise<T>): Promise<T> {
  const startTime = performance.now()

  try {
    const result = await operation()
    const duration = performance.now() - startTime

    trackMetric('api.success', duration, {
      endpoint,
    })

    return result
  } catch (error) {
    const duration = performance.now() - startTime

    trackMetric('api.error', duration, {
      endpoint,
      error: error instanceof Error ? error.message : 'Unknown error',
    })

    throw error
  }
}

/**
 * Bundle size tracking
 */
export function trackBundleSize(): void {
  if ('connection' in navigator) {
    const connection = (navigator as Navigator & { connection: NetworkInformation }).connection
    trackMetric('bundle.connection', 0, {
      effectiveType: connection.effectiveType,
      downlink: connection.downlink,
      rtt: connection.rtt,
    })
  }

  // Track total JS size
  const resources = performance.getEntriesByType('resource') as PerformanceResourceTiming[]
  const jsResources = resources.filter((r) => r.name.endsWith('.js'))
  const totalJsSize = jsResources.reduce((sum, r) => sum + r.transferSize, 0)

  trackMetric('bundle.js.total', totalJsSize)
}

/**
 * Memory usage tracking
 */
export function trackMemoryUsage(): void {
  if ('memory' in performance) {
    const memory = (performance as Performance & { memory: MemoryInfo }).memory
    trackMetric('memory.used', memory.usedJSHeapSize)
    trackMetric('memory.total', memory.totalJSHeapSize)
    trackMetric('memory.limit', memory.jsHeapSizeLimit)
  }
}

/**
 * User timing API wrapper
 */
export function startMeasure(name: string): void {
  performance.mark(`${name}-start`)
}

export function endMeasure(name: string): number {
  performance.mark(`${name}-end`)
  performance.measure(name, `${name}-start`, `${name}-end`)

  const entries = performance.getEntriesByName(name)
  const duration = entries[entries.length - 1]?.duration || 0

  trackMetric(`measure.${name}`, duration)
  return duration
}

// Export singleton APM instance
export const apm = {
  init: initAPM,
  trackMetric,
  trackAPICall,
  trackBundleSize,
  trackMemoryUsage,
  startMeasure,
  endMeasure,
  measureComponentPerformance,
}

// TypeScript declarations for window.analytics
declare global {
  interface Window {
    analytics?: {
      track: (event: string, properties: Record<string, unknown>) => void
    }
  }

  interface LayoutShift extends PerformanceEntry {
    value: number
    hadRecentInput: boolean
  }

  interface PerformanceEventTiming extends PerformanceEntry {
    readonly processingStart: number
    duration: number
  }

  interface NetworkInformation {
    effectiveType: string
    downlink: number
    rtt: number
  }

  interface MemoryInfo {
    usedJSHeapSize: number
    totalJSHeapSize: number
    jsHeapSizeLimit: number
  }
}
