/**
 * Developer Experience Utilities
 * Phase 2.4 - Console utilities, performance profiling, and automated reports
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import { usePerformanceMonitor } from '../monitoring/performanceMonitor'
import { useStateDebugger } from './stateDebugger'
import { useMetricsCollector } from '../monitoring/metricsCollector'
import { useDevToolsExtension } from './devToolsExtension'
import type {
  DeveloperCommand,
  PerformanceReport,
  PerformanceRecommendation,
} from '../monitoring/types'

// ==================== Developer Tools State ====================

interface DeveloperToolsState {
  // Available commands
  commands: Map<string, DeveloperCommand>
  commandHistory: string[]
  
  // Profiling
  isProfileActive: boolean
  profileData: ProfileData | null
  
  // Automated reports
  autoReportEnabled: boolean
  reportInterval: number
  lastReportTime: number
  
  // Warning system
  warnings: DeveloperWarning[]
  warningThresholds: WarningThresholds
  
  // Console utilities
  logLevel: 'debug' | 'info' | 'warn' | 'error'
  
  // Actions
  registerCommand: (command: DeveloperCommand) => void
  executeCommand: (commandName: string, args?: unknown[]) => Promise<unknown>
  startProfiling: (duration?: number) => void
  stopProfiling: () => ProfileData | null
  generateAutomatedReport: () => Promise<PerformanceReport>
  addWarning: (warning: DeveloperWarning) => void
  clearWarnings: () => void
  updateThresholds: (thresholds: Partial<WarningThresholds>) => void
}

interface ProfileData {
  startTime: number
  endTime: number
  duration: number
  stateChanges: number
  renderCount: number
  apiCalls: number
  memoryUsage: {
    start: number
    end: number
    peak: number
  }
  bottlenecks: string[]
  recommendations: string[]
}

interface DeveloperWarning {
  id: string
  timestamp: number
  type: 'performance' | 'state' | 'api' | 'memory' | 'pattern'
  severity: 'low' | 'medium' | 'high'
  message: string
  details: string
  solution?: string
  dismissed: boolean
}

interface WarningThresholds {
  stateUpdateTime: number
  memoryGrowth: number
  apiResponseTime: number
  reRenderCount: number
  selectorComputationTime: number
}

const defaultThresholds: WarningThresholds = {
  stateUpdateTime: 5, // ms
  memoryGrowth: 10 * 1024 * 1024, // 10MB
  apiResponseTime: 2000, // 2s
  reRenderCount: 10,
  selectorComputationTime: 2, // ms
}

// ==================== Developer Tools Store ====================

export const useDeveloperTools = create<DeveloperToolsState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    commands: new Map(),
    commandHistory: [],
    isProfileActive: false,
    profileData: null,
    autoReportEnabled: false,
    reportInterval: 300000, // 5 minutes
    lastReportTime: 0,
    warnings: [],
    warningThresholds: defaultThresholds,
    logLevel: 'info',

    registerCommand: (command: DeveloperCommand) => {
      set((state) => ({
        commands: new Map(state.commands).set(command.name, command),
      }))
    },

    executeCommand: async (commandName: string, args: unknown[] = []): Promise<unknown> => {
      const state = get()
      const command = state.commands.get(commandName)
      
      if (!command) {
        throw new Error(`Command '${commandName}' not found`)
      }

      // Add to history
      const historyEntry = args.length > 0 
        ? `${commandName}(${args.map(arg => JSON.stringify(arg)).join(', ')})`
        : `${commandName}()`
      
      set((state) => ({
        commandHistory: [...state.commandHistory, historyEntry].slice(-100),
      }))

      try {
        const result = await command.execute(args)
        console.log(`✅ Command '${commandName}' executed successfully:`, result)
        return result
      } catch (error) {
        console.error(`❌ Command '${commandName}' failed:`, error)
        throw error
      }
    },

    startProfiling: (duration = 10000) => {
      if (get().isProfileActive) {
        console.warn('Profiling is already active')
        return
      }

      interface PerformanceWithMemory extends Performance {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      
      const perfWithMemory = performance as PerformanceWithMemory
      const startMemory = perfWithMemory.memory?.usedJSHeapSize ?? 0

      set({
        isProfileActive: true,
        profileData: null,
      })

      // Collect metrics during profiling
      const metrics = {
        stateChanges: 0,
        renderCount: 0,
        apiCalls: 0,
        memoryPeak: startMemory,
      }

      // Set up monitoring
      setupProfilingMonitors(metrics)

      // Auto-stop after duration
      setTimeout(() => {
        const profileData = get().stopProfiling()
        if (profileData) {
          console.log('🔍 Profiling completed:', profileData)
        }
      }, duration)

      console.log(`🚀 Profiling started for ${duration}ms`)
    },

    stopProfiling: (): ProfileData | null => {
      const state = get()
      if (!state.isProfileActive) {
        console.warn('No active profiling session')
        return null
      }

      const endTime = performance.now()
      
      interface PerformanceWithMemory extends Performance {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      
      const perfWithMemory = performance as PerformanceWithMemory
      const endMemory = perfWithMemory.memory?.usedJSHeapSize ?? 0

      // Cleanup monitors
      cleanupProfilingMonitors()

      const profileData: ProfileData = {
        startTime: endTime - 10000, // Approximate
        endTime,
        duration: 10000, // This would be calculated properly
        stateChanges: 0, // Would be collected during profiling
        renderCount: 0, // Would be collected during profiling
        apiCalls: 0, // Would be collected during profiling
        memoryUsage: {
          start: 0, // Would be stored from start
          end: endMemory,
          peak: endMemory, // Would track peak during profiling
        },
        bottlenecks: [], // Would be analyzed from collected data
        recommendations: [], // Would be generated from analysis
      }

      set({
        isProfileActive: false,
        profileData,
      })

      return profileData
    },

    generateAutomatedReport: async (): Promise<PerformanceReport> => {
      const perfMonitor = usePerformanceMonitor.getState()
      const metricsCollector = useMetricsCollector.getState()
      
      // Generate comprehensive report
      const report = await perfMonitor.generateReport()
      
      // Add additional insights from metrics
      const metrics = metricsCollector.getMetricsSummary()
      
      // Enhance recommendations with developer-specific advice
      const enhancedRecommendations = enhanceRecommendations(report.recommendations, metrics)
      
      const enhancedReport: PerformanceReport = {
        ...report,
        recommendations: enhancedRecommendations,
      }

      set({ lastReportTime: Date.now() })
      
      return enhancedReport
    },

    addWarning: (warning: DeveloperWarning) => {
      set((state) => ({
        warnings: [...state.warnings, warning].slice(-100), // Keep last 100 warnings
      }))

      // Log warning to console based on severity
      const logFn = warning.severity === 'high' ? console.error : 
                   warning.severity === 'medium' ? console.warn : 
                   console.info

      logFn(`⚠️ ${warning.type.toUpperCase()}: ${warning.message}`)
      if (warning.details) {
        console.log(`   Details: ${warning.details}`)
      }
      if (warning.solution) {
        console.log(`   Solution: ${warning.solution}`)
      }
    },

    clearWarnings: () => {
      set({ warnings: [] })
    },

    updateThresholds: (thresholds: Partial<WarningThresholds>) => {
      set((state) => ({
        warningThresholds: { ...state.warningThresholds, ...thresholds },
      }))
    },
  }))
)

// ==================== Built-in Commands ====================

const builtInCommands: DeveloperCommand[] = [
  {
    name: 'help',
    description: 'Show all available commands',
    category: 'debugging',
    execute: () => {
      const state = useDeveloperTools.getState()
      const commands = Array.from(state.commands.values())
      console.table(commands.map(cmd => ({
        name: cmd.name,
        category: cmd.category,
        description: cmd.description,
      })))
      return commands
    },
    examples: ['help'],
  },
  
  {
    name: 'state',
    description: 'Inspect current state of all stores',
    category: 'state',
    execute: (args) => {
      const [storeName] = args as [string?]
      
      if (storeName) {
        // Get specific store state (would need store registry)
        console.log(`State for ${storeName}:`, 'Not implemented - need store registry')
        return null
      }
      
      // Show all store states
      const stateDebugger = useStateDebugger.getState()
      const snapshots = Array.from(stateDebugger.snapshots.values())
      const latestByStore = new Map()
      
      snapshots.forEach(snapshot => {
        if (!latestByStore.has(snapshot.storeName) || 
            snapshot.timestamp > latestByStore.get(snapshot.storeName).timestamp) {
          latestByStore.set(snapshot.storeName, snapshot)
        }
      })
      
      console.log('Current state snapshots:')
      latestByStore.forEach((snapshot, storeName) => {
        console.log(`${storeName}:`, snapshot.state)
      })
      
      return Object.fromEntries(latestByStore)
    },
    examples: ['state', 'state("authStore")'],
  },

  {
    name: 'performance',
    description: 'Show current performance metrics',
    category: 'performance',
    execute: () => {
      const perfMonitor = usePerformanceMonitor.getState()
      const metrics = perfMonitor.metrics
      
      console.log('Performance Metrics:', {
        'Store Update Frequency': `${metrics.storeUpdateFrequency.toFixed(2)} updates/sec`,
        'Selector Computation Time': `${metrics.selectorComputationTime.toFixed(2)}ms`,
        'Re-render Count': metrics.reRenderCount,
        'Memory Usage': `${formatBytes(metrics.memoryUsage)}`,
        'State Size': `${formatBytes(metrics.stateSize)}`,
        'Query Cache Size': metrics.queryCacheSize,
      })
      
      return metrics
    },
    examples: ['performance'],
  },

  {
    name: 'profile',
    description: 'Start performance profiling for specified duration',
    category: 'performance',
    execute: (args) => {
      const [duration] = args as [number?]
      const devTools = useDeveloperTools.getState()
      devTools.startProfiling(duration || 10000)
      return `Profiling started for ${duration || 10000}ms`
    },
    examples: ['profile', 'profile(5000)'],
  },

  {
    name: 'report',
    description: 'Generate comprehensive performance report',
    category: 'performance',
    execute: async () => {
      const devTools = useDeveloperTools.getState()
      const report = await devTools.generateAutomatedReport()
      
      console.log('Performance Report Generated:')
      console.log(`Overall Score: ${report.summary.overallScore}/100`)
      console.log('Bottlenecks:', report.summary.bottlenecks)
      console.log('Recommendations:', report.recommendations.map(r => r.description))
      
      return report
    },
    examples: ['report'],
  },

  {
    name: 'clear',
    description: 'Clear debugging data',
    category: 'debugging',
    execute: (args) => {
      const [type] = args as [string?]
      
      switch (type) {
        case 'state': {
          useStateDebugger.getState().clearHistory()
          console.log('State history cleared')
          break
        }
        case 'warnings': {
          useDeveloperTools.getState().clearWarnings()
          console.log('Warnings cleared')
          break
        }
        case 'metrics': {
          useMetricsCollector.getState().clearOldMetrics()
          console.log('Metrics cleared')
          break
        }
        default: {
          // Clear all
          useStateDebugger.getState().clearHistory()
          useDeveloperTools.getState().clearWarnings()
          useMetricsCollector.getState().clearOldMetrics()
          console.log('All debugging data cleared')
        }
      }
      
      return `Cleared: ${type || 'all'}`
    },
    examples: ['clear', 'clear("state")', 'clear("warnings")', 'clear("metrics")'],
  },

  {
    name: 'export',
    description: 'Export debugging data',
    category: 'debugging',
    execute: (args) => {
      const [type] = args as [string?]
      
      let data: string
      switch (type) {
        case 'state': {
          data = useStateDebugger.getState().exportHistory()
          break
        }
        case 'metrics': {
          data = useMetricsCollector.getState().exportMetrics()
          break
        }
        case 'devtools': {
          data = useDevToolsExtension.getState().exportData()
          break
        }
        default: {
          // Export all as combined
          data = JSON.stringify({
            state: JSON.parse(useStateDebugger.getState().exportHistory()),
            metrics: JSON.parse(useMetricsCollector.getState().exportMetrics()),
            devtools: JSON.parse(useDevToolsExtension.getState().exportData()),
          }, null, 2)
        }
      }
      
      // Create download link
      const blob = new Blob([data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `dce-debug-${type || 'all'}-${Date.now()}.json`
      a.click()
      URL.revokeObjectURL(url)
      
      console.log(`Exported ${type || 'all'} data`)
      return data
    },
    examples: ['export', 'export("state")', 'export("metrics")'],
  },

  {
    name: 'memory',
    description: 'Analyze memory usage and potential leaks',
    category: 'performance',
    execute: () => {
      const stateDebugger = useStateDebugger.getState()
      const leaks = stateDebugger.findStateLeaks()
      const growth = stateDebugger.analyzeStateGrowth()
      
      console.log('Memory Analysis:')
      console.log('Potential leaks:', leaks)
      console.log('State growth analysis:', growth)
      
      interface PerformanceWithMemory extends Performance {
        memory?: {
          usedJSHeapSize: number
          totalJSHeapSize: number
          jsHeapSizeLimit: number
        }
      }
      
      const perfWithMemory = performance as PerformanceWithMemory
      if (perfWithMemory.memory) {
        const memInfo = perfWithMemory.memory
        console.log('JS Heap:', {
          used: formatBytes(memInfo.usedJSHeapSize),
          total: formatBytes(memInfo.totalJSHeapSize),
          limit: formatBytes(memInfo.jsHeapSizeLimit),
        })
      }
      
      return { leaks, growth }
    },
    examples: ['memory'],
  },
]

// ==================== Utility Functions ====================

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface MetricsSummary {
  apiPerformance?: {
    errorRate: number
  }
  userInteractions?: {
    bounceRate: number
  }
}

function enhanceRecommendations(
  recommendations: PerformanceRecommendation[],
  metrics: MetricsSummary
): PerformanceRecommendation[] {
  const enhanced = [...recommendations]
  
  // Add developer-specific recommendations based on metrics
  if (metrics.apiPerformance?.errorRate && metrics.apiPerformance.errorRate > 0.05) { // 5% error rate
    enhanced.push({
      type: 'warning',
      category: 'api',
      description: 'High API error rate detected',
      solution: 'Review API error handling and implement retry logic',
      impact: 'high',
      effort: 'medium',
    })
  }
  
  if (metrics.userInteractions?.bounceRate && metrics.userInteractions.bounceRate > 0.7) { // 70% bounce rate
    enhanced.push({
      type: 'suggestion',
      category: 'ux',
      description: 'High bounce rate indicates potential UX issues',
      solution: 'Analyze user interaction patterns and improve onboarding',
      impact: 'medium',
      effort: 'high',
    })
  }
  
  return enhanced
}

function setupProfilingMonitors(metrics: unknown) {
  // This would set up monitoring during profiling
  // Metrics would be used to configure monitoring
  console.debug('Setting up profiling monitors with metrics:', metrics)
  // For now, return empty cleanup function
  return []
}

function cleanupProfilingMonitors() {
  // Cleanup profiling monitors
}

// ==================== Warning System ====================

function checkForWarnings() {
  const devTools = useDeveloperTools.getState()
  const thresholds = devTools.warningThresholds
  const perfMonitor = usePerformanceMonitor.getState()
  const metrics = perfMonitor.metrics

  // Check performance thresholds
  if (metrics.selectorComputationTime > thresholds.selectorComputationTime) {
    devTools.addWarning({
      id: `warn-${Date.now()}`,
      timestamp: Date.now(),
      type: 'performance',
      severity: 'medium',
      message: 'Slow selector computation detected',
      details: `Selector took ${metrics.selectorComputationTime.toFixed(2)}ms (threshold: ${thresholds.selectorComputationTime}ms)`,
      solution: 'Consider memoizing expensive computations or reducing selector complexity',
      dismissed: false,
    })
  }

  if (metrics.reRenderCount > thresholds.reRenderCount) {
    devTools.addWarning({
      id: `warn-${Date.now()}`,
      timestamp: Date.now(),
      type: 'performance',
      severity: 'high',
      message: 'Excessive re-renders detected',
      details: `${metrics.reRenderCount} re-renders (threshold: ${thresholds.reRenderCount})`,
      solution: 'Review component memoization and state update patterns',
      dismissed: false,
    })
  }
}

// ==================== Initialization ====================

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  const devTools = useDeveloperTools.getState()
  
  // Register built-in commands
  builtInCommands.forEach(command => {
    devTools.registerCommand(command)
  })
  
  // Set up automated warning checks
  setInterval(checkForWarnings, 5000) // Check every 5 seconds
  
  // Expose dev tools to global
  interface WindowWithDevTools extends Window {
    __devTools?: typeof devTools
    __dce?: {
      state: (storeName?: string) => Promise<unknown>
      perf: () => Promise<unknown>
      profile: (duration?: number) => Promise<unknown>
      report: () => Promise<unknown>
      clear: (type?: string) => Promise<unknown>
      export: (type?: string) => Promise<unknown>
      memory: () => Promise<unknown>
      help: () => Promise<unknown>
    }
  }
  
  const windowWithDevTools = window as WindowWithDevTools
  windowWithDevTools.__devTools = devTools
  windowWithDevTools.__dce = {
    // Convenient aliases for common commands
    state: (storeName?: string) => devTools.executeCommand('state', storeName ? [storeName] : []),
    perf: () => devTools.executeCommand('performance'),
    profile: (duration?: number) => devTools.executeCommand('profile', duration ? [duration] : []),
    report: () => devTools.executeCommand('report'),
    clear: (type?: string) => devTools.executeCommand('clear', type ? [type] : []),
    export: (type?: string) => devTools.executeCommand('export', type ? [type] : []),
    memory: () => devTools.executeCommand('memory'),
    help: () => devTools.executeCommand('help'),
  }
  
  console.log(`
🔧 DCE Developer Tools loaded!

Available commands:
  __dce.help()       - Show all commands
  __dce.state()      - Inspect store states
  __dce.perf()       - Show performance metrics
  __dce.profile()    - Start performance profiling
  __dce.report()     - Generate performance report
  __dce.memory()     - Analyze memory usage
  __dce.clear()      - Clear debugging data
  __dce.export()     - Export debugging data

Type __dce.help() for more details.
  `)
}

export type { DeveloperToolsState, DeveloperCommand, ProfileData, DeveloperWarning }