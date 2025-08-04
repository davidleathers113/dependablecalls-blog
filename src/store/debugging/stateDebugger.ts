/**
 * State Debugging Tools
 * Phase 2.4 - Comprehensive state debugging and time travel
 */

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type {
  StateSnapshot,
  StateAction,
  StateDiff,
  StateChangeHistory,
  HistoryFilter,
  StateMachineTransition,
  StateMachineDebugInfo,
  SelectorDependency,
  SelectorGraph,
} from '../monitoring/types'

// ==================== State Debugger Store ====================

interface StateDebuggerState {
  // State history and snapshots
  history: StateChangeHistory
  snapshots: Map<string, StateSnapshot>
  currentSnapshot: string | null
  
  // State machine debugging
  stateMachineTransitions: Map<string, StateMachineTransition[]>
  currentStateMachine: string | null
  
  // Selector debugging
  selectorDependencies: Map<string, SelectorDependency>
  selectorGraph: SelectorGraph | null
  
  // Debugging session
  isDebugging: boolean
  isRecording: boolean
  debugLevel: 'basic' | 'verbose' | 'debug'
  
  // Time travel
  canTimeTravel: boolean
  timeTravelMode: boolean
  
  // Actions
  startDebugging: () => void
  stopDebugging: () => void
  recordStateChange: (storeName: string, newState: unknown, action?: StateAction) => void
  createSnapshot: (storeName: string, state: unknown, action?: StateAction) => string
  restoreSnapshot: (snapshotId: string) => Promise<void>
  
  // Time travel
  enableTimeTravel: () => void
  disableTimeTravel: () => void
  travelToSnapshot: (snapshotId: string) => void
  travelToIndex: (index: number) => void
  stepForward: () => void
  stepBackward: () => void
  
  // Filtering and analysis
  addHistoryFilter: (filter: HistoryFilter) => void
  removeHistoryFilter: (filterIndex: number) => void
  clearHistory: () => void
  exportHistory: () => string
  importHistory: (data: string) => void
  
  // State machine debugging
  recordStateMachineTransition: (transition: StateMachineTransition) => void
  getStateMachineDebugInfo: (storeName: string) => StateMachineDebugInfo | null
  
  // Selector debugging
  recordSelectorCall: (selectorName: string, dependencies: string[], computationTime: number) => void
  buildSelectorGraph: () => void
  findSelectorCycles: () => string[][]
  
  // Diff analysis
  generateStateDiff: (fromSnapshot: string, toSnapshot: string) => StateDiff | null
  findStateLeaks: () => string[]
  analyzeStateGrowth: () => { growing: string[]; stable: string[]; shrinking: string[] }
}

