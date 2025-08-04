/**
 * Enhanced DevTools Extension
 * Phase 2.4 - Advanced Zustand DevTools integration with state machines and performance monitoring
 */

import { create } from 'zustand'
import { devtools, subscribeWithSelector } from 'zustand/middleware'
import type { StateCreator } from 'zustand'
import type {
  DevToolsMessage,
  DevToolsState,
  DevToolsCapability,
  DevToolsFilter,
  StateSnapshot,
  StateMachineTransition,
  PerformanceMetrics,
} from '../monitoring/types'

// ==================== Enhanced DevTools Configuration ====================

interface EnhancedDevToolsConfig {
  name: string
  enabled: boolean
  features: {
    stateInspection: boolean
    timeTraveling: boolean
    performanceMonitoring: boolean
    stateMachineDebugging: boolean
    selectorProfiling: boolean
    actionReplay: boolean
    exportImport: boolean
  }
  filters: {
    actions: string[]
    stores: string[]
    performance: boolean
  }
  ui: {
    theme: 'light' | 'dark' | 'auto'
    layout: 'horizontal' | 'vertical'
    panels: string[]
  }
}

interface DevToolsExtensionState extends DevToolsState {
  config: EnhancedDevToolsConfig
  messages: DevToolsMessage[]
  performanceData: PerformanceMetrics | null
  stateSnapshots: StateSnapshot[]
  stateMachineData: Map<string, StateMachineTransition[]>
  
  // Connection management
  connect: () => void
  disconnect: () => void
  sendMessage: (message: Omit<DevToolsMessage, 'timestamp'>) => void
  
  // Configuration
  updateConfig: (config: Partial<EnhancedDevToolsConfig>) => void
  addFilter: (filter: DevToolsFilter) => void
  removeFilter: (filterId: string) => void
  
  // Data management
  recordStateSnapshot: (snapshot: StateSnapshot) => void
  recordStateMachineTransition: (transition: StateMachineTransition) => void
  updatePerformanceData: (metrics: PerformanceMetrics) => void
  
  // Export/Import
  exportData: () => string
  importData: (data: string) => void
  clearData: () => void
}

const defaultConfig: EnhancedDevToolsConfig = {
  name: 'DCE State Monitor',
  enabled: process.env.NODE_ENV === 'development',
  features: {
    stateInspection: true,
    timeTraveling: true,
    performanceMonitoring: true,
    stateMachineDebugging: true,
    selectorProfiling: true,
    actionReplay: true,
    exportImport: true,
  },
  filters: {
    actions: [],
    stores: [],
    performance: true,
  },
  ui: {
    theme: 'auto',
    layout: 'horizontal',
    panels: ['state', 'actions', 'performance', 'state-machines'],
  },
}

