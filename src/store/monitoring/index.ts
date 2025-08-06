/**
 * Performance Monitoring & State Debugging
 * Phase 2.4 - Comprehensive monitoring architecture for DCE Platform
 * 
 * Main entry point for all monitoring and debugging tools
 */

// ==================== Core Monitoring Systems ====================

export { usePerformanceMonitor } from './performanceMonitor'
export { useMetricsCollector } from './metricsCollector'

// ==================== State Debugging Tools ====================

export { useStateDebugger } from '../debugging/stateDebugger'
export { useDevToolsExtension } from '../debugging/devToolsExtension'
export { useDeveloperTools } from '../debugging/developerTools'

// ==================== Integration Utilities ====================

export {
  createMonitoringMiddleware,
  createEnhancedDevToolsMiddleware,
  integrateExistingStore,
  trackEntityAdapterPerformance,
  trackQueryPerformance,
  createTrackedSelector,
  setupMonitoringForAllStores,
  setupEnhancedDevTools,
  useMonitoringIntegration,
  autoDetectAndMonitorStores,
} from '../utils/monitoringIntegration'

// ==================== Types ====================

export type {
  // Performance types
  PerformanceMetrics,
  StateChangeMetric,
  QueryCacheMetrics,
  EntityAdapterMetrics,
  PerformanceReport,
  PerformanceSummary,
  PerformanceRecommendation,
  PerformanceTrend,
  
  // State debugging types
  StateSnapshot,
  StateAction,
  StateMetadata,
  StateDiff,
  StateChangeHistory,
  StateMachineTransition,
  StateMachineDebugInfo,
  SelectorDependency,
  SelectorGraph,
  
  // DevTools types
  DevToolsMessage,
  DevToolsState,
  DevToolsCapability,
  DevToolsFilter,
  
  // Metrics types
  MonitoringError,
  ErrorReport,
  
  // Developer tools types
  DeveloperCommand,
  PerformanceReport as DevPerformanceReport,
  
  // Configuration types
  MonitoringConfig,
  MiddlewareConfig,
  
  // Constants
  MONITORING_CONSTANTS,
  PERFORMANCE_THRESHOLDS,
  
  // Window extensions
  WindowWithMonitoring,
} from './types'

// Import WindowWithMonitoring for runtime use
import type { WindowWithMonitoring } from './types'

// ==================== Developer Console Setup ====================

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Import and setup developer tools
  import('./performanceMonitor').then(({ usePerformanceMonitor }) => {
    const monitor = usePerformanceMonitor.getState()
    if (!monitor.isEnabled) {
      monitor.startMonitoring()
    }
  })

  import('../debugging/stateDebugger').then(({ useStateDebugger }) => {
    const stateDebugger = useStateDebugger.getState()
    if (!stateDebugger.isDebugging) {
      stateDebugger.startDebugging()
    }
  })

  import('./metricsCollector').then(({ useMetricsCollector }) => {
    const collector = useMetricsCollector.getState()
    if (!collector.isEnabled) {
      collector.startCollection()
    }
  })

  import('../debugging/devToolsExtension').then(({ useDevToolsExtension }) => {
    const devTools = useDevToolsExtension.getState()
    if (!devTools.isConnected) {
      devTools.connect()
    }
  })

  // Setup auto-detection of stores
  import('../utils/monitoringIntegration').then(({ autoDetectAndMonitorStores }) => {
    setTimeout(autoDetectAndMonitorStores, 1000)
  })
}

// ==================== Constants Export ====================

export const MONITORING_VERSION = '2.4.0'

export const DEFAULT_CONFIG = {
  performance: {
    enabled: process.env.NODE_ENV === 'development',
    samplingRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    maxHistorySize: 1000,
  },
  debugging: {
    enabled: process.env.NODE_ENV === 'development',
    maxHistorySize: 500,
    enableTimeTravel: process.env.NODE_ENV === 'development',
  },
  metrics: {
    enabled: true,
    samplingRate: process.env.NODE_ENV === 'development' ? 1.0 : 0.1,
    retentionPeriod: 24 * 60 * 60 * 1000, // 24 hours
  },
  devTools: {
    enabled: process.env.NODE_ENV === 'development',
    enhancedPanels: true,
    performanceAlerts: true,
  },
} as const

// ==================== Quick Setup Functions ====================

/**
 * Initialize all monitoring systems with default configuration
 */
