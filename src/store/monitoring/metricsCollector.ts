/**
 * Metrics Collection System
 * Phase 2.4 - Automated performance metrics, user interaction tracking, and API monitoring
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import * as Sentry from '@sentry/react'
import type {
  MonitoringError,
  ErrorReport,
  WindowWithMonitoring,
  ExtendedPerformance,
} from './types'

// ==================== Metrics Collection Interfaces ====================

interface UserInteractionMetric {
  id: string
  timestamp: number
  type: 'click' | 'scroll' | 'navigation' | 'input' | 'hover'
  target: string
  duration?: number
  metadata: {
    url: string
    userAgent: string
    sessionId: string
    userId?: string
  }
}

interface APICallMetric {
  id: string
  timestamp: number
  url: string
  method: string
  status: number
  duration: number
  size: {
    request: number
    response: number
  }
  error?: string
  retryCount: number
  cacheHit: boolean
}

interface StateHydrationMetric {
  id: string
  timestamp: number
  storeName: string
  duration: number
  dataSize: number
  source: 'localStorage' | 'sessionStorage' | 'server' | 'cache'
  success: boolean
  error?: string
}

interface BundleMetric {
  id: string
  timestamp: number
  chunks: Array<{
    name: string
    size: number
    loadTime: number
    cached: boolean
  }>
  totalSize: number
  totalLoadTime: number
  criticalPathSize: number
}

interface MetricsCollectorState {
  // Collected metrics
  userInteractions: UserInteractionMetric[]
  apiCalls: APICallMetric[]
  stateHydrations: StateHydrationMetric[]
  bundleMetrics: BundleMetric[]
  errors: MonitoringError[]
  
  // Configuration
  isEnabled: boolean
  samplingRate: number
  maxStorageSize: number
  retentionPeriod: number // in milliseconds
  
  // Real-time stats
  sessionId: string
  sessionStartTime: number
  currentUrl: string
  
  // Actions
  startCollection: () => void
  stopCollection: () => void
  recordUserInteraction: (interaction: Omit<UserInteractionMetric, 'id' | 'timestamp' | 'metadata'>) => void
  recordAPICall: (apiCall: Omit<APICallMetric, 'id' | 'timestamp'>) => void
  recordStateHydration: (hydration: Omit<StateHydrationMetric, 'id' | 'timestamp'>) => void
  recordBundleMetrics: (bundle: Omit<BundleMetric, 'id' | 'timestamp'>) => void
  recordError: (error: Omit<MonitoringError, 'id' | 'timestamp'>) => void
  
  // Analytics
  generateErrorReport: () => ErrorReport
  getInteractionStats: () => UserInteractionStats
  getAPIStats: () => APIStats
  getPerformanceStats: () => PerformanceStats
  
  // Data management
  clearOldMetrics: () => void
  exportMetrics: () => string
  getMetricsSummary: () => MetricsSummary
}

interface UserInteractionStats {
  totalInteractions: number
  interactionsByType: Record<string, number>
  averageSessionDuration: number
  bounceRate: number
  mostInteractedElements: Array<{ target: string; count: number }>
}

interface APIStats {
  totalCalls: number
  averageResponseTime: number
  errorRate: number
  cacheHitRate: number
  slowestEndpoints: Array<{ url: string; averageTime: number }>
  errorsByStatus: Record<number, number>
}

interface PerformanceStats {
  averageLoadTime: number
  memoryUsage: number
  bundleSize: number
  hydrationTime: number
  criticalPathTime: number
}

interface MetricsSummary {
  timeRange: { start: number; end: number }
  userInteractions: UserInteractionStats
  apiPerformance: APIStats
  performance: PerformanceStats
  errors: { total: number; byType: Record<string, number> }
}

// ==================== Metrics Collector Store ====================

export const useMetricsCollector = create<MetricsCollectorState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    userInteractions: [],
    apiCalls: [],
    stateHydrations: [],
    bundleMetrics: [],
    errors: [],
    
    isEnabled: process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production',
    samplingRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    maxStorageSize: 10000, // Maximum number of metrics to store
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
    
    sessionId: generateSessionId(),
    sessionStartTime: Date.now(),
    currentUrl: typeof window !== 'undefined' ? window.location.href : '',

    startCollection: () => {
      const state = get()
      if (!state.isEnabled || typeof window === 'undefined') return

      set({ 
        isEnabled: true,
        sessionId: generateSessionId(),
        sessionStartTime: Date.now(),
        currentUrl: window.location.href,
      })

      // Set up automatic event listeners
      setupEventListeners()
      
      // Set up periodic cleanup
      setInterval(() => {
        get().clearOldMetrics()
      }, 60000) // Clean up every minute

      // Set up Sentry integration
      setupSentryIntegration()

      console.log('Metrics collection started')
    },

    stopCollection: () => {
      set({ isEnabled: false })
      
      // Clean up event listeners
      cleanupEventListeners()
      
      console.log('Metrics collection stopped')
    },

    recordUserInteraction: (interaction) => {
      const state = get()
      if (!state.isEnabled || Math.random() > state.samplingRate) return

      const fullInteraction: UserInteractionMetric = {
        ...interaction,
        id: generateId(),
        timestamp: Date.now(),
        metadata: {
          url: state.currentUrl,
          userAgent: navigator.userAgent,
          sessionId: state.sessionId,
          userId: getCurrentUserId(),
        },
      }

      set((state) => ({
        userInteractions: [...state.userInteractions, fullInteraction].slice(-state.maxStorageSize),
      }))

      // Send to analytics service (if configured)
      sendToAnalytics('user_interaction', fullInteraction)
    },

    recordAPICall: (apiCall) => {
      const state = get()
      if (!state.isEnabled) return

      const fullAPICall: APICallMetric = {
        ...apiCall,
        id: generateId(),
        timestamp: Date.now(),
      }

      set((state) => ({
        apiCalls: [...state.apiCalls, fullAPICall].slice(-state.maxStorageSize),
      }))

      // Track slow API calls
      if (apiCall.duration > 2000) { // 2 seconds
        get().recordError({
          type: 'performance',
          severity: 'medium',
          message: `Slow API call: ${apiCall.url} took ${apiCall.duration}ms`,
          context: {
            url: apiCall.url,
            duration: apiCall.duration.toString(),
          },
          resolved: false,
        })
      }

      // Track API errors
      if (apiCall.status >= 400) {
        get().recordError({
          type: 'system',
          severity: apiCall.status >= 500 ? 'high' : 'medium',
          message: `API error: ${apiCall.method} ${apiCall.url} returned ${apiCall.status}`,
          context: {
            url: apiCall.url,
            method: apiCall.method,
            status: apiCall.status.toString(),
            error: apiCall.error,
          },
          resolved: false,
        })
      }

      sendToAnalytics('api_call', fullAPICall)
    },

    recordStateHydration: (hydration) => {
      const state = get()
      if (!state.isEnabled) return

      const fullHydration: StateHydrationMetric = {
        ...hydration,
        id: generateId(),
        timestamp: Date.now(),
      }

      set((state) => ({
        stateHydrations: [...state.stateHydrations, fullHydration].slice(-state.maxStorageSize),
      }))

      // Track slow hydrations
      if (hydration.duration > 100) { // 100ms
        get().recordError({
          type: 'performance',
          severity: 'low',
          message: `Slow state hydration: ${hydration.storeName} took ${hydration.duration}ms`,
          context: {
            storeName: hydration.storeName,
            duration: hydration.duration.toString(),
            source: hydration.source,
          },
          resolved: false,
        })
      }

      sendToAnalytics('state_hydration', fullHydration)
    },

    recordBundleMetrics: (bundle) => {
      const state = get()
      if (!state.isEnabled) return

      const fullBundle: BundleMetric = {
        ...bundle,
        id: generateId(),
        timestamp: Date.now(),
      }

      set((state) => ({
        bundleMetrics: [...state.bundleMetrics, fullBundle].slice(-state.maxStorageSize),
      }))

      sendToAnalytics('bundle_metrics', fullBundle)
    },

    recordError: (error) => {
      const state = get()
      if (!state.isEnabled) return

      const fullError: MonitoringError = {
        ...error,
        id: generateId(),
        timestamp: Date.now(),
        context: {
          ...error.context,
          url: state.currentUrl,
          userAgent: navigator.userAgent,
        },
      }

      set((state) => ({
        errors: [...state.errors, fullError].slice(-state.maxStorageSize),
      }))

      // Send critical errors to Sentry
      if (error.severity === 'critical' || error.severity === 'high') {
        Sentry.captureException(new Error(error.message), {
          level: error.severity === 'critical' ? 'fatal' : 'error',
          tags: {
            type: error.type,
            severity: error.severity,
          },
          extra: error.context,
        })
      }

      sendToAnalytics('error', fullError)
    },

    generateErrorReport: (): ErrorReport => {
      const state = get()
      const errors = state.errors

      const summary = {
        total: errors.length,
        byType: errors.reduce((acc, error) => {
          acc[error.type] = (acc[error.type] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        bySeverity: errors.reduce((acc, error) => {
          acc[error.severity] = (acc[error.severity] || 0) + 1
          return acc
        }, {} as Record<string, number>),
        resolved: errors.filter(e => e.resolved).length,
        unresolved: errors.filter(e => !e.resolved).length,
      }

      const now = Date.now()
      const oneHour = 60 * 60 * 1000
      const oneDay = 24 * oneHour
      const oneWeek = 7 * oneDay

      const trends = {
        hourly: getErrorTrend(errors, now - oneHour, oneHour / 24),
        daily: getErrorTrend(errors, now - oneDay, oneDay / 24),
        weekly: getErrorTrend(errors, now - oneWeek, oneWeek / 24),
      }

      return { errors, summary, trends }
    },

    getInteractionStats: (): UserInteractionStats => {
      const state = get()
      const interactions = state.userInteractions

      const interactionsByType = interactions.reduce((acc, interaction) => {
        acc[interaction.type] = (acc[interaction.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const sessionDurations = calculateSessionDurations(interactions)
      const averageSessionDuration = sessionDurations.length > 0 
        ? sessionDurations.reduce((a, b) => a + b, 0) / sessionDurations.length 
        : 0

      const bounceRate = calculateBounceRate(interactions)

      const elementCounts = interactions.reduce((acc, interaction) => {
        acc[interaction.target] = (acc[interaction.target] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const mostInteractedElements = Object.entries(elementCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([target, count]) => ({ target, count }))

      return {
        totalInteractions: interactions.length,
        interactionsByType,
        averageSessionDuration,
        bounceRate,
        mostInteractedElements,
      }
    },

    getAPIStats: (): APIStats => {
      const state = get()
      const apiCalls = state.apiCalls

      const totalCalls = apiCalls.length
      const averageResponseTime = totalCalls > 0 
        ? apiCalls.reduce((sum, call) => sum + call.duration, 0) / totalCalls 
        : 0

      const errorCalls = apiCalls.filter(call => call.status >= 400)
      const errorRate = totalCalls > 0 ? errorCalls.length / totalCalls : 0

      const cacheHits = apiCalls.filter(call => call.cacheHit)
      const cacheHitRate = totalCalls > 0 ? cacheHits.length / totalCalls : 0

      const endpointTimes = apiCalls.reduce((acc, call) => {
        if (!acc[call.url]) {
          acc[call.url] = { total: 0, count: 0 }
        }
        acc[call.url].total += call.duration
        acc[call.url].count += 1
        return acc
      }, {} as Record<string, { total: number; count: number }>)

      const slowestEndpoints = Object.entries(endpointTimes)
        .map(([url, { total, count }]) => ({ url, averageTime: total / count }))
        .sort((a, b) => b.averageTime - a.averageTime)
        .slice(0, 10)

      const errorsByStatus = errorCalls.reduce((acc, call) => {
        acc[call.status] = (acc[call.status] || 0) + 1
        return acc
      }, {} as Record<number, number>)

      return {
        totalCalls,
        averageResponseTime,
        errorRate,
        cacheHitRate,
        slowestEndpoints,
        errorsByStatus,
      }
    },

    getPerformanceStats: (): PerformanceStats => {
      const state = get()
      
      const bundleMetrics = state.bundleMetrics
      const hydrationMetrics = state.stateHydrations

      const averageLoadTime = bundleMetrics.length > 0
        ? bundleMetrics.reduce((sum, bundle) => sum + bundle.totalLoadTime, 0) / bundleMetrics.length
        : 0

      const bundleSize = bundleMetrics.length > 0
        ? bundleMetrics[bundleMetrics.length - 1].totalSize
        : 0

      const hydrationTime = hydrationMetrics.length > 0
        ? hydrationMetrics.reduce((sum, hydration) => sum + hydration.duration, 0) / hydrationMetrics.length
        : 0

      const criticalPathTime = bundleMetrics.length > 0
        ? bundleMetrics[bundleMetrics.length - 1].criticalPathSize
        : 0

      // Get memory usage from performance API
      let memoryUsage = 0
      const extendedPerformance = performance as ExtendedPerformance
      if (extendedPerformance.memory) {
        memoryUsage = extendedPerformance.memory.usedJSHeapSize
      }

      return {
        averageLoadTime,
        memoryUsage,
        bundleSize,
        hydrationTime,
        criticalPathTime,
      }
    },

    clearOldMetrics: () => {
      const state = get()
      const cutoff = Date.now() - state.retentionPeriod

      set((state) => ({
        userInteractions: state.userInteractions.filter(i => i.timestamp > cutoff),
        apiCalls: state.apiCalls.filter(c => c.timestamp > cutoff),
        stateHydrations: state.stateHydrations.filter(h => h.timestamp > cutoff),
        bundleMetrics: state.bundleMetrics.filter(b => b.timestamp > cutoff),
        errors: state.errors.filter(e => e.timestamp > cutoff),
      }))
    },

    exportMetrics: (): string => {
      const state = get()
      const exportData = {
        version: '2.4.0',
        timestamp: Date.now(),
        sessionId: state.sessionId,
        timeRange: {
          start: state.sessionStartTime,
          end: Date.now(),
        },
        metrics: {
          userInteractions: state.userInteractions,
          apiCalls: state.apiCalls,
          stateHydrations: state.stateHydrations,
          bundleMetrics: state.bundleMetrics,
          errors: state.errors,
        },
        summary: get().getMetricsSummary(),
      }

      return JSON.stringify(exportData, null, 2)
    },

    getMetricsSummary: (): MetricsSummary => {
      const state = get()
      return {
        timeRange: {
          start: state.sessionStartTime,
          end: Date.now(),
        },
        userInteractions: get().getInteractionStats(),
        apiPerformance: get().getAPIStats(),
        performance: get().getPerformanceStats(),
        errors: {
          total: state.errors.length,
          byType: state.errors.reduce((acc, error) => {
            acc[error.type] = (acc[error.type] || 0) + 1
            return acc
          }, {} as Record<string, number>),
        },
      }
    },
  }))
)

// ==================== Utility Functions ====================

function generateSessionId(): string {
  return `session-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function generateId(): string {
  return `metric-${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function getCurrentUserId(): string | undefined {
  // This would integrate with your auth system
  // For now, return undefined
  return undefined
}

function getErrorTrend(errors: MonitoringError[], since: number, bucketSize: number): number[] {
  const buckets: number[] = new Array(24).fill(0)
  const now = Date.now()

  errors
    .filter(error => error.timestamp >= since)
    .forEach(error => {
      const bucketIndex = Math.floor((now - error.timestamp) / bucketSize)
      if (bucketIndex >= 0 && bucketIndex < buckets.length) {
        buckets[buckets.length - 1 - bucketIndex]++
      }
    })

  return buckets
}

function calculateSessionDurations(interactions: UserInteractionMetric[]): number[] {
  // Group interactions by session
  const sessions = interactions.reduce((acc, interaction) => {
    const sessionId = interaction.metadata.sessionId
    if (!acc[sessionId]) {
      acc[sessionId] = []
    }
    acc[sessionId].push(interaction)
    return acc
  }, {} as Record<string, UserInteractionMetric[]>)

  // Calculate duration for each session
  return Object.values(sessions).map(sessionInteractions => {
    if (sessionInteractions.length < 2) return 0
    
    const sorted = sessionInteractions.sort((a, b) => a.timestamp - b.timestamp)
    return sorted[sorted.length - 1].timestamp - sorted[0].timestamp
  })
}

function calculateBounceRate(interactions: UserInteractionMetric[]): number {
  const sessions = interactions.reduce((acc, interaction) => {
    const sessionId = interaction.metadata.sessionId
    if (!acc[sessionId]) {
      acc[sessionId] = 0
    }
    acc[sessionId]++
    return acc
  }, {} as Record<string, number>)

  const sessionCounts = Object.values(sessions)
  const singleInteractionSessions = sessionCounts.filter(count => count === 1).length
  
  return sessionCounts.length > 0 ? singleInteractionSessions / sessionCounts.length : 0
}

function sendToAnalytics(eventType: string, data: unknown) {
  // Integration point for analytics services (GA4, Mixpanel, etc.)
  if (process.env.NODE_ENV === 'development') {
    console.log(`Analytics event: ${eventType}`, data)
  }
  
  // Example: Send to Google Analytics
  const windowWithMonitoring = window as WindowWithMonitoring
  if (windowWithMonitoring.gtag) {
    windowWithMonitoring.gtag('event', eventType, {
      custom_parameter: JSON.stringify(data),
    })
  }
}

// ==================== Event Listeners Setup ====================

let eventListenersSetup = false

function setupEventListeners() {
  if (eventListenersSetup || typeof window === 'undefined') return
  
  const collector = useMetricsCollector.getState()
  
  // Click tracking
  window.addEventListener('click', (event) => {
    const target = event.target as HTMLElement
    collector.recordUserInteraction({
      type: 'click',
      target: getElementSelector(target),
    })
  })

  // Navigation tracking
  const originalPushState = history.pushState
  const originalReplaceState = history.replaceState

  history.pushState = function(...args) {
    originalPushState.apply(history, args)
    collector.recordUserInteraction({
      type: 'navigation',
      target: window.location.pathname,
    })
  }

  history.replaceState = function(...args) {
    originalReplaceState.apply(history, args)
    collector.recordUserInteraction({
      type: 'navigation',
      target: window.location.pathname,
    })
  }

  window.addEventListener('popstate', () => {
    collector.recordUserInteraction({
      type: 'navigation',
      target: window.location.pathname,
    })
  })

  // Scroll tracking (throttled)
  let scrollTimeout: number | NodeJS.Timeout
  window.addEventListener('scroll', () => {
    clearTimeout(scrollTimeout as NodeJS.Timeout)
    scrollTimeout = setTimeout(() => {
      collector.recordUserInteraction({
        type: 'scroll',
        target: `${window.scrollY}px`,
      })
    }, 100)
  })

  eventListenersSetup = true
}

function cleanupEventListeners() {
  eventListenersSetup = false
  // Event listeners will be cleaned up when the page unloads
}

function getElementSelector(element: HTMLElement): string {
  if (element.id) return `#${element.id}`
  if (element.className) return `.${element.className.split(' ').join('.')}`
  return element.tagName.toLowerCase()
}

function setupSentryIntegration() {
  // Configure Sentry with custom metrics using v8 API
  Sentry.addEventProcessor((event) => {
    const collector = useMetricsCollector.getState()
    event.extra = {
      ...event.extra,
      sessionId: collector.sessionId,
      metricsCount: {
        userInteractions: collector.userInteractions.length,
        apiCalls: collector.apiCalls.length,
        errors: collector.errors.length,
      },
    }
    return event
  })
}

// ==================== Auto-initialization ====================

if (process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'production') {
  if (typeof window !== 'undefined') {
    // Auto-start collection
    const collector = useMetricsCollector.getState()
    collector.startCollection()
    
    // Expose to global for debugging
    const windowWithMonitoring = window as WindowWithMonitoring
    windowWithMonitoring.__metricsCollector = {
      getState: useMetricsCollector.getState,
    }
  }
}

export type { 
  MetricsCollectorState, 
  UserInteractionMetric, 
  APICallMetric, 
  StateHydrationMetric, 
  BundleMetric,
  MetricsSummary 
}