export const useStateDebugger = create<StateDebuggerState>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    history: {
      snapshots: [],
      maxHistory: 1000,
      currentIndex: -1,
      filters: [],
    },
    snapshots: new Map(),
    currentSnapshot: null,
    stateMachineTransitions: new Map(),
    currentStateMachine: null,
    selectorDependencies: new Map(),
    selectorGraph: null,
    isDebugging: false,
    isRecording: false,
    debugLevel: 'basic',
    canTimeTravel: false,
    timeTravelMode: false,

    startDebugging: () => {
      if (process.env.NODE_ENV !== 'development') return
      
      set({
        isDebugging: true,
        isRecording: true,
      })

      // Expose debugger to global for console access
      if (typeof window !== 'undefined') {
        interface WindowWithDebugger extends Window {
          __stateDebugger?: StateDebuggerState
        }
        const windowWithDebugger = window as WindowWithDebugger
        windowWithDebugger.__stateDebugger = get()
      }
    },

    stopDebugging: () => {
      set({
        isDebugging: false,
        isRecording: false,
        timeTravelMode: false,
      })

      if (typeof window !== 'undefined') {
        interface WindowWithDebugger extends Window {
          __stateDebugger?: StateDebuggerState
        }
        const windowWithDebugger = window as WindowWithDebugger
        delete windowWithDebugger.__stateDebugger
      }
    },

    recordStateChange: (storeName: string, newState: unknown, action?: StateAction) => {
      const state = get()
      if (!state.isRecording) return

      const snapshotId = state.createSnapshot(storeName, newState, action)
      
      set((state) => {
        const newHistory = {
          ...state.history,
          snapshots: [...state.history.snapshots, snapshotId].slice(-state.history.maxHistory),
          currentIndex: state.history.snapshots.length,
        }

        return {
          history: newHistory,
          currentSnapshot: snapshotId,
        }
      })
    },

    createSnapshot: (storeName: string, state: unknown, action?: StateAction): string => {
      const snapshotId = `${storeName}-${Date.now()}-${Math.random().toString(36).slice(2)}`
      const timestamp = Date.now()
      
      // Calculate state size
      const stateSize = calculateObjectSize(state)
      
      // Generate diff if we have a previous snapshot
      let diff: StateDiff | undefined
      const currentState = get()
      const previousSnapshots = [...currentState.snapshots.values()]
        .filter(s => s.storeName === storeName)
        .sort((a, b) => b.timestamp - a.timestamp)
      
      if (previousSnapshots.length > 0) {
        diff = generateDiff(previousSnapshots[0].state, state)
      }

      const snapshot: StateSnapshot = {
        id: snapshotId,
        timestamp,
        storeName,
        state: cloneDeep(state),
        action,
        metadata: {
          version: currentState.snapshots.size + 1,
          size: stateSize,
          diff,
          performance: {
            executionTime: action ? Date.now() - action.timestamp : 0,
            memoryDelta: diff ? calculateDiffSize(diff) : 0,
            selectorCalls: 0, // Will be updated by selector debugging
          },
        },
      }

      set((state) => ({
        snapshots: new Map(state.snapshots).set(snapshotId, snapshot),
      }))

      return snapshotId
    },

    restoreSnapshot: async (snapshotId: string) => {
      const snapshot = get().snapshots.get(snapshotId)
      if (!snapshot) return

      // This would need to be implemented by the specific store
      // For now, we just log the intention
      if (process.env.NODE_ENV === 'development') {
        console.log('Restoring snapshot:', snapshot)
      }
    },

    enableTimeTravel: () => {
      set({ canTimeTravel: true })
    },

    disableTimeTravel: () => {
      set({ 
        canTimeTravel: false,
        timeTravelMode: false,
      })
    },

    travelToSnapshot: (snapshotId: string) => {
      const state = get()
      if (!state.canTimeTravel) return

      const snapshotIndex = state.history.snapshots.indexOf(snapshotId)
      if (snapshotIndex === -1) return

      set({
        timeTravelMode: true,
        history: {
          ...state.history,
          currentIndex: snapshotIndex,
        },
        currentSnapshot: snapshotId,
      })
    },

    travelToIndex: (index: number) => {
      const state = get()
      if (!state.canTimeTravel || index < 0 || index >= state.history.snapshots.length) return

      const snapshotId = state.history.snapshots[index]
      set({
        timeTravelMode: true,
        history: {
          ...state.history,
          currentIndex: index,
        },
        currentSnapshot: snapshotId,
      })
    },

    stepForward: () => {
      const state = get()
      if (!state.canTimeTravel || state.history.currentIndex >= state.history.snapshots.length - 1) return

      const newIndex = state.history.currentIndex + 1
      get().travelToIndex(newIndex)
    },

    stepBackward: () => {
      const state = get()
      if (!state.canTimeTravel || state.history.currentIndex <= 0) return

      const newIndex = state.history.currentIndex - 1
      get().travelToIndex(newIndex)
    },

    addHistoryFilter: (filter: HistoryFilter) => {
      set((state) => ({
        history: {
          ...state.history,
          filters: [...state.history.filters, filter],
        },
      }))
    },

    removeHistoryFilter: (filterIndex: number) => {
      set((state) => ({
        history: {
          ...state.history,
          filters: state.history.filters.filter((_, i) => i !== filterIndex),
        },
      }))
    },

    clearHistory: () => {
      set({
        history: {
          snapshots: [],
          maxHistory: 1000,
          currentIndex: -1,
          filters: [],
        },
        snapshots: new Map(),
        currentSnapshot: null,
      })
    },

    exportHistory: (): string => {
      const state = get()
      const exportData = {
        snapshots: Array.from(state.snapshots.entries()),
        history: state.history,
        timestamp: Date.now(),
        version: '1.0',
      }
      return JSON.stringify(exportData, null, 2)
    },

    importHistory: (data: string) => {
      try {
        const importData = JSON.parse(data)
        if (!importData.snapshots || !importData.history) {
          throw new Error('Invalid history data format')
        }

        set({
          snapshots: new Map(importData.snapshots),
          history: importData.history,
        })
      } catch (error) {
        console.error('Failed to import history:', error)
      }
    },

    recordStateMachineTransition: (transition: StateMachineTransition) => {
      const state = get()
      if (!state.isRecording) return

      set((state) => {
        const transitions = state.stateMachineTransitions.get(transition.id) || []
        const updatedTransitions = [...transitions, transition].slice(-100) // Keep last 100 transitions

        return {
          stateMachineTransitions: new Map(state.stateMachineTransitions)
            .set(transition.id, updatedTransitions),
        }
      })
    },

    getStateMachineDebugInfo: (storeName: string): StateMachineDebugInfo | null => {
      const state = get()
      const transitions = state.stateMachineTransitions.get(storeName) || []
      
      if (transitions.length === 0) return null

      const latest = transitions[transitions.length - 1]
      return {
        currentState: latest.to,
        availableTransitions: [], // Would need to be provided by the state machine
        history: transitions,
        context: latest.context,
        guards: {}, // Would need to be provided by the state machine
      }
    },

    recordSelectorCall: (selectorName: string, dependencies: string[], computationTime: number) => {
      const state = get()
      if (!state.isRecording) return

      set((state) => {
        const existing = state.selectorDependencies.get(selectorName) || {
          selectorName,
          dependencies: [],
          subscribers: [],
          computationTime: 0,
          callCount: 0,
          cacheHits: 0,
          cacheMisses: 0,
        }

        const updated: SelectorDependency = {
          ...existing,
          dependencies,
          computationTime: (existing.computationTime * existing.callCount + computationTime) / (existing.callCount + 1),
          callCount: existing.callCount + 1,
          cacheMisses: existing.cacheMisses + 1, // Assuming miss for now
        }

        return {
          selectorDependencies: new Map(state.selectorDependencies).set(selectorName, updated),
        }
      })
    },

    buildSelectorGraph: () => {
      const state = get()
      const dependencies = Array.from(state.selectorDependencies.values())
      
      const nodes = dependencies.map(dep => ({
        id: dep.selectorName,
        name: dep.selectorName,
        type: 'selector' as const,
        computationTime: dep.computationTime,
        callFrequency: dep.callCount,
        cacheEfficiency: dep.cacheHits / (dep.cacheHits + dep.cacheMisses),
      }))

      const edges = dependencies.flatMap(dep =>
        dep.dependencies.map(depName => ({
          from: depName,
          to: dep.selectorName,
          weight: 1,
          type: 'dependency' as const,
        }))
      )

      const cycles = findCycles(nodes, edges)

      set({
        selectorGraph: { nodes, edges, cycles },
      })
    },

    findSelectorCycles: (): string[][] => {
      const state = get()
      if (!state.selectorGraph) {
        get().buildSelectorGraph()
      }
      return state.selectorGraph?.cycles || []
    },

    generateStateDiff: (fromSnapshotId: string, toSnapshotId: string): StateDiff | null => {
      const state = get()
      const fromSnapshot = state.snapshots.get(fromSnapshotId)
      const toSnapshot = state.snapshots.get(toSnapshotId)
      
      if (!fromSnapshot || !toSnapshot) return null
      
      return generateDiff(fromSnapshot.state, toSnapshot.state)
    },

    findStateLeaks: (): string[] => {
      // Analyze snapshots for potential memory leaks
      const state = get()
      const leaks: string[] = []
      
      // Group snapshots by store
      const storeSnapshots = new Map<string, StateSnapshot[]>()
      for (const snapshot of state.snapshots.values()) {
        const existing = storeSnapshots.get(snapshot.storeName) || []
        storeSnapshots.set(snapshot.storeName, [...existing, snapshot])
      }

      // Check for continuously growing state
      for (const [storeName, snapshots] of storeSnapshots) {
        if (snapshots.length < 5) continue

        const recentSnapshots = snapshots.slice(-5)
        const isGrowing = recentSnapshots.every((snapshot: StateSnapshot, i: number) => 
          i === 0 || snapshot.metadata.size > recentSnapshots[i - 1].metadata.size
        )

        if (isGrowing) {
          const growth = recentSnapshots[recentSnapshots.length - 1].metadata.size - recentSnapshots[0].metadata.size
          if (growth > 1024 * 1024) { // 1MB growth
            leaks.push(`${storeName}: Growing state detected (+${formatBytes(growth)})`)
          }
        }
      }

      return leaks
    },

    analyzeStateGrowth: () => {
      const state = get()
      const growing: string[] = []
      const stable: string[] = []
      const shrinking: string[] = []

      // Group snapshots by store
      const storeSnapshots = new Map<string, StateSnapshot[]>()
      for (const snapshot of state.snapshots.values()) {
        const existing = storeSnapshots.get(snapshot.storeName) || []
        storeSnapshots.set(snapshot.storeName, [...existing, snapshot])
      }

      for (const [storeName, snapshots] of storeSnapshots) {
        if (snapshots.length < 3) {
          stable.push(storeName)
          continue
        }

        const recent = snapshots.slice(-3)
        const sizes = recent.map((s: StateSnapshot) => s.metadata.size)
        const avgGrowth = (sizes[sizes.length - 1] - sizes[0]) / (sizes.length - 1)

        if (avgGrowth > 1024) { // Growing by 1KB per snapshot
          growing.push(storeName)
        } else if (avgGrowth < -1024) { // Shrinking by 1KB per snapshot
          shrinking.push(storeName)
        } else {
          stable.push(storeName)
        }
      }

      return { growing, stable, shrinking }
    },
  }))
)

