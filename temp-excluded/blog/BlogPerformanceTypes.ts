/**
 * Core Web Vitals interfaces
 */
export interface WebVitalMetric {
  name: 'CLS' | 'LCP' | 'FID' | 'INP' | 'FCP' | 'TTFB'
  value: number
  rating: 'good' | 'needs-improvement' | 'poor'
  threshold: { good: number; poor: number }
}

export interface BlogPerformanceMetrics {
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

export interface ClickEvent {
  element: string
  timestamp: number
  position: { x: number; y: number }
  metadata?: Record<string, unknown>
}

export interface PerformanceBudget {
  lcp: number // 2500ms
  fid: number // 100ms
  cls: number // 0.1
  contentRender: number // 1000ms
  imageLoad: number // 2000ms
  apiResponse: number // 500ms
}

export interface BlogPerformanceConfig {
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

export interface BlogPerformanceContextValue {
  metrics: BlogPerformanceMetrics
  isRecording: boolean
  startTracking: (componentName: string) => void
  stopTracking: (componentName: string) => void
  trackUserAction: (action: string, metadata?: Record<string, unknown>) => void
  trackApiCall: <T>(name: string, call: () => Promise<T>) => Promise<T>
  getPerformanceReport: () => PerformanceReport
}

export interface PerformanceReport {
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

export interface BlogPerformanceProps {
  children: React.ReactNode
  config?: Partial<BlogPerformanceConfig>
  componentName?: string
  enableRealTimeUpdates?: boolean
  onPerformanceUpdate?: (metrics: BlogPerformanceMetrics) => void
  onBudgetExceeded?: (metric: string, value: number, budget: number) => void
  className?: string
}