export const useDevToolsExtension = create<DevToolsExtensionState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    isConnected: false,
    capabilities: [],
    activeStore: undefined,
    selectedSnapshot: undefined,
    filters: [],
    config: defaultConfig,
    messages: [],
    performanceData: null,
    stateSnapshots: [],
    stateMachineData: new Map(),

    connect: () => {
      if (typeof window === 'undefined' || !get().config.enabled) return

      interface WindowWithDevTools extends Window {
        __REDUX_DEVTOOLS_EXTENSION__?: unknown
      }
      const windowWithDevTools = window as WindowWithDevTools
      const devTools = windowWithDevTools.__REDUX_DEVTOOLS_EXTENSION__
      if (!devTools) {
        console.warn('Redux DevTools Extension not found')
        return
      }

      interface DevToolsConnection {
        connect: (config: unknown) => {
          subscribe: (callback: (message: unknown) => void) => void
          send: (action: unknown, state: unknown) => void
          disconnect: () => void
        }
      }

      const devToolsConnection = devTools as DevToolsConnection
      const connection = devToolsConnection.connect({
        name: get().config.name,
        features: {
          pause: true,
          lock: true,
          persist: true,
          export: true,
          import: 'custom',
          jump: true,
          skip: true,
          reorder: true,
          dispatch: true,
          test: true,
        },
      })

      connection.subscribe((message: unknown) => {
        handleDevToolsMessage(message, get, set)
      })

      interface WindowWithConnection extends Window {
        __dceDevToolsConnection?: typeof connection
      }

      // Store connection for later use
      const windowWithConnection = window as WindowWithConnection
      windowWithConnection.__dceDevToolsConnection = connection

      const capabilities: DevToolsCapability[] = [
        {
          name: 'Enhanced State Inspection',
          version: '2.4.0',
          enabled: get().config.features.stateInspection,
          features: ['deep-inspection', 'type-awareness', 'computed-values'],
        },
        {
          name: 'Time Travel Debugging',
          version: '2.4.0',
          enabled: get().config.features.timeTraveling,
          features: ['snapshot-navigation', 'action-replay', 'state-restoration'],
        },
        {
          name: 'Performance Monitoring',
          version: '2.4.0',
          enabled: get().config.features.performanceMonitoring,
          features: ['real-time-metrics', 'performance-alerts', 'bottleneck-detection'],
        },
        {
          name: 'State Machine Debugging',
          version: '2.4.0',
          enabled: get().config.features.stateMachineDebugging,
          features: ['transition-tracking', 'guard-visualization', 'context-inspection'],
        },
      ]

      set({
        isConnected: true,
        capabilities,
      })

      // Send initial message
      get().sendMessage({
        type: 'STATE_CHANGE',
        payload: {
          type: 'CONNECTION_ESTABLISHED',
          capabilities,
          config: get().config,
        },
      })
    },

    disconnect: () => {
      interface WindowWithConnection extends Window {
        __dceDevToolsConnection?: {
          disconnect: () => void
        }
      }
      const windowWithConnection = window as WindowWithConnection
      const connection = windowWithConnection.__dceDevToolsConnection
      if (connection) {
        connection.disconnect()
        delete windowWithConnection.__dceDevToolsConnection
      }

      set({
        isConnected: false,
        capabilities: [],
      })
    },

    sendMessage: (message: Omit<DevToolsMessage, 'timestamp'>) => {
      interface WindowWithConnection extends Window {
        __dceDevToolsConnection?: {
          send: (action: unknown, state: unknown) => void
        }
      }
      const windowWithConnection = window as WindowWithConnection
      const connection = windowWithConnection.__dceDevToolsConnection
      if (!connection || !get().isConnected) return

      const fullMessage: DevToolsMessage = {
        ...message,
        timestamp: Date.now(),
      }

      // Apply filters
      if (shouldFilterMessage(fullMessage, get().filters)) return

      // Send to DevTools
      connection.send(fullMessage.payload, fullMessage)

      // Store message locally
      set((state) => ({
        messages: [...state.messages, fullMessage].slice(-1000), // Keep last 1000 messages
      }))
    },

    updateConfig: (configUpdate: Partial<EnhancedDevToolsConfig>) => {
      set((state) => ({
        config: { ...state.config, ...configUpdate },
      }))

      // Reconnect if needed
      if (configUpdate.enabled !== undefined) {
        if (configUpdate.enabled) {
          get().connect()
        } else {
          get().disconnect()
        }
      }
    },

    addFilter: (filter: DevToolsFilter) => {
      set((state) => ({
        filters: [...state.filters, filter],
      }))
    },

    removeFilter: (filterId: string) => {
      set((state) => ({
        filters: state.filters.filter((f) => {
          const filterWithId = f as DevToolsFilter & { id?: string }
          return filterWithId.id !== filterId
        }),
      }))
    },

    recordStateSnapshot: (snapshot: StateSnapshot) => {
      if (!get().config.features.stateInspection) return

      set((state) => ({
        stateSnapshots: [...state.stateSnapshots, snapshot].slice(-500), // Keep last 500 snapshots
      }))

      get().sendMessage({
        type: 'STATE_CHANGE',
        payload: {
          type: 'SNAPSHOT_RECORDED',
          snapshot: {
            id: snapshot.id,
            storeName: snapshot.storeName,
            timestamp: snapshot.timestamp,
            action: snapshot.action,
            metadata: snapshot.metadata,
            // Don't send full state to avoid performance issues
            stateSize: snapshot.metadata.size,
          },
        },
      })
    },

    recordStateMachineTransition: (transition: StateMachineTransition) => {
      if (!get().config.features.stateMachineDebugging) return

      set((state) => {
        const existing = state.stateMachineData.get(transition.id) || []
        const updated = [...existing, transition].slice(-100) // Keep last 100 transitions per machine
        
        return {
          stateMachineData: new Map(state.stateMachineData).set(transition.id, updated),
        }
      })

      get().sendMessage({
        type: 'STATE_CHANGE',
        payload: {
          type: 'STATE_MACHINE_TRANSITION',
          transition: {
            ...transition,
            // Sanitize context for DevTools
            context: typeof transition.context === 'object' 
              ? JSON.parse(JSON.stringify(transition.context)) 
              : transition.context,
          },
        },
      })
    },

    updatePerformanceData: (metrics: PerformanceMetrics) => {
      if (!get().config.features.performanceMonitoring) return

      set({ performanceData: metrics })

      // Send performance alerts if thresholds are exceeded
      const alerts = analyzePerformanceMetrics(metrics)
      if (alerts.length > 0) {
        get().sendMessage({
          type: 'WARNING',
          payload: {
            type: 'PERFORMANCE_ALERT',
            alerts,
            metrics,
          },
        })
      }

      // Send regular performance update (throttled)
      throttledPerformanceUpdate(() => {
        get().sendMessage({
          type: 'PERFORMANCE_UPDATE',
          payload: {
            type: 'METRICS_UPDATE',
            metrics,
          },
        })
      })
    },

    exportData: (): string => {
      const state = get()
      const exportData = {
        version: '2.4.0',
        timestamp: Date.now(),
        config: state.config,
        snapshots: state.stateSnapshots.slice(-100), // Last 100 snapshots
        stateMachines: Array.from(state.stateMachineData.entries()),
        performanceData: state.performanceData,
        messages: state.messages.slice(-500), // Last 500 messages
      }

      return JSON.stringify(exportData, null, 2)
    },

    importData: (data: string) => {
      try {
        const importData = JSON.parse(data)
        
        if (!importData.version || !importData.timestamp) {
          throw new Error('Invalid data format')
        }

        set({
          stateSnapshots: importData.snapshots || [],
          stateMachineData: new Map(importData.stateMachines || []),
          performanceData: importData.performanceData || null,
          messages: importData.messages || [],
        })

        get().sendMessage({
          type: 'STATE_CHANGE',
          payload: {
            type: 'DATA_IMPORTED',
            timestamp: importData.timestamp,
            snapshotCount: importData.snapshots?.length || 0,
          },
        })
      } catch (error) {
        get().sendMessage({
          type: 'ERROR',
          payload: {
            type: 'IMPORT_ERROR',
            error: error instanceof Error ? error.message : 'Unknown error',
          },
        })
      }
    },

    clearData: () => {
      set({
        stateSnapshots: [],
        stateMachineData: new Map(),
        performanceData: null,
        messages: [],
      })

      get().sendMessage({
        type: 'STATE_CHANGE',
        payload: {
          type: 'DATA_CLEARED',
        },
      })
    },
  }))
)

