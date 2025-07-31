import React, { useCallback, useContext, createContext } from 'react'
import { BlogPerformance } from './BlogPerformance'
import type { 
  BlogPerformanceConfig, 
  BlogPerformanceContextValue 
} from './BlogPerformance'

/**
 * Context for sharing performance data across components
 */
export const BlogPerformanceContext = createContext<BlogPerformanceContextValue | null>(null)

/**
 * Custom hook to access blog performance context
 */
export function useBlogPerformance(): BlogPerformanceContextValue {
  const context = useContext(BlogPerformanceContext)
  if (!context) {
    throw new Error('useBlogPerformance must be used within a BlogPerformance provider')
  }
  return context
}

/**
 * Higher-order component for wrapping blog components with performance monitoring
 */
export function withBlogPerformance<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  performanceConfig?: Partial<BlogPerformanceConfig>
) {
  const WithBlogPerformanceComponent = (props: P) => {
    const componentName = WrappedComponent.displayName || WrappedComponent.name || 'UnknownComponent'
    
    return (
      <BlogPerformance
        config={performanceConfig}
        componentName={componentName.toLowerCase()}
      >
        <WrappedComponent {...props} />
      </BlogPerformance>
    )
  }

  WithBlogPerformanceComponent.displayName = `withBlogPerformance(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return WithBlogPerformanceComponent
}

/**
 * Hook for blog-specific performance measurements
 */
export function useBlogMetrics() {
  const { startTracking, stopTracking, trackUserAction, trackApiCall } = useBlogPerformance()

  const measureReadingTime = useCallback((actualTime: number, estimatedTime: number) => {
    const accuracy = Math.abs(actualTime - estimatedTime) / estimatedTime
    trackUserAction('reading-time-measured', { actualTime, estimatedTime, accuracy })
    return accuracy
  }, [trackUserAction])

  const measureContentRender = useCallback(async (renderFn: () => Promise<void> | void) => {
    startTracking('content-render')
    try {
      await renderFn()
    } finally {
      stopTracking('content-render')
    }
  }, [startTracking, stopTracking])

  const measureImageLoad = useCallback(async (loadFn: () => Promise<void>) => {
    startTracking('image-load')
    try {
      await loadFn()
    } finally {
      stopTracking('image-load')
    }
  }, [startTracking, stopTracking])

  const measureCommentsLoad = useCallback(async (loadFn: () => Promise<void>) => {
    startTracking('comments-load')
    try {
      await loadFn()
    } finally {
      stopTracking('comments-load')
    }
  }, [startTracking, stopTracking])

  return {
    measureReadingTime,
    measureContentRender,
    measureImageLoad,
    measureCommentsLoad,
    trackUserAction,
    trackApiCall,
  }
}