// ==================== Utility Functions ====================

function calculateObjectSize(obj: unknown): number {
  if (obj === null || obj === undefined) return 0
  if (typeof obj === 'string') return obj.length * 2
  if (typeof obj === 'number') return 8
  if (typeof obj === 'boolean') return 4
  if (Array.isArray(obj)) {
    return obj.reduce((size, item) => size + calculateObjectSize(item), 0)
  }
  if (typeof obj === 'object') {
    return Object.entries(obj).reduce(
      (size, [key, value]) => size + key.length * 2 + calculateObjectSize(value),
      0
    )
  }
  return 0
}

function cloneDeep<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') return obj
  if (obj instanceof Date) return new Date(obj.getTime()) as T
  if (Array.isArray(obj)) return obj.map(cloneDeep) as T
  
  const cloned = {} as T
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      cloned[key] = cloneDeep(obj[key])
    }
  }
  return cloned
}

function generateDiff(from: unknown, to: unknown): StateDiff {
  const added: Record<string, unknown> = {}
  const removed: Record<string, unknown> = {}
  const modified: Record<string, { from: unknown; to: unknown }> = {}

  if (typeof from !== 'object' || typeof to !== 'object' || from === null || to === null) {
    if (from !== to) {
      modified['_root'] = { from, to }
    }
    return { added, removed, modified }
  }

  const fromObj = from as Record<string, unknown>
  const toObj = to as Record<string, unknown>

  // Find added and modified
  for (const key in toObj) {
    if (!(key in fromObj)) {
      added[key] = toObj[key]
    } else if (fromObj[key] !== toObj[key]) {
      modified[key] = { from: fromObj[key], to: toObj[key] }
    }
  }

  // Find removed
  for (const key in fromObj) {
    if (!(key in toObj)) {
      removed[key] = fromObj[key]
    }
  }

  return { added, removed, modified }
}