// ==================== DevTools Message Handler ====================

function handleDevToolsMessage(
  message: unknown,
  get: () => DevToolsExtensionState,
  set: (fn: (state: DevToolsExtensionState) => Partial<DevToolsExtensionState>) => void
) {
  const msg = message as { type?: string; payload?: unknown }
  switch (msg.type) {
    case 'DISPATCH':
      handleDispatchMessage(msg, get, set)
      break
    case 'IMPORT':
      if (typeof msg.payload === 'string') {
        get().importData(msg.payload)
      }
      break
    case 'EXPORT':
      return get().exportData()
    case 'TOGGLE_ACTION':
      // Handle action toggling for time travel
      break
    case 'JUMP_TO_ACTION':
      // Handle jumping to specific action
      break
    default:
      console.log('Unhandled DevTools message:', msg)
  }
}

function handleDispatchMessage(
  message: unknown,
  get: () => DevToolsExtensionState,
  set: (fn: (state: DevToolsExtensionState) => Partial<DevToolsExtensionState>) => void
) {
  const msg = message as { payload?: { type?: string; actionId?: string } }
  const { payload } = msg
  
  switch (payload?.type) {
    case 'RESET':
      get().clearData()
      break
    case 'COMMIT':
      // Commit current state as new baseline
      break
    case 'ROLLBACK':
      // Rollback to last committed state
      break
    case 'JUMP_TO_STATE':
      // Jump to specific state snapshot
      if (payload?.actionId) {
        set({ selectedSnapshot: payload.actionId })
      }
      break
  }
}

// ==================== Utility Functions ====================