export function initializeMonitoring(config?: unknown) {
  const finalConfig = { ...DEFAULT_CONFIG, ...(config as Partial<typeof DEFAULT_CONFIG> || {}) }
  
  if (typeof window === 'undefined') return
  
  console.log(`🔍 DCE Monitoring v${MONITORING_VERSION} initializing...`)
  
  // Initialize performance monitoring
  if (finalConfig.performance.enabled) {
    import('./performanceMonitor').then(({ usePerformanceMonitor }) => {
      const monitor = usePerformanceMonitor.getState()
      monitor.updateConfig(finalConfig.performance)
      monitor.startMonitoring()
    })
  }
  
  // Initialize state debugging
  if (finalConfig.debugging.enabled) {
    import('../debugging/stateDebugger').then(({ useStateDebugger }) => {
      const stateDebugger = useStateDebugger.getState()
      stateDebugger.startDebugging()
      if (finalConfig.debugging.enableTimeTravel) {
        stateDebugger.enableTimeTravel()
      }
    })
  }
  
  // Initialize metrics collection
  if (finalConfig.metrics.enabled) {
    import('./metricsCollector').then(({ useMetricsCollector }) => {
      const collector = useMetricsCollector.getState()
      collector.startCollection()
    })
  }
  
  // Initialize DevTools
  if (finalConfig.devTools.enabled) {
    import('../debugging/devToolsExtension').then(({ useDevToolsExtension }) => {
      const devTools = useDevToolsExtension.getState()
      devTools.connect()
    })
  }
  
  console.log('🔍 DCE Monitoring initialized successfully')
}

/**
 * Get current monitoring status
 */
export function getMonitoringStatus() {
  if (typeof window === 'undefined') {
    return {
      performance: false,
      debugging: false,
      metrics: false,
      devTools: false,
    }
  }
  
  const windowWithMonitoring = window as WindowWithMonitoring
  return {
    performance: windowWithMonitoring.__performanceMonitor?.getState()?.isEnabled || false,
    debugging: windowWithMonitoring.__stateDebugger?.getState()?.isDebugging || false,
    metrics: windowWithMonitoring.__metricsCollector?.getState()?.isEnabled || false,
    devTools: windowWithMonitoring.__dceDevTools?.getState()?.isConnected || false,
  }
}

/**
 * Generate comprehensive monitoring report
 */
export async function generateComprehensiveReport() {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('Comprehensive reports are only available in development mode')
    return null
  }
  
  const reports = await Promise.allSettled([
    import('./performanceMonitor').then(({ usePerformanceMonitor }) => 
      usePerformanceMonitor.getState().generateReport()
    ),
    import('./metricsCollector').then(({ useMetricsCollector }) => 
      useMetricsCollector.getState().getMetricsSummary()
    ),
    import('../debugging/stateDebugger').then(({ useStateDebugger }) => ({
      leaks: useStateDebugger.getState().findStateLeaks(),
      growth: useStateDebugger.getState().analyzeStateGrowth(),
    })),
    import('../debugging/developerTools').then(({ useDeveloperTools }) => 
      useDeveloperTools.getState().generateAutomatedReport()
    ),
  ])
  
  const [performanceReport, metricsReport, stateAnalysis, devToolsReport] = reports
  
  return {
    timestamp: Date.now(),
    version: MONITORING_VERSION,
    performance: performanceReport.status === 'fulfilled' ? performanceReport.value : null,
    metrics: metricsReport.status === 'fulfilled' ? metricsReport.value : null,
    state: stateAnalysis.status === 'fulfilled' ? stateAnalysis.value : null,
    devTools: devToolsReport.status === 'fulfilled' ? devToolsReport.value : null,
    errors: reports
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map(r => r.reason),
  }
}

// ==================== Global Console Commands ====================

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Enhanced global commands
  const windowWithMonitoring = window as WindowWithMonitoring
  windowWithMonitoring.__dceMonitoring = {
    version: MONITORING_VERSION,
    initialize: initializeMonitoring,
    status: getMonitoringStatus,
    report: generateComprehensiveReport,
    
    // Quick access to individual systems
    performance: () => windowWithMonitoring.__performanceMonitor,
    debugger: () => windowWithMonitoring.__stateDebugger,
    metrics: () => windowWithMonitoring.__metricsCollector,
    devTools: () => windowWithMonitoring.__dceDevTools,
    
    // Utilities
    help: () => {
      console.log(`
🔍 DCE Monitoring v${MONITORING_VERSION} - Global Commands

System Access:
  __dceMonitoring.performance()  - Performance monitor
  __dceMonitoring.debugger()     - State debugger
  __dceMonitoring.metrics()      - Metrics collector
  __dceMonitoring.devTools()     - DevTools extension

Quick Commands:
  __dce.help()                   - Show developer commands
  __dce.state()                  - Inspect store states
  __dce.perf()                   - Performance metrics
  __dce.memory()                 - Memory analysis
  __dce.report()                 - Generate report

System Management:
  __dceMonitoring.status()       - Check system status
  __dceMonitoring.report()       - Comprehensive report
  __dceMonitoring.initialize()   - Re-initialize systems

For detailed API documentation, see:
/src/store/monitoring/README.md
      `)
    },
  }
  
  console.log(`
🔍 DCE Monitoring v${MONITORING_VERSION} loaded!

Quick start:
  __dceMonitoring.help()  - Show all commands
  __dce.help()            - Show developer commands
  
For full documentation: /src/store/monitoring/README.md
  `)
}