function calculateDiffSize(diff: StateDiff): number {
  return (
    calculateObjectSize(diff.added) +
    calculateObjectSize(diff.removed) +
    calculateObjectSize(diff.modified)
  )
}

interface GraphNode {
  id: string
}

interface GraphEdge {
  from: string
  to: string
}

function findCycles(nodes: GraphNode[], edges: GraphEdge[]): string[][] {
  const cycles: string[][] = []
  const visited = new Set<string>()
  const visiting = new Set<string>()
  const path: string[] = []

  function dfs(nodeId: string) {
    if (visiting.has(nodeId)) {
      const cycleStart = path.indexOf(nodeId)
      if (cycleStart !== -1) {
        cycles.push(path.slice(cycleStart))
      }
      return
    }

    if (visited.has(nodeId)) return

    visiting.add(nodeId)
    path.push(nodeId)

    const outgoingEdges = edges.filter(e => e.from === nodeId)
    for (const edge of outgoingEdges) {
      dfs(edge.to)
    }

    visiting.delete(nodeId)
    visited.add(nodeId)
    path.pop()
  }

  for (const node of nodes) {
    if (!visited.has(node.id)) {
      dfs(node.id)
    }
  }

  return cycles
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ==================== Development Utilities ====================

if (process.env.NODE_ENV === 'development') {
  // Auto-start debugging in development
  if (typeof window !== 'undefined') {
    const stateDebugger = useStateDebugger.getState()
    stateDebugger.startDebugging()
    
    // Expose useful debugging commands to console
    interface WindowWithDebugCommands extends Window {
      __debugCommands?: {
        startDebug: () => void
        stopDebug: () => void
        exportHistory: () => string
        findLeaks: () => string[]
        analyzeGrowth: () => { growing: string[]; stable: string[]; shrinking: string[] }
        buildGraph: () => void
        findCycles: () => string[][]
      }
    }
    
    const windowWithCommands = window as WindowWithDebugCommands
    windowWithCommands.__debugCommands = {
      startDebug: () => stateDebugger.startDebugging(),
      stopDebug: () => stateDebugger.stopDebugging(),
      exportHistory: () => stateDebugger.exportHistory(),
      findLeaks: () => stateDebugger.findStateLeaks(),
      analyzeGrowth: () => stateDebugger.analyzeStateGrowth(),
      buildGraph: () => stateDebugger.buildSelectorGraph(),
      findCycles: () => stateDebugger.findSelectorCycles(),
    }
  }
}

export type { StateDebuggerState }