function shouldFilterMessage(message: DevToolsMessage, filters: DevToolsFilter[]): boolean {
  return filters.some(filter => {
    if (!filter.active) return false
    
    switch (filter.type) {
      case 'action': {
        const payload = message.payload as { action?: { type?: string } }
        return message.type === 'STATE_CHANGE' && 
               typeof filter.criteria === 'string' &&
               payload?.action?.type?.includes(filter.criteria)
      }
      case 'store': {
        const payload = message.payload as { storeName?: string }
        return typeof filter.criteria === 'string' &&
               payload?.storeName?.includes(filter.criteria)
      }
      case 'performance': {
        return message.type === 'PERFORMANCE_UPDATE' && !filter.criteria
      }
      case 'timeRange': {
        const timeRange = filter.criteria as { start: number; end: number }
        return message.timestamp < timeRange.start || message.timestamp > timeRange.end
      }
      default: {
        return false
      }
    }
  })
}

function analyzePerformanceMetrics(metrics: PerformanceMetrics): string[] {
  const alerts: string[] = []
  
  if (metrics.selectorComputationTime > 5) {
    alerts.push(`Slow selector computation: ${metrics.selectorComputationTime.toFixed(2)}ms`)
  }
  
  if (metrics.reRenderCount > 10) {
    alerts.push(`Excessive re-renders: ${metrics.reRenderCount}`)
  }
  
  const memoryThreshold = 50 * 1024 * 1024 // 50MB
  if (metrics.memoryUsage > memoryThreshold) {
    alerts.push(`High memory usage: ${formatBytes(metrics.memoryUsage)}`)
  }
  
  const cacheHitThreshold = 0.8
  if (metrics.entityAdapterPerformance.cacheHitRate < cacheHitThreshold) {
    const hitRatePercent = (metrics.entityAdapterPerformance.cacheHitRate * 100).toFixed(1)
    alerts.push(`Low cache hit rate: ${hitRatePercent}%`)
  }
  
  return alerts
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const formattedSize = parseFloat((bytes / Math.pow(k, i)).toFixed(2))
  return `${formattedSize} ${sizes[i]}`
}

// Throttled performance update to avoid overwhelming DevTools
const throttledPerformanceUpdate = (() => {
  let lastUpdate = 0
  const throttleMs = 100
  
  return (fn: () => void) => {
    const now = Date.now()
    if (now - lastUpdate > throttleMs) {
      lastUpdate = now
      fn()
    }
  }
})()

// ==================== Enhanced DevTools Middleware Factory ====================

export function createEnhancedDevToolsMiddleware<T>(
  config: Partial<EnhancedDevToolsConfig> = {}
) {
  const finalConfig = { ...defaultConfig, ...config }
  
  return (f: StateCreator<T, [], [], T>, name?: string): StateCreator<T, [], [], T> => {
    if (!finalConfig.enabled || process.env.NODE_ENV !== 'development') {
      return f
    }

    return devtools(
      subscribeWithSelector((set, get, api) => {
        const devToolsExt = useDevToolsExtension.getState()
        
        // Connect to DevTools if not already connected
        if (!devToolsExt.isConnected) {
          devToolsExt.connect()
        }

        const store = f(
          (partial, replace) => {
            // Record performance metrics
            const startTime = performance.now()
            set(partial, replace)
            const endTime = performance.now()
            
            const newState = get()
            
            // Create state snapshot
            const snapshot: StateSnapshot = {
              id: `${name || 'unknown'}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              timestamp: Date.now(),
              storeName: name || 'unknown',
              state: newState,
              metadata: {
                version: 1,
                size: JSON.stringify(newState).length,
                performance: {
                  executionTime: endTime - startTime,
                  memoryDelta: 0, // Would need more sophisticated tracking
                  selectorCalls: 0, // Would need selector tracking
                },
              },
            }
            
            // Record the snapshot
            devToolsExt.recordStateSnapshot(snapshot)
          },
          get,
          api
        )

        return store
      }),
      {
        name: name || finalConfig.name,
        enabled: finalConfig.enabled,
      }
    )
  }
}

// ==================== Auto-initialization ====================

if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  // Auto-connect in development
  setTimeout(() => {
    const devTools = useDevToolsExtension.getState()
    if (!devTools.isConnected) {
      devTools.connect()
    }
  }, 1000)
  
  // Expose DevTools extension to global for debugging
  interface WindowWithDevTools extends Window {
    __dceDevTools?: typeof useDevToolsExtension
  }
  const windowWithDevTools = window as WindowWithDevTools
  windowWithDevTools.__dceDevTools = useDevToolsExtension
}

export type { EnhancedDevToolsConfig, DevToolsExtensionState }