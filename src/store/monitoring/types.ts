/**
 * Performance Monitoring and State Debugging Types
 * Phase 2.4 - Comprehensive monitoring architecture
 */

import type { StateCreator } from 'zustand'

// ==================== Performance Metrics ====================

export interface PerformanceMonitorConfig {
  isEnabled: boolean
  samplingRate: number
  maxHistorySize: number
  webVitalsEnabled: boolean
  storeTrackingEnabled: boolean
  queryTrackingEnabled: boolean
}

export interface PerformanceMetrics {
  storeUpdateFrequency: number
  selectorComputationTime: number
  reRenderCount: number
  memoryUsage: number
  stateSize: number
  queryCacheSize: number
  entityAdapterPerformance: EntityAdapterMetrics
}

export interface EntityAdapterMetrics {
  entityCount: number
  normalizedSize: number
  indexBuildTime: number
  selectorExecutionTime: number
  cacheHitRate: number
}

export interface StateChangeMetric {
  timestamp: number
  storeName: string
  actionType: string
  stateSize: number
  computationTime: number
  affectedSelectors: string[]
  reRenderTriggers: number
}

export interface QueryCacheMetrics {
  totalQueries: number
  activeQueries: number
  stalQueries: number
  errorQueries: number
  cacheSize: number
  hitRate: number
  missRate: number
  averageQueryTime: number
}

// ==================== State Debugging ====================

export interface StateSnapshot {
  id: string
  timestamp: number
  storeName: string
  state: unknown
  action?: StateAction
  metadata: StateMetadata
}

export interface StateAction {
  type: string
  payload?: unknown
  timestamp: number
  source: 'user' | 'system' | 'api' | 'subscription'
}

export interface StateMetadata {
  version: number
  size: number
  diff?: StateDiff
  performance: {
    executionTime: number
    memoryDelta: number
    selectorCalls: number
  }
}

export interface StateDiff {
  added: Record<string, unknown>
  removed: Record<string, unknown>
  modified: Record<string, { from: unknown; to: unknown }>
}

export interface StateChangeHistory {
  snapshots: string[] // Array of snapshot IDs
  maxHistory: number
  currentIndex: number
  filters: HistoryFilter[]
}

export interface HistoryFilter {
  type: 'action' | 'store' | 'timeRange' | 'size'
  value: unknown
  enabled: boolean
}

// ==================== State Machine Debugging ====================

export interface StateMachineTransition {
  id: string
  timestamp: number
  from: string
  to: string
  trigger: string
  context?: unknown
  guards?: GuardResult[]
  sideEffects?: SideEffect[]
}

export interface GuardResult {
  name: string
  passed: boolean
  reason?: string
  executionTime: number
}

export interface SideEffect {
  name: string
  type: 'sync' | 'async'
  status: 'pending' | 'completed' | 'failed'
  result?: unknown
  error?: Error
  executionTime?: number
}

export interface StateMachineDebugInfo {
  currentState: string
  availableTransitions: string[]
  history: StateMachineTransition[]
  context: unknown
  guards: Record<string, boolean>
}

// ==================== Selector Debugging ====================

export interface SelectorDependency {
  selectorName: string
  dependencies: string[]
  subscribers: string[]
  computationTime: number
  callCount: number
  cacheHits: number
  cacheMisses: number
}

export interface SelectorGraph {
  nodes: SelectorNode[]
  edges: SelectorEdge[]
  cycles: string[][]
}

export interface SelectorNode {
  id: string
  name: string
  type: 'selector' | 'computed' | 'derived'
  computationTime: number
  callFrequency: number
  cacheEfficiency: number
}

export interface SelectorEdge {
  from: string
  to: string
  weight: number
  type: 'dependency' | 'subscription'
}

// ==================== DevTools Integration ====================

export interface DevToolsMessage {
  type: 'STATE_CHANGE' | 'PERFORMANCE_UPDATE' | 'ERROR' | 'WARNING'
  payload: unknown
  timestamp: number
  metadata?: Record<string, unknown>
}

export interface DevToolsState {
  isConnected: boolean
  capabilities: DevToolsCapability[]
  activeStore?: string
  selectedSnapshot?: string
  filters: DevToolsFilter[]
}

export interface DevToolsCapability {
  name: string
  version: string
  enabled: boolean
  features: string[]
}

export interface DevToolsFilter {
  type: 'store' | 'action' | 'timeRange' | 'performance'
  criteria: unknown
  active: boolean
}

// ==================== Monitoring Configuration ====================

export interface MonitoringConfig {
  enabled: boolean
  samplingRate: number
  maxHistorySize: number
  performanceThresholds: PerformanceThresholds
  debugLevel: 'none' | 'basic' | 'verbose' | 'debug'
  features: MonitoringFeature[]
}

export interface PerformanceThresholds {
  stateUpdateTime: number
  selectorComputationTime: number
  memoryUsage: number
  queryCacheSize: number
  reRenderThreshold: number
}

