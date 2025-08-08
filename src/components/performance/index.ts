/**
 * Performance optimization components for React 19.1
 * Exports optimized components with lazy loading, memoization, and efficient rendering
 */

// Core performance components
export { LazyImage } from './LazyImage'
export { VirtualScroller, MemoizedVirtualScroller } from './VirtualScroller'
export { OptimizedDashboard } from './OptimizedDashboard'

// Service worker integration
export { 
  ServiceWorkerProvider, 
  UpdatePrompt, 
  OfflineIndicator, 
  useServiceWorker 
} from './ServiceWorkerProvider'

// Performance hooks and utilities
export { 
  useIntersectionObserver, 
  useIsVisible, 
  useLazyLoad 
} from '../../hooks/useIntersectionObserver'

export { 
  usePreloader, 
  useCriticalPreload, 
  useRoutePrefetch 
} from '../../hooks/usePreloader'

export { 
  performanceMonitor, 
  usePerformanceTracking, 
  PERFORMANCE_THRESHOLDS 
} from '../../lib/performance-monitor'

// Re-export optimized hooks
export { 
  useRealtimeChannel,
  usePostCommentsChannel, 
  usePostViewsChannel,
  useCallTrackingChannel,
  useRealtimeDebugger
} from '../../hooks/useRealtimeChannel'