export interface MonitoringFeature {
  name: string
  enabled: boolean
  options?: Record<string, unknown>
}

// ==================== Developer Tools ====================

export interface DeveloperCommand {
  name: string
  description: string
  category: 'debugging' | 'performance' | 'state' | 'query'
  execute: (args?: unknown[]) => Promise<unknown> | unknown
  examples: string[]
}

export interface PerformanceReport {
  summary: PerformanceSummary
  recommendations: PerformanceRecommendation[]
  metrics: PerformanceMetrics
  trends: PerformanceTrend[]
}

export interface PerformanceSummary {
  overallScore: number
  bottlenecks: string[]
  improvements: string[]
  warnings: string[]
}

export interface PerformanceRecommendation {
  type: 'critical' | 'warning' | 'suggestion'
  category: string
  description: string
  solution: string
  impact: 'high' | 'medium' | 'low'
  effort: 'low' | 'medium' | 'high'
}

export interface PerformanceTrend {
  metric: string
  values: number[]
  timestamps: number[]
  trend: 'improving' | 'degrading' | 'stable'
  projection?: number
}

// ==================== Store Middleware ====================

export interface MonitoringMiddleware {
  <T>(
    f: StateCreator<T, [], [], T>,
    name?: string
  ): StateCreator<T, [], [], T>
}

export interface MiddlewareConfig {
  name: string
  enabled: boolean
  options: {
    trackPerformance: boolean
    trackStateChanges: boolean
    trackSelectors: boolean
    enableTimeTravel: boolean
    maxHistorySize: number
  }
}

// ==================== Error Handling ====================

export interface MonitoringError {
  id: string
  timestamp: number
  type: 'performance' | 'state' | 'selector' | 'query' | 'system'
  severity: 'low' | 'medium' | 'high' | 'critical'
  message: string
  stack?: string
  context: {
    storeName?: string
    actionType?: string
    selectorName?: string
    queryKey?: string
    userAgent?: string
    url?: string
    sizeKB?: number  // For performance monitoring of store size
    duration?: string
    method?: string
    status?: string
    error?: string
    [key: string]: unknown  // Allow additional properties
  }
  resolved: boolean
}

export interface ErrorReport {
  errors: MonitoringError[]
  summary: {
    total: number
    byType: Record<string, number>
    bySeverity: Record<string, number>
    resolved: number
    unresolved: number
  }
  trends: {
    hourly: number[]
    daily: number[]
    weekly: number[]
  }
}

// ==================== Global Window Extensions ====================

export interface WindowWithMonitoring extends Window {
  __performanceMonitor?: {
    getState: () => {
      isEnabled: boolean
      generateReport: () => Promise<PerformanceReport>
      startMonitoring: () => void
      stopMonitoring: () => void
      updateConfig: (config: Partial<PerformanceMonitorConfig>) => void
    }
  }
  __stateDebugger?: {
    getState: () => {
      isDebugging: boolean
      startDebugging: () => void
      findStateLeaks: () => unknown
      analyzeStateGrowth: () => unknown
    }
  }
  __metricsCollector?: {
    getState: () => {
      isEnabled: boolean
      startCollection: () => void
      getMetricsSummary: () => unknown
    }
  }
  __dceDevTools?: {
    getState: () => {
      isConnected: boolean
    }
  }
  __dceMonitoring?: {
    version: string
    initialize: (config?: unknown) => void
    status: () => Record<string, boolean>
    report: () => Promise<unknown>
    performance: () => unknown
    debugger: () => unknown
    metrics: () => unknown
    devTools: () => unknown
    help: () => void
  }
  __performanceMonitorInterval?: number | NodeJS.Timeout
  gtag?: (command: string, eventName: string, parameters?: Record<string, unknown>) => void
}

// ==================== Performance API Extensions ====================

export interface PerformanceMemory {
  readonly usedJSHeapSize: number
  readonly totalJSHeapSize: number
  readonly jsHeapSizeLimit: number
}

export interface ExtendedPerformance extends Performance {
  memory?: PerformanceMemory
}

// ==================== Export All Types ====================

export type {
  // Re-export for convenience
  StateCreator,
}

// Constants for monitoring
export const MONITORING_CONSTANTS = {
  DEFAULT_SAMPLING_RATE: 0.1,
  MAX_HISTORY_SIZE: 1000,
  PERFORMANCE_CHECK_INTERVAL: 1000,
  ERROR_THROTTLE_INTERVAL: 5000,
  DEVTOOLS_MESSAGE_THROTTLE: 100,
} as const

export const PERFORMANCE_THRESHOLDS = {
  STATE_UPDATE_TIME: 5, // ms
  SELECTOR_COMPUTATION_TIME: 2, // ms
  MEMORY_USAGE: 50 * 1024 * 1024, // 50MB
  QUERY_CACHE_SIZE: 100, // number of queries
  RE_RENDER_THRESHOLD: 10, // renders per second
} as const